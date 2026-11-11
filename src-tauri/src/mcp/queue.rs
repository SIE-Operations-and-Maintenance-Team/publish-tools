//! 发布任务串行队列。
//!
//! 所有写类发布动作（一键发布、手动发布、还原备份、取代码、编译、取程序集）
//! 统一提交到这里排队，由单 worker 依次派发给前端执行。
//!
//! Tauri 是单实例进程，因此该队列天然覆盖所有 ZCode 会话、界面操作与定时任务，
//! 是「同一时间只允许一个发布流程」的唯一串行点：调用方只负责提交并拿任务号，
//! 执行与互斥全部由队列承担，避免多会话并发派发相互踩踏。

use crate::mcp::{bridge, db};
use serde_json::Value;
use std::collections::{HashSet, VecDeque};
use std::sync::{Arc, Mutex, OnceLock};
use tauri::Emitter;
use tokio::sync::Notify;

/// 前端因发布锁被其他流程占用而回传的返回码（任务回退排队，不算失败）
pub const CODE_PUBLISH_BUSY: i32 = 2;

/// 单任务最长执行时间（秒），与改造前动作工具保持一致
const JOB_TIMEOUT_SECS: u64 = 3600;

/// 锁被占用后的重试间隔（秒）
const BUSY_RETRY_SECS: u64 = 30;

/// 提交结果：任务号 + 前面还有几个排队中的任务
pub struct SubmitResult {
    pub job_id: i64,
    pub queued_ahead: i64,
}

struct QueueState {
    /// 待执行任务号，按提交顺序
    pending: VecDeque<i64>,
    /// 正在执行的任务号
    running: Option<i64>,
    /// 已请求中止的执行中任务（worker 收尾时按取消处理）
    cancel_requested: HashSet<i64>,
}

struct JobQueue {
    app: tauri::AppHandle,
    state: Mutex<QueueState>,
    notify: Notify,
}

static QUEUE: OnceLock<Arc<JobQueue>> = OnceLock::new();

fn json_i64(value: Option<&Value>, key: &str) -> Option<i64> {
    value.and_then(|v| v.get(key)).and_then(|v| v.as_i64())
}

fn json_str(value: Option<&Value>, key: &str) -> Option<String> {
    value
        .and_then(|v| v.get(key))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

/// 启动队列 worker（应用启动时调用一次）。
///
/// 启动时做两件事：把上次异常退出残留的 `running` 任务标记为 `interrupted`，
/// 并把仍处于 `queued` 的任务重新放回内存队列，保证重启不丢待执行任务。
pub fn start(app: tauri::AppHandle) {
    let queue = Arc::new(JobQueue {
        app,
        state: Mutex::new(QueueState {
            pending: VecDeque::new(),
            running: None,
            cancel_requested: HashSet::new(),
        }),
        notify: Notify::new(),
    });

    if QUEUE.set(queue.clone()).is_err() {
        return;
    }

    if let Ok(conn) = db::open_db(&queue.app) {
        match db::mark_jobs_interrupted_on_startup(&conn) {
            Ok(0) => {}
            Ok(n) => eprintln!("[queue] 已将 {n} 个残留执行中任务标记为中断"),
            Err(e) => eprintln!("[queue] 标记残留任务失败: {e}"),
        }
        match db::query_active_jobs(&conn) {
            Ok(jobs) => {
                let mut state = queue.state.lock().unwrap();
                for job in jobs {
                    let status = json_str(Some(&job), "status");
                    if status.as_deref() == Some("queued") {
                        if let Some(id) = json_i64(Some(&job), "id") {
                            state.pending.push_back(id);
                        }
                    }
                }
                if !state.pending.is_empty() {
                    eprintln!("[queue] 恢复排队任务 {} 个", state.pending.len());
                }
            }
            Err(e) => eprintln!("[queue] 读取待执行任务失败: {e}"),
        }
    }

    tauri::async_runtime::spawn(worker(queue));
}

/// 提交一个发布动作，立即返回任务号，不等待执行结果
pub fn submit(
    action: &str,
    appconfig: Option<Value>,
    backup: Option<Value>,
    source: &str,
) -> Result<SubmitResult, String> {
    let queue = QUEUE
        .get()
        .ok_or_else(|| "发布队列尚未启动".to_string())?;

    let conn = db::open_db(&queue.app)?;
    let job = db::NewPublishJob {
        action: action.to_string(),
        source: source.to_string(),
        appconfig_id: json_i64(appconfig.as_ref(), "id"),
        project_id: json_i64(appconfig.as_ref(), "project_id"),
        project_name: json_str(appconfig.as_ref(), "project_name"),
        environment: json_i64(appconfig.as_ref(), "environment"),
        backup_id: json_i64(backup.as_ref(), "id"),
    };
    let job_id = db::insert_job(&conn, &job)?;
    let queued_ahead = db::count_queued_ahead(&conn, job_id)?;

    queue.state.lock().unwrap().pending.push_back(job_id);
    queue.notify.notify_one();

    Ok(SubmitResult {
        job_id,
        queued_ahead,
    })
}

/// 取消结果
pub struct CancelResult {
    /// 是否取消了排队中的任务
    pub canceled_queued: bool,
    /// 是否对执行中的任务发出了中止请求（等待界面在检查点停下）
    pub stop_requested: bool,
}

/// 取消任务：排队中的直接撤销；执行中的发出停止信号，由界面在下一个检查点退出
pub fn cancel(job_id: i64) -> Result<CancelResult, String> {
    let queue = QUEUE
        .get()
        .ok_or_else(|| "发布队列尚未启动".to_string())?;
    let conn = db::open_db(&queue.app)?;

    if db::cancel_job(&conn, job_id)? {
        // 内存队列里可能还留着该任务号，worker 取出时会按状态跳过
        queue.notify.notify_one();
        return Ok(CancelResult {
            canceled_queued: true,
            stop_requested: false,
        });
    }

    // 排队中取消失败：若是当前正在执行的任务，发停止信号
    let running = queue.state.lock().unwrap().running;
    if running == Some(job_id) {
        queue.state.lock().unwrap().cancel_requested.insert(job_id);
        let _ = queue.app.emit(
            "mcp-action-stop",
            serde_json::json!({ "job_id": job_id, "reason": "cancel-requested" }),
        );
        db::update_job_status(
            &conn,
            job_id,
            "running",
            Some("已请求中止，等待界面在检查点停止"),
        )?;
        return Ok(CancelResult {
            canceled_queued: false,
            stop_requested: true,
        });
    }

    Ok(CancelResult {
        canceled_queued: false,
        stop_requested: false,
    })
}

async fn worker(queue: Arc<JobQueue>) {
    loop {
        let job_id = queue.state.lock().unwrap().pending.pop_front();
        match job_id {
            Some(id) => run_job(&queue, id).await,
            None => queue.notify.notified().await,
        }
    }
}

async fn run_job(queue: &Arc<JobQueue>, job_id: i64) {
    let app = &queue.app;

    // 取任务快照：被取消的直接跳过
    let job_row = match db::open_db(app).and_then(|conn| db::query_job_by_id(&conn, job_id)) {
        Ok(Some(row)) => row,
        Ok(None) => return,
        Err(e) => {
            eprintln!("[queue] 读取任务 {job_id} 失败: {e}");
            return;
        }
    };
    if json_str(Some(&job_row), "status").as_deref() != Some("queued") {
        return;
    }

    let action = match json_str(Some(&job_row), "action") {
        Some(a) => a,
        None => {
            mark(&queue.app, job_id, "failed", Some("任务缺少动作名"));
            return;
        }
    };
    let appconfig_id = json_i64(Some(&job_row), "appconfig_id");
    let backup_id = json_i64(Some(&job_row), "backup_id");

    // 重新取执行所需数据：应用配置与备份记录都是执行瞬间的快照
    let (appconfig, backup) = match load_action_data(app, appconfig_id, backup_id) {
        Ok(pair) => pair,
        Err(e) => {
            mark(app, job_id, "failed", Some(&e));
            return;
        }
    };

    mark(app, job_id, "running", None);
    queue.state.lock().unwrap().running = Some(job_id);
    eprintln!("[queue] 开始执行任务 {job_id}（{action}）");

    let outcome = bridge::dispatch(app, &action, appconfig, backup, JOB_TIMEOUT_SECS).await;

    let canceled = {
        let mut state = queue.state.lock().unwrap();
        state.running = None;
        state.cancel_requested.remove(&job_id)
    };

    // 被调用方中止的任务统一以 canceled 收尾，不再区分前端回报成功或失败
    if canceled {
        eprintln!("[queue] 任务 {job_id} 已被调用方中止");
        mark(app, job_id, "canceled", Some("已被调用方中止"));
        return;
    }

    match outcome {
        // 锁被其他流程占用：回退排队，稍后重试，不算失败
        Ok(result) if result.code == Some(CODE_PUBLISH_BUSY) => {
            eprintln!("[queue] 任务 {job_id} 等待发布锁，{BUSY_RETRY_SECS}s 后重试");
            mark(app, job_id, "queued", Some("等待其他发布流程结束"));
            queue.state.lock().unwrap().pending.push_front(job_id);
            tokio::time::sleep(std::time::Duration::from_secs(BUSY_RETRY_SECS)).await;
        }
        Ok(result) => {
            let status = if result.success { "succeeded" } else { "failed" };
            eprintln!("[queue] 任务 {job_id} 结束：{status}");
            mark(app, job_id, status, Some(&result.message));
        }
        Err(e) => {
            eprintln!("[queue] 任务 {job_id} 派发失败: {e}");
            mark(app, job_id, "failed", Some(&e));
        }
    }
}

fn load_action_data(
    app: &tauri::AppHandle,
    appconfig_id: Option<i64>,
    backup_id: Option<i64>,
) -> Result<(Option<Value>, Option<Value>), String> {
    let conn = db::open_db(app)?;
    let appconfig = match appconfig_id {
        Some(id) => db::query_app_configs_for_action(&conn, None)?
            .into_iter()
            .find(|v| json_i64(Some(v), "id") == Some(id)),
        None => None,
    };
    let backup = match backup_id {
        Some(id) => db::query_backup_by_id(&conn, id)?,
        None => None,
    };
    Ok((appconfig, backup))
}

fn mark(app: &tauri::AppHandle, job_id: i64, status: &str, message: Option<&str>) {
    match db::open_db(app).and_then(|conn| db::update_job_status(&conn, job_id, status, message)) {
        Ok(()) => {}
        Err(e) => eprintln!("[queue] 回写任务 {job_id} 状态失败: {e}"),
    }
}

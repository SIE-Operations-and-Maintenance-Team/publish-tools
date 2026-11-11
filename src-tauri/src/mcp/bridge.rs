//! MCP → 前端 动作桥。
//!
//! MCP 工具在 Rust 侧只负责解析参数和等待结果，真正的发布逻辑在 Vue 前端。
//! 流程：登记 request_id → 向前端发送 `mcp-action` 事件 → 前端执行后调用
//! `mcp_action_result` 命令回传 → 这里通过一次性通道唤醒等待中的工具调用。

use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::Emitter;
use tokio::sync::oneshot;

/// 无进展判定阈值：前端执行动作期间每 30 秒发一次心跳，
/// 超过该时长没有任何心跳即认定界面卡死或崩溃
const NO_PROGRESS_SECS: u64 = 12 * 60;

/// 心跳检查间隔
const PROGRESS_CHECK_SECS: u64 = 60;

/// 发给前端的动作请求
#[derive(Debug, Clone, Serialize)]
pub struct ActionPayload {
    pub request_id: String,
    /// oneClickPublish / pullLatestCode / buildProjects / getApplicationAssemblys / manualPublish / restoreBackup
    pub action: String,
    /// 已解析的应用配置；为空表示使用界面当前选择
    #[serde(skip_serializing_if = "Option::is_none")]
    pub appconfig: Option<serde_json::Value>,
    /// 还原备份动作下发的备份记录；为空表示该动作不需要
    #[serde(skip_serializing_if = "Option::is_none")]
    pub backup: Option<serde_json::Value>,
}

/// 前端回传的执行结果
#[derive(Debug, Clone)]
pub struct ActionResult {
    pub success: bool,
    pub message: String,
    /// 附加状态码：2 = 发布锁被其他流程占用（队列应回退重试，不算失败）
    pub code: Option<i32>,
}

static PENDING: OnceLock<Mutex<HashMap<String, oneshot::Sender<ActionResult>>>> = OnceLock::new();
/// 各请求最近一次心跳时间（用于判定界面是否僵死）
static PROGRESS: OnceLock<Mutex<HashMap<String, Instant>>> = OnceLock::new();
static COUNTER: AtomicU64 = AtomicU64::new(1);

fn pending() -> &'static Mutex<HashMap<String, oneshot::Sender<ActionResult>>> {
    PENDING.get_or_init(|| Mutex::new(HashMap::new()))
}

fn progress_map() -> &'static Mutex<HashMap<String, Instant>> {
    PROGRESS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// 前端心跳：刷新指定请求的最近活跃时间
///
/// 返回 false 表示该请求已结束（超时 / 已回传），前端可停止心跳。
pub fn progress(request_id: &str) -> bool {
    match progress_map().lock() {
        Ok(mut map) => match map.get_mut(request_id) {
            Some(last) => {
                *last = Instant::now();
                true
            }
            None => false,
        },
        Err(_) => false,
    }
}

/// 前端回填结果；找不到对应请求（已超时或无效 ID）返回 false
pub fn complete(request_id: &str, success: bool, message: String, code: Option<i32>) -> bool {
    let sender = match pending().lock() {
        Ok(mut map) => map.remove(request_id),
        Err(_) => None,
    };
    match sender {
        Some(tx) => tx
            .send(ActionResult {
                success,
                message,
                code,
            })
            .is_ok(),
        None => false,
    }
}

/// 向前端派发动作并等待执行结果
///
/// 等待期间按「无进展」判定僵死：前端每 30 秒发一次心跳（`mcp_action_progress`），
/// 超过 `NO_PROGRESS_SECS` 没有任何心跳即认定界面已卡死或崩溃，主动发停止信号并返回失败，
/// 避免一个僵住的任务把整条发布队列独占满一小时。
pub async fn dispatch(
    app: &tauri::AppHandle,
    action: &str,
    appconfig: Option<serde_json::Value>,
    backup: Option<serde_json::Value>,
    timeout_secs: u64,
) -> Result<ActionResult, String> {
    let request_id = format!(
        "{}-{}",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::Relaxed)
    );
    let (tx, mut rx) = oneshot::channel();
    {
        let mut map = pending().lock().map_err(|e| e.to_string())?;
        map.insert(request_id.clone(), tx);
    }
    if let Ok(mut map) = progress_map().lock() {
        map.insert(request_id.clone(), Instant::now());
    }

    let payload = ActionPayload {
        request_id: request_id.clone(),
        action: action.to_string(),
        appconfig,
        backup,
    };
    if let Err(e) = app.emit("mcp-action", payload) {
        clear_request(&request_id);
        return Err(format!("通知界面失败: {e}"));
    }

    let deadline = Instant::now() + Duration::from_secs(timeout_secs);
    let mut ticker = tokio::time::interval(Duration::from_secs(PROGRESS_CHECK_SECS));
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    loop {
        tokio::select! {
            result = &mut rx => {
                clear_request(&request_id);
                return match result {
                    Ok(value) => Ok(value),
                    Err(_) => Err("界面未返回执行结果".to_string()),
                };
            }
            _ = ticker.tick() => {
                let idle = progress_map()
                    .lock()
                    .ok()
                    .and_then(|map| map.get(&request_id).map(|at| at.elapsed()))
                    .unwrap_or_default();
                if idle.as_secs() >= NO_PROGRESS_SECS {
                    clear_request(&request_id);
                    // 全队列同一时刻只有一个动作在执行，广播停止即可
                    let _ = app.emit(
                        "mcp-action-stop",
                        serde_json::json!({ "request_id": request_id, "reason": "no-progress" }),
                    );
                    return Err(format!(
                        "超过 {} 分钟无进展，已判定界面僵死并请求停止",
                        NO_PROGRESS_SECS / 60
                    ));
                }
                if Instant::now() >= deadline {
                    clear_request(&request_id);
                    return Err(format!("等待界面执行超时（{timeout_secs} 秒）"));
                }
            }
        }
    }
}

/// 清理请求的等待通道与心跳记录
fn clear_request(request_id: &str) {
    if let Ok(mut map) = pending().lock() {
        map.remove(request_id);
    }
    if let Ok(mut map) = progress_map().lock() {
        map.remove(request_id);
    }
}

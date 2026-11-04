// 增量上传模块
//
// 背景：`file_module::upload_server_files` 由前端「一个文件一次 invoke」调用，
// 且上传前不做任何比对，每次发布都把整个目录全量覆盖上传。WebClient 静态资源
// 动辄数千个文件，既慢（N 次 IPC + N 次通道操作），又容易在中途断点处失败。
//
// 本模块提供 `sync_dir_to_server`：
// 1. 一次调用传输整个目录（批量）；
// 2. 上传前 `stat` 远端文件，大小一致且远端修改时间不早于本地（2 秒容差）时跳过，
//    只传真正变化的文件（差量）；
// 3. 通过 `publish://upload-progress` 事件实时回报进度（100ms 节流）。

use crate::cmd_module::ssh_pool;
use ssh2::Sftp;
use std::fs::File;
use std::io;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant, UNIX_EPOCH};
use tauri::Emitter;
use walkdir::WalkDir;

/// 上传进度事件名
pub const UPLOAD_PROGRESS_EVENT: &str = "publish://upload-progress";

/// 上传取消消息（前端据此区分「用户主动中断」与真实传输失败）
pub const UPLOAD_CANCELLED_MSG: &str = "上传已取消";

/// 上传取消标志：前端点「停止」/「暂停」时置位，
/// 上传循环在每个文件前检查，置位后尽快返回，剩余文件由后续重传按差量补齐
static UPLOAD_CANCELLED: AtomicBool = AtomicBool::new(false);

/// 取消当前正在进行的目录上传
#[tauri::command]
pub fn cancel_sync_upload() {
    UPLOAD_CANCELLED.store(true, Ordering::SeqCst);
}

/// 差量上传统计结果
#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UploadSyncResult {
    /// 本地文件总数
    pub total: u32,
    /// 实际上传的文件数
    pub uploaded: u32,
    /// 内容未变化而跳过的文件数
    pub skipped: u32,
    /// 实际传输的字节数
    pub bytes: u64,
}

/// 上传进度事件负载
#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct UploadProgressPayload {
    /// 关联的日志标识（可选，前端据此更新对应进度行）
    tab_id: Option<String>,
    /// 已处理文件数（含跳过）
    current: u32,
    /// 文件总数
    total: u32,
    /// 已上传文件数
    uploaded: u32,
    /// 已跳过文件数
    skipped: u32,
    /// 当前处理的文件（相对路径）
    file_name: String,
}

/// 本地待上传文件描述
struct LocalUploadFile {
    /// 相对路径（统一使用 `/` 分隔）
    relative_path: String,
    size: u64,
    /// 修改时间（Unix 秒）
    mtime: u64,
}

/// 增量上传目录到服务器
///
/// # Arguments
/// * `app` - Tauri 应用句柄，用于发送进度事件
/// * `local_dir` - 本地目录
/// * `remote_dir` - 远程目录
/// * `username` - 用户名称
/// * `password` - 用户密码
/// * `server` - 服务器地址（host:port）
/// * `tab_id` - 日志标识（可选）
/// * `force` - 为 true 时忽略差量比对，全部重传
///
/// # Returns
/// * `Ok(UploadSyncResult)` 上传统计
/// * `Err(String)` 失败原因
// 参数即前端 invoke 的扁平字段契约，拆成结构体会改变前端调用方式；
// 上传所需参数本就较多，此处保留扁平签名并显式放行 clippy 参数数量限制。
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn sync_dir_to_server(
    app: tauri::AppHandle,
    local_dir: String,
    remote_dir: String,
    username: String,
    password: String,
    server: String,
    tab_id: Option<String>,
    force: Option<bool>,
) -> Result<UploadSyncResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        exec_sync_dir_to_server(
            &app,
            &local_dir,
            &remote_dir,
            &username,
            &password,
            &server,
            tab_id.as_deref(),
            force.unwrap_or(false),
        )
    })
    .await
    .map_err(|e| format!("上传任务异常终止：{}", e))?
}

/// 执行增量上传（阻塞实现，必须在阻塞线程池中调用）
// 参数与上层命令一一对应，保持签名一致便于对照，同样放行参数数量限制。
#[allow(clippy::too_many_arguments)]
fn exec_sync_dir_to_server(
    app: &tauri::AppHandle,
    local_dir: &str,
    remote_dir: &str,
    username: &str,
    password: &str,
    server: &str,
    tab_id: Option<&str>,
    force: bool,
) -> Result<UploadSyncResult, String> {
    let local_root = Path::new(local_dir);
    if !local_root.is_dir() {
        return Err(format!("本地目录不存在：{}", local_dir));
    }

    // 新一轮上传：清除上一轮遗留的取消标志
    UPLOAD_CANCELLED.store(false, Ordering::SeqCst);

    // 1. 收集本地文件与目录清单
    let mut files: Vec<LocalUploadFile> = Vec::new();
    let mut dirs: Vec<String> = Vec::new();
    for entry in WalkDir::new(local_root) {
        let entry = entry.map_err(|e| format!("无法读取本地目录条目：{}", e))?;
        let relative = match entry.path().strip_prefix(local_root) {
            Ok(p) => p,
            Err(_) => continue,
        };
        if relative.as_os_str().is_empty() {
            continue;
        }
        let relative_path = relative.to_string_lossy().replace('\\', "/");
        if entry.file_type().is_dir() {
            dirs.push(relative_path);
        } else if entry.file_type().is_file() {
            let metadata = entry
                .metadata()
                .map_err(|e| format!("无法读取文件信息[{}]：{}", relative_path, e))?;
            let mtime = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);
            files.push(LocalUploadFile {
                relative_path,
                size: metadata.len(),
                mtime,
            });
        }
    }

    let total = files.len() as u32;
    let remote_root = Path::new(remote_dir);
    let mut stats = UploadSyncResult {
        total,
        uploaded: 0,
        skipped: 0,
        bytes: 0,
    };

    let shared = ssh_pool::get_session(username, password, server)?;
    let mut last_emit = Instant::now() - Duration::from_secs(1);

    let outcome: Result<(), String> = (|| {
        let mut entry = shared.lock().map_err(|_| "SSH 会话锁中毒".to_string())?;
        {
            let sftp = entry
                .session
                .sftp()
                .map_err(|e| format!("无法创建 SFTP 会话: {}", e))?;

            remote_ensure_dir(&sftp, remote_root)?;
            // 先补齐目录结构（含空目录），避免远端缺目录导致后续上传失败
            for dir in dirs.iter() {
                remote_ensure_dir(&sftp, &remote_root.join(dir))?;
            }

            for file in files.iter() {
                // 逐文件检查取消标志：停止/暂停在文件边界生效（单个文件的写入不会被截断）
                if UPLOAD_CANCELLED.load(Ordering::SeqCst) {
                    return Err(UPLOAD_CANCELLED_MSG.to_string());
                }
                let remote_file_path = remote_root.join(&file.relative_path);
                if let Some(parent) = remote_file_path.parent() {
                    remote_ensure_dir(&sftp, parent)?;
                }

                let need_upload = force || requires_upload(&sftp, &remote_file_path, file);
                if need_upload {
                    upload_file(&local_root.join(&file.relative_path), &remote_file_path, &sftp)?;
                    stats.uploaded += 1;
                    stats.bytes += file.size;
                } else {
                    stats.skipped += 1;
                }

                // 节流：最多每 100ms 上报一次，避免大目录刷爆 webview
                let processed = stats.uploaded + stats.skipped;
                if last_emit.elapsed() >= Duration::from_millis(100) || processed == total {
                    last_emit = Instant::now();
                    let payload = UploadProgressPayload {
                        tab_id: tab_id.map(|s| s.to_string()),
                        current: processed,
                        total,
                        uploaded: stats.uploaded,
                        skipped: stats.skipped,
                        file_name: file.relative_path.clone(),
                    };
                    let _ = app.emit(UPLOAD_PROGRESS_EVENT, payload);
                }
            }
        }

        entry.last_used = Instant::now();
        Ok(())
    })();

    match outcome {
        Ok(()) => Ok(stats),
        Err(e) => {
            // 用户主动取消：会话本身是好的，不能丢出池外
            if e != UPLOAD_CANCELLED_MSG {
                // 上传过程中出错：怀疑底层会话已坏，丢出池外，由上层重试时重建
                ssh_pool::invalidate(username, server);
            }
            Err(e)
        }
    }
}

/// 判断远端文件是否需要重新上传
///
/// 规则：大小一致，且远端修改时间不早于本地（留 2 秒容差，
/// 规避本地与服务器时钟偏差导致的「永远判定为变更」）。
fn requires_upload(sftp: &Sftp, remote_file_path: &Path, file: &LocalUploadFile) -> bool {
    match sftp.stat(remote_file_path) {
        Ok(remote_meta) => {
            let same_size = remote_meta.size == Some(file.size);
            let remote_not_older = remote_meta
                .mtime
                .map(|mtime| mtime + 2 >= file.mtime)
                .unwrap_or(false);
            !(same_size && remote_not_older)
        }
        // 远端不存在或无法读取：需要上传
        Err(_) => true,
    }
}

/// 幂等地确保远程目录存在：逐级创建缺失的父目录，目录已存在时视为成功。
fn remote_ensure_dir(sftp: &Sftp, path: &Path) -> Result<(), String> {
    if path.as_os_str().is_empty() {
        return Ok(());
    }
    if let Ok(md) = sftp.stat(path) {
        if md.is_dir() {
            return Ok(());
        }
    }
    if let Some(parent) = path.parent() {
        if parent != path {
            remote_ensure_dir(sftp, parent)?;
        }
    }
    match sftp.mkdir(path, 0o755) {
        Ok(_) => Ok(()),
        Err(e) => {
            if sftp.stat(path).map(|m| m.is_dir()).unwrap_or(false) {
                Ok(())
            } else {
                Err(format!("无法创建远程目录 {:?}: {}", path, e))
            }
        }
    }
}

/// 流式上传单个文件（避免大文件一次性读入内存）
fn upload_file(local_path: &Path, remote_path: &Path, sftp: &Sftp) -> Result<(), String> {
    let mut local_file = File::open(local_path)
        .map_err(|e| format!("无法打开本地文件[{}]：{}", local_path.display(), e))?;
    let mut remote_file = sftp
        .create(remote_path)
        .map_err(|e| format!("无法创建远程文件[{}]：{}", remote_path.display(), e))?;
    io::copy(&mut local_file, &mut remote_file)
        .map_err(|e| format!("上传文件[{}]失败：{}", remote_path.display(), e))?;
    Ok(())
}

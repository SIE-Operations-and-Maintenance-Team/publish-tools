//! MCP Server 运行时管理：根据配置动态启动/停止服务，并广播状态事件。
//!
//! 架构说明：
//! - 全局保存一个 `watch::Sender` 信号通道（静态变量 MCP_WATCH_SENDER），
//!   配置变更（apply）时通过该通道通知管理循环。
//! - 管理循环持有正在运行的 serve 任务，收到信号后：
//!   - 若新配置启用 MCP 且无任务 → spawn 启动；
//!   - 若新配置禁用 MCP 且有任务 → abort 停止。
//! - serve() 内部在端口绑定成功后广播 "ok"，启动失败由管理循环广播 "error"，
//!   停止后广播 "stopped"，与 main.rs setup 中原有的事件语义保持一致。

use crate::config;
use crate::mcp::serve;
use std::sync::Mutex;
use tauri::Emitter;
use tokio::sync::watch;

/// 全局配置变更信号发送端（管理循环通过它获知配置更新）
static MCP_WATCH_SENDER: Mutex<Option<watch::Sender<bool>>> = Mutex::new(None);

/// 保存信号发送端（覆盖式更新）
fn set_sender(sender: watch::Sender<bool>) {
    if let Ok(mut guard) = MCP_WATCH_SENDER.lock() {
        *guard = Some(sender);
    }
}

/// 触发配置变更信号（无接收者时静默忽略）
fn notify_change() {
    if let Ok(guard) = MCP_WATCH_SENDER.lock() {
        if let Some(sender) = guard.as_ref() {
            let _ = sender.send(true);
        }
    }
}

/// 启动 serve 任务；任务结束后（无论成败）触发一次信号，
/// 让管理循环及时感知并广播最终状态（error/stopped），避免状态停留在 unknown。
fn spawn_serve_task(app_handle: &tauri::AppHandle, port: u16) -> tokio::task::JoinHandle<Result<(), String>> {
    let handle = app_handle.clone();
    tokio::spawn(async move {
        let result = serve(handle, port).await;
        notify_change();
        result
    })
}

/// 管理循环：监听配置变更信号，动态启动/停止 MCP 服务
async fn manager_loop(app_handle: tauri::AppHandle, mut rx: watch::Receiver<bool>) {
    // 当前正在运行的 serve 任务及其端口
    let mut running: Option<(tokio::task::JoinHandle<Result<(), String>>, u16)> = None;

    loop {
        if rx.changed().await.is_err() {
            break; // 发送端全部被丢弃（应用退出时），停止管理
        }
        // 清理已结束的任务并广播其最终状态（启动失败 → error；正常退出 → stopped）
        if let Some((task, port)) = running.take() {
            if task.is_finished() {
                // 任务已完成，await 立即返回
                let result = task.await;
                match result {
                    Ok(Err(e)) => {
                        eprintln!("[mcp] {e}；MCP 不可用，主界面继续运行");
                        config::set_mcp_status("error");
                        let _ = app_handle.emit(
                            "mcp-status",
                            serde_json::json!({ "status": "error", "port": port, "message": e }),
                        );
                    }
                    _ => {
                        // Ok(Ok(()))：服务正常退出；Err(JoinError)：任务被外部 abort
                        config::set_mcp_status("stopped");
                        let _ = app_handle.emit(
                            "mcp-status",
                            serde_json::json!({ "status": "stopped", "port": port }),
                        );
                    }
                }
            } else {
                running = Some((task, port));
            }
        }
        let cfg = config::load(&app_handle);
        match (cfg.mcp.mcp_enabled, running.as_ref()) {
            // 启用 MCP：未运行则启动；端口变更则重启服务
            (true, Some((task, running_port))) if *running_port != cfg.mcp.mcp_port => {
                // 端口变更：先停止旧服务，再启动新端口
                task.abort();
                let port = cfg.mcp.mcp_port;
                let task = spawn_serve_task(&app_handle, port);
                running = Some((task, port));
                config::set_mcp_status("unknown");
                let _ = app_handle.emit(
                    "mcp-status",
                    serde_json::json!({ "status": "unknown", "port": port }),
                );
            }
            // 启用 MCP：若未运行则启动
            (true, None) => {
                let port = cfg.mcp.mcp_port;
                let task = spawn_serve_task(&app_handle, port);
                running = Some((task, port));
            }
            // 禁用 MCP：若正在运行则停止（停止后状态为 disabled，而非 stopped——stopped 仅表示服务异常退出）
            (false, Some(_)) => {
                // 此刻 running 中保存的是未完成的任务（已完成的任务已在循环开头清理）
                if let Some((task, port)) = running.take() {
                    task.abort();
                    config::set_mcp_status("disabled");
                    let _ = app_handle.emit(
                        "mcp-status",
                        serde_json::json!({ "status": "disabled", "port": port }),
                    );
                }
            }
            _ => {}
        }
    }

    // 信号通道关闭（应用退出），清理运行中的服务
    if let Some((task, port)) = running.take() {
        task.abort();
        config::set_mcp_status("stopped");
        let _ = app_handle.emit("mcp-status", serde_json::json!({ "status": "stopped", "port": port }));
    }
}

/// 应用启动时初始化：根据配置启动管理循环（不阻塞，立即返回）
pub fn init(app_handle: &tauri::AppHandle) {
    let cfg = config::load(app_handle);
    config::set_mcp_status(if cfg.mcp.mcp_enabled { "unknown" } else { "disabled" });
    let (sender, receiver) = watch::channel(true);
    set_sender(sender);
    let handle = app_handle.clone();
    tauri::async_runtime::spawn(async move { manager_loop(handle, receiver).await });
    // 发送初始信号，触发管理循环按当前配置启动/不启动 MCP 服务
    // （manager_loop 仅在收到信号后执行，watch 通道初始值不会触发 changed()）
    notify_change();
}

/// 配置变更后调用：立即按新配置启动/停止 MCP 服务
pub fn apply(app_handle: &tauri::AppHandle) {
    let cfg = config::load(app_handle);
    // 仅同步占位状态；服务运行/停止后的真实状态由管理循环广播 mcp-status 事件驱动
    if !cfg.mcp.mcp_enabled {
        config::set_mcp_status("disabled");
    }
    notify_change();
}

/// 应用退出时停止 MCP 服务（幂等，未运行时无副作用）
pub fn stop_after_run() {
    if let Ok(guard) = MCP_WATCH_SENDER.lock() {
        if let Some(sender) = guard.as_ref() {
            let _ = sender.send(false);
        }
    }
}

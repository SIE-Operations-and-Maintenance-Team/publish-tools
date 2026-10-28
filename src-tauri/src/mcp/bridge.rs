//! MCP → 前端 动作桥。
//!
//! MCP 工具在 Rust 侧只负责解析参数和等待结果，真正的发布逻辑在 Vue 前端。
//! 流程：登记 request_id → 向前端发送 `mcp-action` 事件 → 前端执行后调用
//! `mcp_action_result` 命令回传 → 这里通过一次性通道唤醒等待中的工具调用。

use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use tauri::Emitter;
use tokio::sync::oneshot;

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
}

static PENDING: OnceLock<Mutex<HashMap<String, oneshot::Sender<ActionResult>>>> = OnceLock::new();
static COUNTER: AtomicU64 = AtomicU64::new(1);

fn pending() -> &'static Mutex<HashMap<String, oneshot::Sender<ActionResult>>> {
    PENDING.get_or_init(|| Mutex::new(HashMap::new()))
}

/// 前端回填结果；找不到对应请求（已超时或无效 ID）返回 false
pub fn complete(request_id: &str, success: bool, message: String) -> bool {
    let sender = match pending().lock() {
        Ok(mut map) => map.remove(request_id),
        Err(_) => None,
    };
    match sender {
        Some(tx) => tx
            .send(ActionResult { success, message })
            .is_ok(),
        None => false,
    }
}

/// 向前端派发动作并等待执行结果
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
    let (tx, rx) = oneshot::channel();
    {
        let mut map = pending().lock().map_err(|e| e.to_string())?;
        map.insert(request_id.clone(), tx);
    }

    let payload = ActionPayload {
        request_id: request_id.clone(),
        action: action.to_string(),
        appconfig,
        backup,
    };
    if let Err(e) = app.emit("mcp-action", payload) {
        if let Ok(mut map) = pending().lock() {
            map.remove(&request_id);
        }
        return Err(format!("通知界面失败: {e}"));
    }

    let timeout = std::time::Duration::from_secs(timeout_secs);
    match tokio::time::timeout(timeout, rx).await {
        Ok(Ok(result)) => Ok(result),
        Ok(Err(_)) => Err("界面未返回执行结果".to_string()),
        Err(_) => {
            if let Ok(mut map) = pending().lock() {
                map.remove(&request_id);
            }
            Err(format!("等待界面执行超时（{timeout_secs} 秒）"))
        }
    }
}

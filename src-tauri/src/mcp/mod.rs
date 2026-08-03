pub mod audit;
pub mod db;
pub mod handler;
pub mod manager;
pub mod types;

use crate::mcp::audit::AuditLogger;
use crate::mcp::handler::McpHandler;
use crate::config;
use rmcp::transport::streamable_http_server::{
    session::local::LocalSessionManager,
    StreamableHttpServerConfig,
    StreamableHttpService,
};
use std::sync::Arc;
use std::sync::Mutex;
use tauri::Emitter;

/// 启动 MCP Server，监听 127.0.0.1:port/mcp
///
/// 使用 rmcp + axum 提供 Streamable HTTP 协议的 MCP 服务。
/// 所有 Phase 1 的 tool 薄包装调用 cmd_module 现有函数。
pub async fn serve(app_handle: tauri::AppHandle, port: u16) -> Result<(), String> {
    let listener = tokio::net::TcpListener::bind(("127.0.0.1", port))
        .await
        .map_err(|e| format!("MCP 端口 {port} 绑定失败: {e}"))?;

    println!("[mcp] MCP Server 启动成功，监听 http://127.0.0.1:{port}/mcp");
    // 绑定成功后通知前端，与 main.rs 的 error/panic 路径互斥
    config::set_mcp_status("ok");
    let _ = app_handle.emit("mcp-status", serde_json::json!({
        "status": "ok",
        "port": port
    }));

    // 初始化审计日志记录器
    let audit_logger = match AuditLogger::new(&app_handle) {
        Ok(logger) => {
            println!("[mcp] 审计日志已初始化");
            Some(Arc::new(Mutex::new(logger)))
        }
        Err(e) => {
            eprintln!("[mcp] 审计日志初始化失败: {e}，将不记录审计日志");
            None
        }
    };

    let service = StreamableHttpService::<McpHandler, LocalSessionManager>::new(
        move || Ok(McpHandler::new(app_handle.clone(), audit_logger.clone())),
        Default::default(),
        StreamableHttpServerConfig::default(),
    );

    let router = axum::Router::new().nest_service("/mcp", service);

    axum::serve(listener, router)
        .await
        .map_err(|e| format!("MCP server 退出: {e}"))
}
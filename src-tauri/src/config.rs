use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

/// MCP 状态（持久化存储，供前端查询）
static MCP_STATUS: Mutex<String> = Mutex::new(String::new());

/// 设置 MCP 运行状态
pub fn set_mcp_status(status: &str) {
    if let Ok(mut s) = MCP_STATUS.lock() {
        *s = status.to_string();
    }
}

/// 获取 MCP 运行状态（默认返回 "unknown"）
pub fn get_mcp_status() -> String {
    MCP_STATUS.lock().map(|s| {
        if s.is_empty() { "unknown".to_string() } else { s.clone() }
    }).unwrap_or_default()
}

/// MCP 运行时配置（存储在 config.json）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpConfig {
    #[serde(default = "default_mcp_enabled")]
    pub mcp_enabled: bool,
    #[serde(default = "default_mcp_port")]
    pub mcp_port: u16,
    #[serde(default)]
    pub mcp_default_project_id: Option<i64>, // 预留字段，当前未使用
}

fn default_mcp_enabled() -> bool {
    true
}

fn default_mcp_port() -> u16 {
    17541
}

impl Default for McpConfig {
    fn default() -> Self {
        Self {
            mcp_enabled: default_mcp_enabled(),
            mcp_port: default_mcp_port(),
            mcp_default_project_id: None,
        }
    }
}

/// 应用配置（包含 MCP 配置）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default)]
    pub mcp: McpConfig,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            mcp: McpConfig::default(),
        }
    }
}

/// 获取 config.json 文件路径
fn config_path(app_handle: &tauri::AppHandle) -> PathBuf {
    let mut path = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    path.push("config.json");
    path
}

/// 加载配置，若文件不存在则返回默认值
pub fn load(app_handle: &tauri::AppHandle) -> AppConfig {
    let path = config_path(app_handle);
    if !path.exists() {
        let config = AppConfig::default();
        let _ = save_inner(&path, &config);
        return config;
    }
    match std::fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => AppConfig::default(),
    }
}

/// 保存完整配置到 config.json
pub fn save(app_handle: &tauri::AppHandle, config: &AppConfig) -> Result<(), String> {
    let path = config_path(app_handle);
    save_inner(&path, config)
}

fn save_inner(path: &PathBuf, config: &AppConfig) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建配置目录失败: {}", e))?;
    }
    let tmp_path = path.with_extension("json.tmp");
    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("序列化配置失败: {}", e))?;
    std::fs::write(&tmp_path, &json)
        .map_err(|e| format!("写入临时配置文件失败: {}", e))?;
    std::fs::rename(&tmp_path, path)
        .map_err(|e| format!("重命名配置文件失败: {}", e))?;
    Ok(())
}

/// 更新 MCP 配置字段，返回更新后的完整配置
pub fn update_mcp_config(
    app_handle: &tauri::AppHandle,
    mcp_enabled: Option<bool>,
    mcp_port: Option<u16>,
) -> Result<AppConfig, String> {
    let mut config = load(app_handle);
    if let Some(enabled) = mcp_enabled {
        config.mcp.mcp_enabled = enabled;
    }
    if let Some(port) = mcp_port {
        config.mcp.mcp_port = port;
    }
    save(app_handle, &config)?;
    Ok(config)
}

/// 全局应用状态
pub struct AppState {
    pub config: Mutex<AppConfig>,
}

impl AppState {
    pub fn new(app_handle: &tauri::AppHandle) -> Self {
        Self {
            config: Mutex::new(load(app_handle)),
        }
    }
}
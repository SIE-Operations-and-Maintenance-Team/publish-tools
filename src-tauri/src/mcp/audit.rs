use chrono::Utc;
use std::fs::{File, OpenOptions};
use std::io::{BufWriter, Write};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

/// 审计日志记录器，使用 Mutex<BufWriter<File>> 保护并发写入
pub struct AuditLogger {
    writer: Mutex<BufWriter<File>>,
}

impl AuditLogger {
    /// 创建审计日志记录器，日志文件路径为 app_data_dir/mcp_audit.log
    pub fn new(app_handle: &tauri::AppHandle) -> Result<Self, String> {
        let mut path: PathBuf = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| format!("获取 app_data_dir 失败: {}", e))?;
        path.push("mcp_audit.log");

        // 确保父目录存在
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("创建审计日志目录失败: {}", e))?;
        }

        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .map_err(|e| format!("打开审计日志文件失败: {}", e))?;

        let writer = BufWriter::new(file);

        println!("[mcp] 审计日志已初始化: {}", path.display());

        Ok(Self {
            writer: Mutex::new(writer),
        })
    }

    /// 记录一条审计日志（JSON 行格式）
    pub fn log(&self, entry: &AuditEntry) -> Result<(), String> {
        let json =
            serde_json::to_string(entry).map_err(|e| format!("审计日志序列化失败: {}", e))?;

        let mut writer = self
            .writer
            .lock()
            .map_err(|e| format!("审计日志锁获取失败: {}", e))?;

        writeln!(writer, "{}", json).map_err(|e| format!("审计日志写入失败: {}", e))?;

        writer
            .flush()
            .map_err(|e| format!("审计日志 flush 失败: {}", e))?;

        Ok(())
    }
}

/// 审计日志条目
#[derive(Debug, serde::Serialize)]
pub struct AuditEntry {
    pub ts: String,
    pub tool: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub paths: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dst_file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_dir: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_dir: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub module_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_len: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_file_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub args: Option<Vec<String>>,
    pub result: String,
}

impl AuditEntry {
    pub fn new(tool: &str, result: &str) -> Self {
        Self {
            ts: Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
            tool: tool.to_string(),
            path: None,
            paths: None,
            dst_file: None,
            server: None,
            command: None,
            source_dir: None,
            target_dir: None,
            module_name: None,
            file_path: None,
            content_len: None,
            project_file_path: None,
            args: None,
            result: result.to_string(),
        }
    }

    pub fn with_path(mut self, path: &str) -> Self {
        self.path = Some(path.to_string());
        self
    }

    pub fn with_paths(mut self, paths: Vec<String>) -> Self {
        self.paths = Some(paths);
        self
    }

    pub fn with_dst_file(mut self, dst_file: &str) -> Self {
        self.dst_file = Some(dst_file.to_string());
        self
    }

    // with_server 仅被已停用的 SSH 操作工具（remote_exec/file_upload/file_download）使用，
    // 工具在 handler.rs 注释停用（服务器相关接口收归 ssh-mcp-server），保留便于恢复
    #[allow(dead_code)]
    pub fn with_server(mut self, server: &str) -> Self {
        self.server = Some(server.to_string());
        self
    }

    pub fn with_command(mut self, command: &str) -> Self {
        self.command = Some(command.to_string());
        self
    }

    pub fn with_source_dir(mut self, source_dir: &str) -> Self {
        self.source_dir = Some(source_dir.to_string());
        self
    }

    pub fn with_target_dir(mut self, target_dir: &str) -> Self {
        self.target_dir = Some(target_dir.to_string());
        self
    }

    pub fn with_module_name(mut self, module_name: &str) -> Self {
        self.module_name = Some(module_name.to_string());
        self
    }

    pub fn with_file_path(mut self, file_path: &str) -> Self {
        self.file_path = Some(file_path.to_string());
        self
    }

    pub fn with_content_len(mut self, len: usize) -> Self {
        self.content_len = Some(len);
        self
    }

    pub fn with_project_file_path(mut self, project_file_path: &str) -> Self {
        self.project_file_path = Some(project_file_path.to_string());
        self
    }

    pub fn with_args(mut self, args: &[String]) -> Self {
        self.args = Some(args.to_vec());
        self
    }
}

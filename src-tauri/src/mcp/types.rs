use rmcp::schemars;
use serde::Deserialize;

// ── 文件操作参数 ──

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct FilePathParam {
    pub path: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct FileWriteParam {
    pub content: String,
    pub file_path: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct FileDeleteParam {
    pub paths: Vec<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct FileCompressParam {
    pub src_paths: Vec<String>,
    pub dst_file: String,
}

// ── SSH 远程操作参数 ──

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct ServerConnectParam {
    pub username: String,
    pub password: String,
    pub server: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct RemoteExecParam {
    pub username: String,
    pub password: String,
    pub server: String,
    pub command: String,
    #[serde(default)]
    pub retry_count: Option<u32>,
    #[serde(default)]
    pub retry_interval_secs: Option<u64>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct FileTransferParam {
    pub username: String,
    pub password: String,
    pub server: String,
    pub local_paths: Vec<String>,
    pub remote_paths: Vec<String>,
}

// ── 项目构建参数 ──

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct ParseSlnParam {
    pub module_name: String,
    pub sln_file_path: String,
    pub is_new_version: bool,
    #[serde(default = "default_build_mode")]
    pub build_mode: String,
}

fn default_build_mode() -> String {
    "Release".to_string()
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct FindAssemblyNameParam {
    pub project_path: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct UpgradeModuleVersionParam {
    pub file_path: String,
    pub module_name: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct CopyDllFilesParam {
    pub source_dir: String,
    pub target_dir: String,
    #[serde(default)]
    pub del_destination: bool,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct ProjectBuildParam {
    pub project_file_path: String,
    pub msbuild_path: String,
    #[serde(default)]
    pub is_rebuild: bool,
    #[serde(default = "default_build_mode")]
    pub build_mode: String,
}

// ── 本地命令执行参数 ──

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct LocalExecParam {
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub retry_count: Option<u32>,
    #[serde(default)]
    pub retry_interval_secs: Option<u64>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct LocalExecSpawnParam {
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
}

// ── 数据库查询参数（Phase 2）──

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct ProjectListParam {
    #[serde(default)]
    pub keyword: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct ServerListParam {
    #[serde(default)]
    pub project_id: Option<i64>,
    #[serde(default)]
    pub name: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct AppConfigListParam {
    #[serde(default)]
    pub project_id: Option<i64>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct BackupListParam {
    #[serde(default)]
    pub project_id: Option<i64>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct BackupCreateParam {
    pub project_id: i64,
    pub project_name: String,
    pub environment: i64,
    #[serde(default)]
    pub remark: Option<String>,
    pub backup_items_json: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct RestoreListParam {
    #[serde(default)]
    pub backup_id: Option<i64>,
}

// ── 定时发布参数（Phase 4）──

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct ScheduleListParam {
    #[serde(default)]
    pub project_id: Option<i64>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct ScheduleIdParam {
    pub id: i64,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct ScheduleCreateParam {
    pub project_id: i64,
    pub project_name: String,
    pub environment: i64,
    pub appconfig_id: i64,
    pub publish_type: String,
    pub scheduled_time: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct ScheduleUpdateTimeParam {
    pub id: i64,
    pub scheduled_time: String,
}

// ── 应用配置变更集参数 ──

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct AppConfigUpdateChangesetParam {
    pub id: i64,
    #[serde(default)]
    pub start_value: Option<String>,
    #[serde(default)]
    pub end_value: Option<String>,
}

// ── MCP 配置参数（Phase 3）──

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct McpConfigParam {
    #[serde(default)]
    pub mcp_enabled: Option<bool>,
    #[serde(default)]
    pub mcp_port: Option<u16>,
}

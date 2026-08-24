use crate::cmd_module::{file_module, parse_sln_module, wpf_upgrade_module};
use crate::mcp::audit::{AuditEntry, AuditLogger};
use crate::mcp::types::*;
use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::{CallToolResult, ContentBlock};
use rmcp::ErrorData;
use rmcp::{tool, tool_router};
use std::sync::Arc;
use std::sync::Mutex;

/// MCP 处理器，持有 Tauri AppHandle 以调用 cmd_module 现有函数
#[derive(Clone)]
pub struct McpHandler {
    pub app_handle: tauri::AppHandle,
    pub audit_logger: Option<Arc<Mutex<AuditLogger>>>,
}

impl McpHandler {
    pub fn new(
        app_handle: tauri::AppHandle,
        audit_logger: Option<Arc<Mutex<AuditLogger>>>,
    ) -> Self {
        Self {
            app_handle,
            audit_logger,
        }
    }

    /// 将 Result<T, String> 转换为 CallToolResult
    fn to_result<T: serde::Serialize>(r: Result<T, String>) -> Result<CallToolResult, ErrorData> {
        match r {
            Ok(val) => {
                let json = serde_json::to_value(val)
                    .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
                Ok(CallToolResult::success(vec![ContentBlock::text(
                    json.to_string(),
                )]))
            }
            Err(e) => Err(ErrorData::internal_error(e, None)),
        }
    }

    /// 记录写入类操作的审计日志
    fn audit(&self, entry: AuditEntry) {
        if let Some(ref logger) = self.audit_logger {
            if let Ok(logger) = logger.lock() {
                let _ = logger.log(&entry);
            }
        }
    }
}

#[tool_router]
impl McpHandler {
    // ═══════════════════════════════════════════════
    // 文件操作
    // ═══════════════════════════════════════════════

    /// 检查文件或目录是否存在
    #[tool(description = "检查文件或目录是否存在")]
    async fn file_exists(
        &self,
        Parameters(params): Parameters<FilePathParam>,
    ) -> Result<CallToolResult, ErrorData> {
        Self::to_result(file_module::exists(&params.path).await)
    }

    /// 读取文件内容
    #[tool(description = "读取文件内容（UTF-8 编码）")]
    async fn file_read(
        &self,
        Parameters(params): Parameters<FilePathParam>,
    ) -> Result<CallToolResult, ErrorData> {
        Self::to_result(file_module::read_content_to_file(&params.path).await)
    }

    /// 写入内容到文件
    #[tool(description = "将内容写入文件（会覆盖已存在的文件）")]
    async fn file_write(
        &self,
        Parameters(params): Parameters<FileWriteParam>,
    ) -> Result<CallToolResult, ErrorData> {
        let result = file_module::save_content_to_file(&params.content, &params.file_path).await;
        let result_str = match &result {
            Ok(_) => "ok",
            Err(_) => "error",
        };
        self.audit(
            AuditEntry::new("file_write", result_str)
                .with_file_path(&params.file_path)
                .with_content_len(params.content.len()),
        );
        Self::to_result(result)
    }

    /// 列出目录中的文件和子目录
    #[tool(description = "列出指定目录中的文件和子目录名称")]
    async fn file_list(
        &self,
        Parameters(params): Parameters<FilePathParam>,
    ) -> Result<CallToolResult, ErrorData> {
        Self::to_result(file_module::read_files(&params.path).await)
    }

    /// 删除文件或目录
    #[tool(description = "删除指定的文件或目录路径列表（目录会递归删除）")]
    async fn file_delete(
        &self,
        Parameters(params): Parameters<FileDeleteParam>,
    ) -> Result<CallToolResult, ErrorData> {
        let result = file_module::delete_paths(params.paths.clone()).await;
        let result_str = match &result {
            Ok(_) => "ok",
            Err(_) => "error",
        };
        self.audit(AuditEntry::new("file_delete", result_str).with_paths(params.paths));
        Self::to_result(result)
    }

    /// 压缩文件或目录为 ZIP
    #[tool(description = "将指定文件或目录列表压缩为 ZIP 文件")]
    async fn file_compress(
        &self,
        Parameters(params): Parameters<FileCompressParam>,
    ) -> Result<CallToolResult, ErrorData> {
        let result = file_module::compress_zip(params.src_paths.clone(), &params.dst_file).await;
        let result_str = match &result {
            Ok(_) => "ok",
            Err(_) => "error",
        };
        self.audit(
            AuditEntry::new("file_compress", result_str)
                .with_paths(params.src_paths)
                .with_dst_file(&params.dst_file),
        );
        Self::to_result(result)
    }

    // ═══════════════════════════════════════════════
    // SSH 远程操作 —— 已停用（2026-08-22）
    //
    // 服务器相关入口（配置管理 + 操作）统一收归 ssh-mcp-server
    // （其 MCP 提供 list-servers / execute-command / upload / download 等工具），
    // 本工具不再直接暴露任何服务器相关接口。
    // 本区块 4 个操作工具（server_connect / remote_exec / file_upload / file_download）
    // 与下方 server_list（查询服务器列表）整体注释停用、未删除；
    // 需要恢复时取消相应注释即可（types.rs / db.rs / audit.rs 中对应
    // #[allow(dead_code)] 保留不影响）。
    // ═══════════════════════════════════════════════

    // /// 测试 SSH 连接到远程服务器
    // #[tool(description = "测试 SSH 连接到远程服务器，验证用户名和密码是否正确")]
    // async fn server_connect(&self, Parameters(params): Parameters<ServerConnectParam>) -> Result<CallToolResult, ErrorData> {
    //     Self::to_result(file_module::server_connection(&params.username, &params.password, &params.server).await)
    // }

    // /// 在远程服务器上执行 shell 命令
    // #[tool(description = "通过 SSH 在远程服务器上执行 shell 命令，返回命令输出")]
    // async fn remote_exec(&self, Parameters(params): Parameters<RemoteExecParam>) -> Result<CallToolResult, ErrorData> {
    //     let result = file_module::execute_remote_command(
    //         &params.username, &params.password, &params.server,
    //         &params.command, params.retry_count, params.retry_interval_secs,
    //     ).await;
    //     let result_str = match &result {
    //         Ok(_) => "ok",
    //         Err(_) => "error",
    //     };
    //     self.audit(
    //         AuditEntry::new("remote_exec", result_str)
    //             .with_server(&params.server)
    //             .with_command(&params.command),
    //     );
    //     Self::to_result(result)
    // }

    // /// 上传文件到远程服务器
    // #[tool(description = "通过 SFTP 将本地文件或目录上传到远程服务器")]
    // async fn file_upload(&self, Parameters(params): Parameters<FileTransferParam>) -> Result<CallToolResult, ErrorData> {
    //     let result = file_module::upload_server_files(
    //         params.remote_paths.clone(), params.local_paths.clone(),
    //         &params.username, &params.password, &params.server,
    //     ).await;
    //     let result_str = match &result {
    //         Ok(_) => "ok",
    //         Err(_) => "error",
    //     };
    //     self.audit(
    //         AuditEntry::new("file_upload", result_str)
    //             .with_server(&params.server)
    //             .with_paths(params.local_paths.clone()),
    //     );
    //     Self::to_result(result)
    // }

    // /// 从远程服务器下载文件
    // #[tool(description = "通过 SFTP 从远程服务器下载文件或目录到本地")]
    // async fn file_download(&self, Parameters(params): Parameters<FileTransferParam>) -> Result<CallToolResult, ErrorData> {
    //     let result = file_module::download_server_files(
    //         params.local_paths.clone(), params.remote_paths.clone(),
    //         &params.username, &params.password, &params.server,
    //     ).await;
    //     let result_str = match &result {
    //         Ok(_) => "ok",
    //         Err(_) => "error",
    //     };
    //     self.audit(
    //         AuditEntry::new("file_download", result_str)
    //             .with_server(&params.server)
    //             .with_paths(params.remote_paths.clone()),
    //     );
    //     Self::to_result(result)
    // }

    // ═══════════════════════════════════════════════
    // 项目构建
    // ═══════════════════════════════════════════════

    /// 解析 .sln 文件
    #[tool(description = "解析 .sln 解决方案文件，获取指定模块的编译输出路径")]
    async fn parse_sln(
        &self,
        Parameters(params): Parameters<ParseSlnParam>,
    ) -> Result<CallToolResult, ErrorData> {
        Self::to_result(
            parse_sln_module::parse_sln_project(
                &params.module_name,
                &params.sln_file_path,
                params.is_new_version,
                &params.build_mode,
            )
            .await,
        )
    }

    /// 查找 .csproj 程序集名称
    #[tool(description = "查找 .csproj 项目文件中的 AssemblyName（程序集名称）")]
    async fn find_assembly_name(
        &self,
        Parameters(params): Parameters<FindAssemblyNameParam>,
    ) -> Result<CallToolResult, ErrorData> {
        Self::to_result(parse_sln_module::find_assembly_name(&params.project_path).await)
    }

    /// 升级 WPF 模块版本号
    #[tool(description = "升级 Manifest.xml 中指定模块的版本号（第四位自增）")]
    async fn upgrade_module_version(
        &self,
        Parameters(params): Parameters<UpgradeModuleVersionParam>,
    ) -> Result<CallToolResult, ErrorData> {
        let result =
            wpf_upgrade_module::upgrade_module_version(&params.file_path, &params.module_name)
                .await;
        let result_str = match &result {
            Ok(_) => "ok",
            Err(_) => "error",
        };
        self.audit(
            AuditEntry::new("upgrade_module_version", result_str)
                .with_file_path(&params.file_path)
                .with_module_name(&params.module_name),
        );
        Self::to_result(result)
    }

    /// 复制 DLL 文件
    #[tool(description = "复制源目录中的所有 .dll 文件到目标目录")]
    async fn copy_dll_files(
        &self,
        Parameters(params): Parameters<CopyDllFilesParam>,
    ) -> Result<CallToolResult, ErrorData> {
        let result = file_module::copy_dll_files(
            &params.source_dir,
            &params.target_dir,
            params.del_destination,
        )
        .await;
        let result_str = match &result {
            Ok(_) => "ok",
            Err(_) => "error",
        };
        self.audit(
            AuditEntry::new("copy_dll_files", result_str)
                .with_source_dir(&params.source_dir)
                .with_target_dir(&params.target_dir),
        );
        Self::to_result(result)
    }

    /// 构建项目
    #[tool(description = "使用 MSBuild 构建项目（Release 模式）")]
    async fn project_build(
        &self,
        Parameters(params): Parameters<ProjectBuildParam>,
    ) -> Result<CallToolResult, ErrorData> {
        let result = file_module::build_project_release(
            &params.project_file_path,
            &params.msbuild_path,
            params.is_rebuild,
            &params.build_mode,
        )
        .await;
        let result_str = match &result {
            Ok(_) => "ok",
            Err(_) => "error",
        };
        self.audit(
            AuditEntry::new("project_build", result_str)
                .with_project_file_path(&params.project_file_path)
                .with_file_path(&params.project_file_path),
        );
        Self::to_result(result)
    }

    // ═══════════════════════════════════════════════
    // 本地命令执行
    // ═══════════════════════════════════════════════

    /// 执行本地 shell 命令
    #[tool(description = "在本地执行 shell 命令并等待完成，返回命令输出")]
    async fn local_exec(
        &self,
        Parameters(params): Parameters<LocalExecParam>,
    ) -> Result<CallToolResult, ErrorData> {
        let result = file_module::execute_local_command(
            &params.command,
            params.args.clone(),
            params.retry_count,
            params.retry_interval_secs,
        )
        .await;
        let result_str = match &result {
            Ok(_) => "ok",
            Err(_) => "error",
        };
        self.audit(
            AuditEntry::new("local_exec", result_str)
                .with_command(&params.command)
                .with_args(&params.args),
        );
        Self::to_result(result)
    }

    /// 后台执行本地命令
    #[tool(description = "在本地后台执行 shell 命令，不等待命令完成（适用于启动长期运行的程序）")]
    async fn local_exec_spawn(
        &self,
        Parameters(params): Parameters<LocalExecSpawnParam>,
    ) -> Result<CallToolResult, ErrorData> {
        let result =
            file_module::exec_local_command_spawn(&params.command, params.args.clone()).await;
        let result_str = match &result {
            Ok(_) => "ok",
            Err(_) => "error",
        };
        self.audit(
            AuditEntry::new("local_exec_spawn", result_str)
                .with_command(&params.command)
                .with_args(&params.args),
        );
        Self::to_result(result)
    }

    // ═══════════════════════════════════════════════
    // 数据库查询（Phase 2）
    // ═══════════════════════════════════════════════

    /// 查询项目列表
    #[tool(description = "查询项目列表（从本地 SQLite t_project 表），支持按关键字筛选")]
    async fn project_list(
        &self,
        Parameters(params): Parameters<ProjectListParam>,
    ) -> Result<CallToolResult, ErrorData> {
        let conn = crate::mcp::db::open_db(&self.app_handle)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let result = crate::mcp::db::query_projects(&conn, params.keyword.as_deref())
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let json = serde_json::to_value(&result)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        Ok(CallToolResult::success(vec![ContentBlock::text(
            json.to_string(),
        )]))
    }

    // 查询服务器列表 —— 已停用（服务器相关接口统一收归 ssh-mcp-server，恢复时取消注释）
    // /// 查询服务器列表
    // #[tool(description = "查询服务器列表（从本地 SQLite t_server 表），支持按项目 ID 或名称筛选")]
    // async fn server_list(&self, Parameters(params): Parameters<ServerListParam>) -> Result<CallToolResult, ErrorData> {
    //     let conn = crate::mcp::db::open_db(&self.app_handle).map_err(|e| ErrorData::internal_error(e, None))?;
    //     let result = crate::mcp::db::query_servers(&conn, params.project_id, params.name.as_deref())
    //         .map_err(|e| ErrorData::internal_error(e, None))?;
    //     let json = serde_json::to_value(&result)
    //         .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
    //     Ok(CallToolResult::success(vec![ContentBlock::text(json.to_string())]))
    // }

    /// 查询应用配置列表
    #[tool(description = "查询应用配置列表（从本地 SQLite t_app_config 表），支持按项目 ID 筛选")]
    async fn appconfig_list(
        &self,
        Parameters(params): Parameters<AppConfigListParam>,
    ) -> Result<CallToolResult, ErrorData> {
        let conn = crate::mcp::db::open_db(&self.app_handle)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let result = crate::mcp::db::query_app_configs(&conn, params.project_id)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let json = serde_json::to_value(&result)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        Ok(CallToolResult::success(vec![ContentBlock::text(
            json.to_string(),
        )]))
    }

    /// 修改应用配置的 TFS 变更集开始值/结束值
    ///
    /// 仅支持 dll_mode=TFS 且 selectModel=变更集 的应用配置。start_value/end_value
    /// 至少传一个；只传一个时仅更新对应值，另一个保持不变。返回更新后的完整应用配置。
    #[tool(
        description = "修改应用配置的 TFS 变更集开始值/结束值（start_value/end_value 至少传一个）"
    )]
    async fn appconfig_update_changeset(
        &self,
        Parameters(params): Parameters<AppConfigUpdateChangesetParam>,
    ) -> Result<CallToolResult, ErrorData> {
        if params.start_value.is_none() && params.end_value.is_none() {
            return Err(ErrorData::invalid_params(
                "start_value 和 end_value 至少传一个",
                None,
            ));
        }
        if params.start_value.as_deref() == Some("") {
            return Err(ErrorData::invalid_params(
                "start_value 不能为空（变更集开始值必填）",
                None,
            ));
        }

        let conn = crate::mcp::db::open_db(&self.app_handle)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let result = crate::mcp::db::update_appconfig_changeset(
            &conn,
            params.id,
            params.start_value.as_deref(),
            params.end_value.as_deref(),
        )
        .map_err(|e| ErrorData::internal_error(e, None))?;

        self.audit(
            AuditEntry::new("appconfig_update_changeset", "ok").with_file_path(&format!(
                "appconfig_id={},start_value={},end_value={}",
                params.id,
                params.start_value.as_deref().unwrap_or(""),
                params.end_value.as_deref().unwrap_or("")
            )),
        );

        let json = serde_json::to_value(&result)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        Ok(CallToolResult::success(vec![ContentBlock::text(
            json.to_string(),
        )]))
    }

    /// 查询 TFS 配置列表
    #[tool(description = "查询 TFS 版本控制配置列表（从本地 SQLite t_team_foundation_server 表）")]
    async fn tfs_config_list(&self) -> Result<CallToolResult, ErrorData> {
        let conn = crate::mcp::db::open_db(&self.app_handle)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let result = crate::mcp::db::query_tfs_configs(&conn)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let json = serde_json::to_value(&result)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        Ok(CallToolResult::success(vec![ContentBlock::text(
            json.to_string(),
        )]))
    }

    /// 查询 Git 配置列表
    #[tool(description = "查询 Git 配置列表（从本地 SQLite t_git 表）")]
    async fn git_config_list(&self) -> Result<CallToolResult, ErrorData> {
        let conn = crate::mcp::db::open_db(&self.app_handle)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let result = crate::mcp::db::query_git_configs(&conn)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let json = serde_json::to_value(&result)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        Ok(CallToolResult::success(vec![ContentBlock::text(
            json.to_string(),
        )]))
    }

    /// 查询备份记录列表
    #[tool(description = "查询备份记录列表（从本地 SQLite t_backup 表），支持按项目 ID 筛选")]
    async fn backup_list(
        &self,
        Parameters(params): Parameters<BackupListParam>,
    ) -> Result<CallToolResult, ErrorData> {
        let conn = crate::mcp::db::open_db(&self.app_handle)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let result = crate::mcp::db::query_backups(&conn, params.project_id)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let json = serde_json::to_value(&result)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        Ok(CallToolResult::success(vec![ContentBlock::text(
            json.to_string(),
        )]))
    }

    /// 创建备份记录
    #[tool(description = "创建备份记录（写入本地 SQLite t_backup 表）")]
    async fn backup_create(
        &self,
        Parameters(params): Parameters<BackupCreateParam>,
    ) -> Result<CallToolResult, ErrorData> {
        let conn = crate::mcp::db::open_db(&self.app_handle)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let new_id = crate::mcp::db::create_backup(
            &conn,
            params.project_id,
            &params.project_name,
            params.environment,
            params.remark.as_deref(),
            &params.backup_items_json,
        )
        .map_err(|e| ErrorData::internal_error(e, None))?;
        // 审计日志
        self.audit(
            AuditEntry::new("backup_create", "ok").with_file_path(&format!(
                "project_id={},project_name={}",
                params.project_id, params.project_name
            )),
        );
        Ok(CallToolResult::success(vec![ContentBlock::text(
            serde_json::json!({"id": new_id}).to_string(),
        )]))
    }

    /// 查询还原记录列表
    #[tool(description = "查询还原记录列表（从本地 SQLite t_restore 表），支持按备份 ID 筛选")]
    async fn backup_restore_list(
        &self,
        Parameters(params): Parameters<RestoreListParam>,
    ) -> Result<CallToolResult, ErrorData> {
        let conn = crate::mcp::db::open_db(&self.app_handle)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let result = crate::mcp::db::query_restores(&conn, params.backup_id)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let json = serde_json::to_value(&result)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        Ok(CallToolResult::success(vec![ContentBlock::text(
            json.to_string(),
        )]))
    }

    // ═══════════════════════════════════════════════
    // MCP 配置管理（Phase 3）
    // ═══════════════════════════════════════════════

    /// 获取或设置 MCP 配置
    ///
    /// 无参数时返回当前 MCP 配置；传 mcp_enabled/mcp_port 时写入 config.json，
    /// 并立即重启/停止 MCP 服务使新配置生效。
    #[tool(description = "获取或设置 MCP 配置（mcp_enabled/mcp_port）。修改后立即生效")]
    async fn mcp_config(
        &self,
        Parameters(params): Parameters<McpConfigParam>,
    ) -> Result<CallToolResult, ErrorData> {
        // 如果有参数，先写入 config.json
        if params.mcp_enabled.is_some() || params.mcp_port.is_some() {
            crate::config::update_mcp_config(&self.app_handle, params.mcp_enabled, params.mcp_port)
                .map_err(|e| ErrorData::internal_error(e, None))?;
            crate::mcp::manager::apply(&self.app_handle);
        }
        // 读取当前配置返回
        let cfg = crate::config::load(&self.app_handle);
        let json = serde_json::to_value(&cfg.mcp)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        Ok(CallToolResult::success(vec![ContentBlock::text(
            json.to_string(),
        )]))
    }

    // ═══════════════════════════════════════════════
    // 定时发布（Phase 4）
    // ═══════════════════════════════════════════════

    /// 查询定时发布任务列表
    #[tool(
        description = "查询定时发布任务列表（从本地 SQLite t_publish_schedule 表），支持按项目 ID 和状态筛选"
    )]
    async fn schedule_list(
        &self,
        Parameters(params): Parameters<ScheduleListParam>,
    ) -> Result<CallToolResult, ErrorData> {
        let conn = crate::mcp::db::open_db(&self.app_handle)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let result =
            crate::mcp::db::query_schedules(&conn, params.project_id, params.status.as_deref())
                .map_err(|e| ErrorData::internal_error(e, None))?;
        let json = serde_json::to_value(&result)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        Ok(CallToolResult::success(vec![ContentBlock::text(
            json.to_string(),
        )]))
    }

    /// 按 ID 查询单个定时发布任务
    #[tool(description = "按 ID 查询单个定时发布任务（从本地 SQLite t_publish_schedule 表）")]
    async fn schedule_get_by_id(
        &self,
        Parameters(params): Parameters<ScheduleIdParam>,
    ) -> Result<CallToolResult, ErrorData> {
        let conn = crate::mcp::db::open_db(&self.app_handle)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let result = crate::mcp::db::query_schedule_by_id(&conn, params.id)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let json = serde_json::to_value(&result)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        Ok(CallToolResult::success(vec![ContentBlock::text(
            json.to_string(),
        )]))
    }

    /// 查询所有待执行的定时发布任务
    #[tool(description = "查询所有待执行的定时发布任务（status = 'pending'，按计划时间升序）")]
    async fn pending_schedule_list(&self) -> Result<CallToolResult, ErrorData> {
        let conn = crate::mcp::db::open_db(&self.app_handle)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let result = crate::mcp::db::query_pending_schedules(&conn)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let json = serde_json::to_value(&result)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        Ok(CallToolResult::success(vec![ContentBlock::text(
            json.to_string(),
        )]))
    }

    /// 创建定时发布任务
    #[tool(description = "创建定时发布任务（写入本地 SQLite t_publish_schedule 表）")]
    async fn schedule_create(
        &self,
        Parameters(params): Parameters<ScheduleCreateParam>,
    ) -> Result<CallToolResult, ErrorData> {
        // 参数校验
        if params.project_id <= 0 {
            return Err(ErrorData::invalid_params("project_id 必须大于 0", None));
        }
        if params.scheduled_time.is_empty() {
            return Err(ErrorData::invalid_params("scheduled_time 不能为空", None));
        }
        if params.publish_type != "一键发布" && params.publish_type != "手动发布" {
            return Err(ErrorData::invalid_params(
                "publish_type 仅接受 \"一键发布\" 或 \"手动发布\"",
                None,
            ));
        }

        let conn = crate::mcp::db::open_db(&self.app_handle)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let new_id = crate::mcp::db::create_schedule(
            &conn,
            params.project_id,
            &params.project_name,
            params.environment,
            params.appconfig_id,
            &params.publish_type,
            &params.scheduled_time,
        )
        .map_err(|e| ErrorData::internal_error(e, None))?;

        // 审计日志
        self.audit(
            AuditEntry::new("schedule_create", "ok").with_file_path(&format!(
                "project_id={},scheduled_time={}",
                params.project_id, params.scheduled_time
            )),
        );

        Ok(CallToolResult::success(vec![ContentBlock::text(
            serde_json::json!({"id": new_id}).to_string(),
        )]))
    }

    /// 取消定时发布任务
    #[tool(description = "取消定时发布任务（仅允许取消 pending 状态的任务）")]
    async fn schedule_cancel(
        &self,
        Parameters(params): Parameters<ScheduleIdParam>,
    ) -> Result<CallToolResult, ErrorData> {
        let conn = crate::mcp::db::open_db(&self.app_handle)
            .map_err(|e| ErrorData::internal_error(e, None))?;

        // 状态校验：仅 pending 可取消
        let status = crate::mcp::db::get_schedule_status(&conn, params.id)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        if status != "pending" {
            return Err(ErrorData::invalid_params(
                format!("任务状态为 {}，不能取消（仅 pending 可取消）", status),
                None,
            ));
        }

        crate::mcp::db::cancel_schedule(&conn, params.id)
            .map_err(|e| ErrorData::internal_error(e, None))?;

        // 返回更新后的任务记录
        let updated = crate::mcp::db::query_schedule_by_id(&conn, params.id)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let json = serde_json::to_value(&updated)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;

        // 审计日志
        self.audit(
            AuditEntry::new("schedule_cancel", "ok")
                .with_file_path(&format!("schedule_id={}", params.id)),
        );

        Ok(CallToolResult::success(vec![ContentBlock::text(
            json.to_string(),
        )]))
    }

    /// 修改定时发布任务的计划执行时间
    #[tool(description = "修改定时发布任务的计划执行时间（仅允许修改 pending 状态的任务）")]
    async fn schedule_update_time(
        &self,
        Parameters(params): Parameters<ScheduleUpdateTimeParam>,
    ) -> Result<CallToolResult, ErrorData> {
        let conn = crate::mcp::db::open_db(&self.app_handle)
            .map_err(|e| ErrorData::internal_error(e, None))?;

        // 状态校验：仅 pending 可修改
        let status = crate::mcp::db::get_schedule_status(&conn, params.id)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        if status != "pending" {
            return Err(ErrorData::invalid_params(
                format!("任务状态为 {}，不能修改时间（仅 pending 可修改）", status),
                None,
            ));
        }

        crate::mcp::db::update_schedule_time(&conn, params.id, &params.scheduled_time)
            .map_err(|e| ErrorData::internal_error(e, None))?;

        // 返回更新后的任务记录
        let updated = crate::mcp::db::query_schedule_by_id(&conn, params.id)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let json = serde_json::to_value(&updated)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;

        Ok(CallToolResult::success(vec![ContentBlock::text(
            json.to_string(),
        )]))
    }

    /// 删除定时发布任务
    #[tool(description = "删除定时发布任务")]
    async fn schedule_delete(
        &self,
        Parameters(params): Parameters<ScheduleIdParam>,
    ) -> Result<CallToolResult, ErrorData> {
        let conn = crate::mcp::db::open_db(&self.app_handle)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        crate::mcp::db::delete_schedule(&conn, params.id)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        Ok(CallToolResult::success(vec![ContentBlock::text(
            serde_json::json!({"id": params.id}).to_string(),
        )]))
    }
}

#[::rmcp::tool_handler(router = Self::tool_router())]
impl ::rmcp::ServerHandler for McpHandler {
    /// 手写 list_tools：补上 2026-07-28 协议强制要求的 ttl_ms / cache_scope，
    /// 否则由 #[tool_handler] 宏生成的默认值 None 会被严格客户端整体拒绝
    /// （见 rmcp issue #1114）。
    /// ttl_ms=0 表示“立即失效、不缓存”，cache_scope=Private，
    /// 符合本服务返回动态数据、不做结果缓存 的语义。
    async fn list_tools(
        &self,
        _request: Option<rmcp::model::PaginatedRequestParams>,
        _context: rmcp::service::RequestContext<rmcp::RoleServer>,
    ) -> Result<rmcp::model::ListToolsResult, rmcp::ErrorData> {
        Ok(
            rmcp::model::ListToolsResult::with_all_items(Self::tool_router().list_all())
                .with_ttl_ms(0)
                .with_cache_scope(rmcp::model::CacheScope::Private),
        )
    }
}

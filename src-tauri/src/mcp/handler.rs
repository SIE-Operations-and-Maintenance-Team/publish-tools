use crate::mcp::audit::{AuditEntry, AuditLogger};
use crate::mcp::bridge;
use crate::mcp::types::*;
use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::{CallToolResult, ContentBlock};
use rmcp::ErrorData;
use rmcp::{tool, tool_router};
use std::sync::{Arc, Mutex};

/// MCP 处理器：只暴露发布平台的功能操作（定时发布直接读写数据库）
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

    /// 记录写入类操作的审计日志
    fn audit(&self, entry: AuditEntry) {
        if let Some(ref logger) = self.audit_logger {
            if let Ok(logger) = logger.lock() {
                let _ = logger.log(&entry);
            }
        }
    }

    /// 解析动作要使用的应用配置：
    /// appconfig_id 优先；其次 project_id + environment；都没有则返回 None（前端使用界面当前选择）
    fn resolve_appconfig(
        &self,
        params: &PublishActionParam,
    ) -> Result<Option<serde_json::Value>, ErrorData> {
        if params.appconfig_id.is_none() && params.project_id.is_none() {
            return Ok(None);
        }

        let conn = crate::mcp::db::open_db(&self.app_handle)
            .map_err(|e| ErrorData::internal_error(e, None))?;

        if let Some(id) = params.appconfig_id {
            let list = crate::mcp::db::query_app_configs_for_action(&conn, None)
                .map_err(|e| ErrorData::internal_error(e, None))?;
            return match list
                .into_iter()
                .find(|v| v.get("id").and_then(|x| x.as_i64()) == Some(id))
            {
                Some(v) => Ok(Some(v)),
                None => Err(ErrorData::invalid_params(
                    format!("应用配置 {id} 不存在"),
                    None,
                )),
            };
        }

        let project_id = params.project_id.unwrap_or(0);
        let environment = params.environment.unwrap_or(1);
        let list = crate::mcp::db::query_app_configs_for_action(&conn, Some(project_id))
            .map_err(|e| ErrorData::internal_error(e, None))?;
        match list
            .into_iter()
            .find(|v| v.get("environment").and_then(|x| x.as_i64()) == Some(environment))
        {
            Some(v) => Ok(Some(v)),
            None => Err(ErrorData::invalid_params(
                format!("项目 {project_id} 在环境 {environment} 下没有应用配置"),
                None,
            )),
        }
    }

    /// 派发动作给前端并等待结果
    async fn dispatch_action(
        &self,
        action: &str,
        params: &PublishActionParam,
        timeout_secs: u64,
    ) -> Result<CallToolResult, ErrorData> {
        let appconfig = self.resolve_appconfig(params)?;
        match bridge::dispatch(&self.app_handle, action, appconfig, timeout_secs).await {
            Ok(result) => {
                let text = serde_json::json!({
                    "success": result.success,
                    "message": result.message
                })
                .to_string();
                Ok(CallToolResult::success(vec![ContentBlock::text(text)]))
            }
            Err(e) => Err(ErrorData::internal_error(e, None)),
        }
    }
}

#[tool_router]
impl McpHandler {
    // ═══════════════════════════════════════════════
    // 发布平台功能操作
    // ═══════════════════════════════════════════════

    /// 一键发布
    #[tool(
        description = "一键发布：获取最新代码 → 编译 → 获取程序集 → 发布前备份 → 发布到服务器。可选 appconfig_id，或 project_id + environment；都不传则使用界面当前选中的配置。返回执行结果与失败原因"
    )]
    async fn one_click_publish(
        &self,
        Parameters(params): Parameters<PublishActionParam>,
    ) -> Result<CallToolResult, ErrorData> {
        self.dispatch_action("oneClickPublish", &params, 3600).await
    }

    /// 获取最新代码
    #[tool(
        description = "获取最新代码：按应用配置的获取dll方式，对 TFS 本地根目录执行 tf get、对 Git 仓库执行 git pull。运行前会询问本地未提交修改的处理"
    )]
    async fn pull_latest_code(
        &self,
        Parameters(params): Parameters<PublishActionParam>,
    ) -> Result<CallToolResult, ErrorData> {
        self.dispatch_action("pullLatestCode", &params, 600).await
    }

    /// 编译项目
    #[tool(
        description = "编译项目：使用应用配置里的 MsBuild 路径编译各模块（Release/Debug 按配置）"
    )]
    async fn build_projects(
        &self,
        Parameters(params): Parameters<PublishActionParam>,
    ) -> Result<CallToolResult, ErrorData> {
        self.dispatch_action("buildProjects", &params, 1800).await
    }

    /// 获取程序集
    #[tool(description = "获取程序集：按应用配置的获取dll方式，把编译输出复制到发布目录")]
    async fn get_application_assemblys(
        &self,
        Parameters(params): Parameters<PublishActionParam>,
    ) -> Result<CallToolResult, ErrorData> {
        self.dispatch_action("getApplicationAssemblys", &params, 1800).await
    }

    /// 手动发布
    #[tool(description = "手动发布：获取程序集 → 发布前备份 → 发布到服务器（不编译）")]
    async fn manual_publish(
        &self,
        Parameters(params): Parameters<PublishActionParam>,
    ) -> Result<CallToolResult, ErrorData> {
        self.dispatch_action("manualPublish", &params, 3600).await
    }

    // ═══════════════════════════════════════════════
    // 定时发布（原有工具，保留）
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

        let updated = crate::mcp::db::query_schedule_by_id(&conn, params.id)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let json = serde_json::to_value(&updated)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;

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

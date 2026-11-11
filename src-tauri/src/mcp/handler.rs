use crate::mcp::audit::{AuditEntry, AuditLogger};
use crate::mcp::types::*;
use crate::mcp::{db, queue};
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

    /// 把动作提交到发布队列，立即返回任务号（不等待执行结果）
    ///
    /// 队列是进程级唯一的串行点：多个会话同时提交时按顺序执行，
    /// 调用方拿到 job_id 后用 publish_status 查询进度与结果。
    fn enqueue_action(
        &self,
        action: &str,
        params: &PublishActionParam,
        backup: Option<serde_json::Value>,
    ) -> Result<CallToolResult, ErrorData> {
        let appconfig = self.resolve_appconfig(params)?;
        let submitted = queue::submit(action, appconfig, backup, "mcp")
            .map_err(|e| ErrorData::internal_error(e, None))?;

        let message = if submitted.queued_ahead > 0 {
            format!(
                "已提交，前面还有 {} 个任务，将按顺序执行",
                submitted.queued_ahead
            )
        } else {
            "已提交，即将开始执行".to_string()
        };
        let text = serde_json::json!({
            "job_id": submitted.job_id,
            "status": "queued",
            "queued_ahead": submitted.queued_ahead,
            "message": message
        })
        .to_string();
        Ok(CallToolResult::success(vec![ContentBlock::text(text)]))
    }
}

#[tool_router]
impl McpHandler {
    // ═══════════════════════════════════════════════
    // 发布平台功能操作
    // ═══════════════════════════════════════════════

    /// 一键发布
    #[tool(
        description = "一键发布（提交到发布队列）：获取最新代码 → 编译 → 获取程序集 → 发布前备份 → 发布到服务器，作为一个任务排入队列，立即返回 job_id；多会话并发提交时按顺序串行执行。可选 appconfig_id，或 project_id + environment；都不传则使用界面当前选中的配置。用 publish_status 查询进度与结果"
    )]
    async fn one_click_publish(
        &self,
        Parameters(params): Parameters<PublishActionParam>,
    ) -> Result<CallToolResult, ErrorData> {
        self.enqueue_action("oneClickPublish", &params, None)
    }

    /// 获取最新代码
    #[tool(
        description = "获取最新代码（提交到发布队列）：按应用配置的获取dll方式，对 TFS 本地根目录执行 tf get、对 Git 仓库执行 git pull。立即返回 job_id，用 publish_status 查询结果"
    )]
    async fn pull_latest_code(
        &self,
        Parameters(params): Parameters<PublishActionParam>,
    ) -> Result<CallToolResult, ErrorData> {
        self.enqueue_action("pullLatestCode", &params, None)
    }

    /// 编译项目
    #[tool(
        description = "编译项目（提交到发布队列）：使用应用配置里的 MsBuild 路径编译各模块（Release/Debug 按配置）。立即返回 job_id，用 publish_status 查询结果"
    )]
    async fn build_projects(
        &self,
        Parameters(params): Parameters<PublishActionParam>,
    ) -> Result<CallToolResult, ErrorData> {
        self.enqueue_action("buildProjects", &params, None)
    }

    /// 获取程序集
    #[tool(
        description = "获取程序集（提交到发布队列）：按应用配置的获取dll方式，把编译输出复制到发布目录。立即返回 job_id，用 publish_status 查询结果"
    )]
    async fn get_application_assemblys(
        &self,
        Parameters(params): Parameters<PublishActionParam>,
    ) -> Result<CallToolResult, ErrorData> {
        self.enqueue_action("getApplicationAssemblys", &params, None)
    }

    /// 手动发布
    #[tool(
        description = "手动发布（提交到发布队列）：获取程序集 → 发布前备份 → 发布到服务器（不编译）。立即返回 job_id，用 publish_status 查询结果"
    )]
    async fn manual_publish(
        &self,
        Parameters(params): Parameters<PublishActionParam>,
    ) -> Result<CallToolResult, ErrorData> {
        self.enqueue_action("manualPublish", &params, None)
    }

    /// 还原备份记录
    #[tool(
        description = "还原备份记录（提交到发布队列）：把备份文件还原回服务器部署目录并重启服务（会先停止服务、覆盖部署目录文件、再启动服务，属高危操作）。可用 backup_id 指定备份记录，或用 project_id + environment 取该项目环境下最新一条备份。立即返回 job_id，用 publish_status 查询结果"
    )]
    async fn restore_backup(
        &self,
        Parameters(params): Parameters<RestoreBackupParam>,
    ) -> Result<CallToolResult, ErrorData> {
        let (backup_id, backup) = {
            let conn = crate::mcp::db::open_db(&self.app_handle)
                .map_err(|e| ErrorData::internal_error(e, None))?;

            let record = match params.backup_id {
                Some(id) => crate::mcp::db::query_backup_by_id(&conn, id)
                    .map_err(|e| ErrorData::internal_error(e, None))?
                    .ok_or_else(|| {
                        ErrorData::invalid_params(format!("备份记录 {id} 不存在"), None)
                    })?,
                None => {
                    let project_id = params.project_id.ok_or_else(|| {
                        ErrorData::invalid_params(
                            "需要提供 backup_id，或 project_id + environment",
                            None,
                        )
                    })?;
                    let environment = params.environment.unwrap_or(1);
                    crate::mcp::db::query_latest_backup(&conn, project_id, environment)
                        .map_err(|e| ErrorData::internal_error(e, None))?
                        .ok_or_else(|| {
                            ErrorData::invalid_params(
                                format!("项目 {project_id} 在环境 {environment} 下没有备份记录"),
                                None,
                            )
                        })?
                }
            };

            let id = record.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
            (id, record)
        };

        let submitted = queue::submit("restoreBackup", None, Some(backup), "mcp")
            .map_err(|e| ErrorData::internal_error(e, None))?;

        self.audit(
            AuditEntry::new("restore_backup", "queued").with_file_path(&format!(
                "backup_id={backup_id},job_id={}",
                submitted.job_id
            )),
        );

        let text = serde_json::json!({
            "job_id": submitted.job_id,
            "status": "queued",
            "queued_ahead": submitted.queued_ahead,
            "backup_id": backup_id,
            "message": "已提交到发布队列，用 publish_status 查询进度与结果"
        })
        .to_string();
        Ok(CallToolResult::success(vec![ContentBlock::text(text)]))
    }

    // ═══════════════════════════════════════════════
    // 发布任务队列（提交后可随时查询）
    // ═══════════════════════════════════════════════

    /// 查询发布任务状态
    #[tool(
        description = "查询发布任务状态：用 job_id 精确查询，或用 project_id + environment 取该项目环境下最近一条任务。返回 status（queued/running/succeeded/failed/canceled/interrupted）、时间线、前面排队数与失败原因；running 时附带当前阶段"
    )]
    async fn publish_status(
        &self,
        Parameters(params): Parameters<PublishJobStatusParam>,
    ) -> Result<CallToolResult, ErrorData> {
        let conn = db::open_db(&self.app_handle)
            .map_err(|e| ErrorData::internal_error(e, None))?;

        let job = match params.job_id {
            Some(id) => db::query_job_by_id(&conn, id)
                .map_err(|e| ErrorData::internal_error(e, None))?
                .ok_or_else(|| ErrorData::invalid_params(format!("任务 {id} 不存在"), None))?,
            None => {
                let project_id = params.project_id.ok_or_else(|| {
                    ErrorData::invalid_params("需要提供 job_id，或 project_id", None)
                })?;
                db::query_latest_job(&conn, project_id, params.environment)
                    .map_err(|e| ErrorData::internal_error(e, None))?
                    .ok_or_else(|| ErrorData::invalid_params("该项目下没有发布任务记录", None))?
            }
        };

        let status = job
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let job_id = job.get("id").and_then(|v| v.as_i64());
        let project_id = job.get("project_id").and_then(|v| v.as_i64());
        let environment = job.get("environment").and_then(|v| v.as_i64());

        let mut result = serde_json::json!({ "job": job });
        if status == "queued" {
            if let Some(id) = job_id {
                let ahead = db::count_queued_ahead(&conn, id)
                    .map_err(|e| ErrorData::internal_error(e, None))?;
                result["queued_ahead"] = serde_json::json!(ahead);
            }
        }
        if status == "running" {
            // 当前阶段由前端台账记录，取不到不算错误
            if let Ok(Some(record)) = db::query_latest_publish_record(&conn, project_id, environment)
            {
                result["stage"] = record.get("stage_json").cloned().unwrap_or_default();
            }
        }

        Ok(CallToolResult::success(vec![ContentBlock::text(
            result.to_string(),
        )]))
    }

    /// 查询发布队列
    #[tool(description = "查询发布队列：列出排队中（queued）与执行中（running）的任务，按提交顺序")]
    async fn publish_queue(&self) -> Result<CallToolResult, ErrorData> {
        let conn = db::open_db(&self.app_handle)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let jobs = db::query_active_jobs(&conn).map_err(|e| ErrorData::internal_error(e, None))?;
        let count = jobs.len();
        Ok(CallToolResult::success(vec![ContentBlock::text(
            serde_json::json!({ "count": count, "jobs": jobs }).to_string(),
        )]))
    }

    /// 取消发布任务
    #[tool(
        description = "取消发布任务：排队中（queued）的直接撤销；执行中（running）的发出中止请求，界面会在下一个检查点停止，任务最终记为 canceled；已结束的任务无法取消"
    )]
    async fn publish_cancel(
        &self,
        Parameters(params): Parameters<PublishJobIdParam>,
    ) -> Result<CallToolResult, ErrorData> {
        let outcome =
            queue::cancel(params.job_id).map_err(|e| ErrorData::internal_error(e, None))?;

        if outcome.canceled_queued || outcome.stop_requested {
            self.audit(
                AuditEntry::new(
                    "publish_cancel",
                    if outcome.canceled_queued {
                        "queued"
                    } else {
                        "stopping"
                    },
                )
                .with_file_path(&format!("job_id={}", params.job_id)),
            );
        }

        let (canceled, message) = if outcome.canceled_queued {
            (true, "已取消排队中的任务")
        } else if outcome.stop_requested {
            (
                true,
                "已发出中止请求，界面将在下一个检查点停止，任务最终状态为 canceled",
            )
        } else {
            (false, "任务不在排队中或执行中，无法取消（可能已结束）")
        };

        Ok(CallToolResult::success(vec![ContentBlock::text(
            serde_json::json!({
                "job_id": params.job_id,
                "canceled": canceled,
                "message": message
            })
            .to_string(),
        )]))
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

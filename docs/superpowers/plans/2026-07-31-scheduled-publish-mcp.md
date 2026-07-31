# Scheduled Publish MCP Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7 MCP tools for managing scheduled publish tasks, following the existing `src-tauri/src/mcp/` three-layer architecture.

**Architecture:** Add parameter structs to `types.rs`, SQL query functions to `db.rs`, and `#[tool]` handler methods to `handler.rs` — mirroring the existing `backup_list` / `backup_create` / `backup_restore_list` pattern exactly.

**Tech Stack:** Rust (Tauri 2.0), rmcp (MCP framework), rusqlite (SQLite), serde_json

## Global Constraints

- 遵循现有 `{domain}_{action}` 工具命名模式，避免 `get_` 前缀
- `publish_type` 仅接受 `"一键发布"` 或 `"手动发布"`，否则返回 `ErrorData::invalid_params`
- `schedule_cancel` 和 `schedule_update_time` 仅允许 `pending` 状态任务，非 pending 返回明确错误信息
- `schedule_create` 和 `schedule_cancel` 写入审计日志，其余操作不写
- 不修改前端、不修改 `t_publish_schedule` 表结构、不实现自动执行

---
````

### Task 1: Add parameter structs to `types.rs`

**Files:**
- Modify: `src-tauri/src/mcp/types.rs`

**Interfaces:**
- Produces: `ScheduleListParam`, `ScheduleIdParam`, `ScheduleCreateParam`, `ScheduleUpdateTimeParam` — used by Task 2 handler methods

在 `RestoreListParam` 之后、`McpConfigParam` 之前插入 4 个参数结构体：

- [ ] **Step 1: Add schedule parameter structs**

在 `src-tauri/src/mcp/types.rs` 的 `RestoreListParam` 之后插入：

```rust
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
```

注意：必须在 `// ── MCP 配置参数（Phase 3）──` 注释块之前插入。

- [ ] **Step 2: Verify compilation**

```bash
cd src-tauri && cargo check 2>&1
```

Expected: 编译成功（只有新增结构体定义，无调用者，不会引入错误）。

- [ ] **Step 3: Commit**

```bash
cd D:\develop\Rex.SmomPublish-master
git add -f src-tauri/src/mcp/types.rs
git commit -m "feat(mcp): add schedule parameter structs for Phase 4"
```

````

### Task 2: Add database query functions to `db.rs`

**Files:**
- Modify: `src-tauri/src/mcp/db.rs`

**Interfaces:**
- Consumes: `ScheduleListParam`, `ScheduleIdParam`, `ScheduleCreateParam`, `ScheduleUpdateTimeParam` (from Task 1 types.rs — but db.rs functions take primitive params, not the structs directly)
- Produces: `query_schedules`, `query_schedule_by_id`, `query_pending_schedules`, `create_schedule`, `get_schedule_status`, `cancel_schedule`, `update_schedule_time`, `delete_schedule` — used by Task 3 handler

在 `query_restores` 函数之后追加 8 个定时发布查询函数：

- [ ] **Step 1: Add schedule query functions to `db.rs`**

在 `src-tauri/src/mcp/db.rs` 末尾（`query_restores` 函数闭合花括号之后）追加：

```rust
// ── 定时发布查询（Phase 4）──

/// 查询定时发布任务列表（t_publish_schedule），支持按 project_id 和 status 筛选
pub fn query_schedules(
    conn: &Connection,
    project_id: Option<i64>,
    status: Option<&str>,
) -> Result<Vec<Value>, String> {
    let mut conditions: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(pid) = project_id {
        conditions.push(format!("project_id = ?{}", params.len() + 1));
        params.push(Box::new(pid));
    }
    if let Some(s) = status {
        conditions.push(format!("status = ?{}", params.len() + 1));
        params.push(Box::new(s.to_string()));
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let sql = format!(
        "SELECT id, project_id, project_name, environment, appconfig_id, publish_type, \
         scheduled_time, status, create_time, execute_time, result_log \
         FROM t_publish_schedule {} ORDER BY scheduled_time DESC",
        where_clause
    );
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    rows_to_json(conn, &sql, &param_refs)
}

/// 按 ID 查询单条定时发布任务
pub fn query_schedule_by_id(conn: &Connection, id: i64) -> Result<Value, String> {
    let mut results = rows_to_json(
        conn,
        "SELECT id, project_id, project_name, environment, appconfig_id, publish_type, \
         scheduled_time, status, create_time, execute_time, result_log \
         FROM t_publish_schedule WHERE id = ?1",
        &[&id],
    )?;
    if results.is_empty() {
        Err(format!("定时任务 id={} 不存在", id))
    } else {
        Ok(results.remove(0))
    }
}

/// 查询所有待执行的定时发布任务（status = 'pending'，按 scheduled_time 升序）
pub fn query_pending_schedules(conn: &Connection) -> Result<Vec<Value>, String> {
    rows_to_json(
        conn,
        "SELECT id, project_id, project_name, environment, appconfig_id, publish_type, \
         scheduled_time, status, create_time, execute_time, result_log \
         FROM t_publish_schedule WHERE status = 'pending' ORDER BY scheduled_time ASC",
        &[],
    )
}

/// 创建定时发布任务，返回新插入的 ID
pub fn create_schedule(
    conn: &Connection,
    project_id: i64,
    project_name: &str,
    environment: i64,
    appconfig_id: i64,
    publish_type: &str,
    scheduled_time: &str,
) -> Result<i64, String> {
    conn.execute(
        "INSERT INTO t_publish_schedule \
         (project_id, project_name, environment, appconfig_id, publish_type, scheduled_time, status, create_time) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending', datetime('now', 'localtime'))",
        params![project_id, project_name, environment, appconfig_id, publish_type, scheduled_time],
    )
    .map_err(|e| format!("创建定时发布任务失败: {e}"))?;

    Ok(conn.last_insert_rowid())
}

/// 获取定时任务当前状态（用于 handler 层状态校验）
pub fn get_schedule_status(conn: &Connection, id: i64) -> Result<String, String> {
    let mut results = rows_to_json(
        conn,
        "SELECT status FROM t_publish_schedule WHERE id = ?1",
        &[&id],
    )?;
    if results.is_empty() {
        Err(format!("定时任务 id={} 不存在", id))
    } else {
        results[0]["status"]
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| "无法读取任务状态".to_string())
    }
}

/// 取消定时任务（设置 status = 'cancelled'，记录 execute_time）
pub fn cancel_schedule(conn: &Connection, id: i64) -> Result<(), String> {
    let affected = conn
        .execute(
            "UPDATE t_publish_schedule SET status = 'cancelled', execute_time = datetime('now', 'localtime') WHERE id = ?1",
            params![id],
        )
        .map_err(|e| format!("取消定时任务失败: {e}"))?;
    if affected == 0 {
        Err(format!("定时任务 id={} 不存在", id))
    } else {
        Ok(())
    }
}

/// 更新定时任务的计划执行时间
pub fn update_schedule_time(conn: &Connection, id: i64, scheduled_time: &str) -> Result<(), String> {
    let affected = conn
        .execute(
            "UPDATE t_publish_schedule SET scheduled_time = ?1 WHERE id = ?2",
            params![scheduled_time, id],
        )
        .map_err(|e| format!("更新定时任务时间失败: {e}"))?;
    if affected == 0 {
        Err(format!("定时任务 id={} 不存在", id))
    } else {
        Ok(())
    }
}

/// 删除定时任务
pub fn delete_schedule(conn: &Connection, id: i64) -> Result<(), String> {
    let affected = conn
        .execute("DELETE FROM t_publish_schedule WHERE id = ?1", params![id])
        .map_err(|e| format!("删除定时任务失败: {e}"))?;
    if affected == 0 {
        Err(format!("定时任务 id={} 不存在", id))
    } else {
        Ok(())
    }
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd src-tauri && cargo check 2>&1
```

Expected: 编译成功。新增函数未被调用，不会引入错误。

- [ ] **Step 3: Commit**

```bash
cd D:\develop\Rex.SmomPublish-master
git add -f src-tauri/src/mcp/db.rs
git commit -m "feat(mcp): add schedule database query functions for Phase 4"
```

````

### Task 3: Add MCP tool handlers to `handler.rs`

**Files:**
- Modify: `src-tauri/src/mcp/handler.rs`

**Interfaces:**
- Consumes: All types from Task 1, all db functions from Task 2
- Produces: 7 MCP tools — `schedule_list`, `schedule_get_by_id`, `pending_schedule_list`, `schedule_create`, `schedule_cancel`, `schedule_update_time`, `schedule_delete`

在 `mcp_config` 工具方法之后插入新的 `#[tool]` 方法块（或追加到现有 `impl` 块中 `mcp_config` 之后）：

- [ ] **Step 1: Add schedule tool methods to handler**

在 `src-tauri/src/mcp/handler.rs` 的 `mcp_config` 方法闭合花括号之后、`}` (impl 块闭合) 之前插入：

```rust
    // ═══════════════════════════════════════════════
    // 定时发布（Phase 4）
    // ═══════════════════════════════════════════════

    /// 查询定时发布任务列表
    #[tool(description = "查询定时发布任务列表（从本地 SQLite t_publish_schedule 表），支持按项目 ID 和状态筛选")]
    async fn schedule_list(&self, Parameters(params): Parameters<ScheduleListParam>) -> Result<CallToolResult, ErrorData> {
        let conn = crate::mcp::db::open_db(&self.app_handle).map_err(|e| ErrorData::internal_error(e, None))?;
        let result = crate::mcp::db::query_schedules(&conn, params.project_id, params.status.as_deref())
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let json = serde_json::to_value(&result)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        Ok(CallToolResult::success(vec![ContentBlock::text(json.to_string())]))
    }

    /// 按 ID 查询单个定时发布任务
    #[tool(description = "按 ID 查询单个定时发布任务（从本地 SQLite t_publish_schedule 表）")]
    async fn schedule_get_by_id(&self, Parameters(params): Parameters<ScheduleIdParam>) -> Result<CallToolResult, ErrorData> {
        let conn = crate::mcp::db::open_db(&self.app_handle).map_err(|e| ErrorData::internal_error(e, None))?;
        let result = crate::mcp::db::query_schedule_by_id(&conn, params.id)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let json = serde_json::to_value(&result)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        Ok(CallToolResult::success(vec![ContentBlock::text(json.to_string())]))
    }

    /// 查询所有待执行的定时发布任务
    #[tool(description = "查询所有待执行的定时发布任务（status = 'pending'，按计划时间升序）")]
    async fn pending_schedule_list(&self) -> Result<CallToolResult, ErrorData> {
        let conn = crate::mcp::db::open_db(&self.app_handle).map_err(|e| ErrorData::internal_error(e, None))?;
        let result = crate::mcp::db::query_pending_schedules(&conn)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let json = serde_json::to_value(&result)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        Ok(CallToolResult::success(vec![ContentBlock::text(json.to_string())]))
    }

    /// 创建定时发布任务
    #[tool(description = "创建定时发布任务（写入本地 SQLite t_publish_schedule 表）")]
    async fn schedule_create(&self, Parameters(params): Parameters<ScheduleCreateParam>) -> Result<CallToolResult, ErrorData> {
        // 参数校验
        if params.project_id <= 0 {
            return Err(ErrorData::invalid_params("project_id 必须大于 0"));
        }
        if params.scheduled_time.is_empty() {
            return Err(ErrorData::invalid_params("scheduled_time 不能为空"));
        }
        if params.publish_type != "一键发布" && params.publish_type != "手动发布" {
            return Err(ErrorData::invalid_params(
                "publish_type 仅接受 \"一键发布\" 或 \"手动发布\"",
            ));
        }

        let conn = crate::mcp::db::open_db(&self.app_handle).map_err(|e| ErrorData::internal_error(e, None))?;
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
            AuditEntry::new("schedule_create", "ok")
                .with_file_path(&format!(
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
    async fn schedule_cancel(&self, Parameters(params): Parameters<ScheduleIdParam>) -> Result<CallToolResult, ErrorData> {
        let conn = crate::mcp::db::open_db(&self.app_handle).map_err(|e| ErrorData::internal_error(e, None))?;

        // 状态校验：仅 pending 可取消
        let status = crate::mcp::db::get_schedule_status(&conn, params.id)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        if status != "pending" {
            return Err(ErrorData::invalid_params(&format!(
                "任务状态为 {}，不能取消（仅 pending 可取消）",
                status
            )));
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

        Ok(CallToolResult::success(vec![ContentBlock::text(json.to_string())]))
    }

    /// 修改定时发布任务的计划执行时间
    #[tool(description = "修改定时发布任务的计划执行时间（仅允许修改 pending 状态的任务）")]
    async fn schedule_update_time(&self, Parameters(params): Parameters<ScheduleUpdateTimeParam>) -> Result<CallToolResult, ErrorData> {
        let conn = crate::mcp::db::open_db(&self.app_handle).map_err(|e| ErrorData::internal_error(e, None))?;

        // 状态校验：仅 pending 可修改
        let status = crate::mcp::db::get_schedule_status(&conn, params.id)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        if status != "pending" {
            return Err(ErrorData::invalid_params(&format!(
                "任务状态为 {}，不能修改时间（仅 pending 可修改）",
                status
            )));
        }

        crate::mcp::db::update_schedule_time(&conn, params.id, &params.scheduled_time)
            .map_err(|e| ErrorData::internal_error(e, None))?;

        // 返回更新后的任务记录
        let updated = crate::mcp::db::query_schedule_by_id(&conn, params.id)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        let json = serde_json::to_value(&updated)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;

        Ok(CallToolResult::success(vec![ContentBlock::text(json.to_string())]))
    }

    /// 删除定时发布任务
    #[tool(description = "删除定时发布任务")]
    async fn schedule_delete(&self, Parameters(params): Parameters<ScheduleIdParam>) -> Result<CallToolResult, ErrorData> {
        let conn = crate::mcp::db::open_db(&self.app_handle).map_err(|e| ErrorData::internal_error(e, None))?;
        crate::mcp::db::delete_schedule(&conn, params.id)
            .map_err(|e| ErrorData::internal_error(e, None))?;
        Ok(CallToolResult::success(vec![ContentBlock::text(
            serde_json::json!({"id": params.id}).to_string(),
        )]))
    }
```

插入位置：在 `mcp_config` 方法的闭合 `}` 之后、`impl McpHandler` 块的闭合 `}` 之前。即紧接在现有 `// MCP 配置管理（Phase 3）` 区块的 `mcp_config` 方法之后。

- [ ] **Step 2: Verify full build**

```bash
cd src-tauri && cargo build 2>&1
```

Expected: 编译成功，无警告。所有新类型、db 函数和 handler 方法正确连接。

- [ ] **Step 3: Commit**

```bash
cd D:\develop\Rex.SmomPublish-master
git add -f src-tauri/src/mcp/handler.rs
git commit -m "feat(mcp): add 7 scheduled publish MCP tools (Phase 4)"
```

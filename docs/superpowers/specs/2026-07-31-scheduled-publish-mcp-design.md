# 定时发布 MCP 工具设计

**日期**：2026-07-31
**状态**：已确认（Review #2 修正）

## 背景

SMOM 发布工具的 MCP Server 已在 Phase 1-3 中实现了项目、服务器、备份、文件操作等工具的 MCP 暴露，但定时发布（`t_publish_schedule`）功能仅有前端 UI 和数据库层，缺少 MCP tool 暴露。外部 AI 工具无法通过 MCP 协议管理定时发布任务。

## 目标

为定时发布功能新增 7 个 MCP tool，遵循现有 MCP 架构模式，使外部工具可以：
- 查询定时任务列表和详情
- 创建定时发布任务
- 取消待执行任务
- 修改计划执行时间
- 删除已完成/已取消/失败的任务

## 新增 Tool 列表

| Tool | 说明 | 关键参数 | 返回值 |
|---|---|---|---|
| `schedule_list` | 查询定时任务列表 | `project_id?`, `status?` | `[{id, projectId, projectName, environment, appconfigId, publishType, scheduledTime, status, createTime, executeTime, resultLog}]` |
| `schedule_get_by_id` | 按 ID 查询单个任务 | `id` | 单条记录（同上结构） |
| `pending_schedule_list` | 查询所有待执行任务 | 无 | 同 schedule_list |
| `schedule_create` | 创建定时发布任务 | `project_id`, `project_name`, `environment`, `appconfig_id`, `publish_type`, `scheduled_time` | `{"id": <new_id>}` |
| `schedule_cancel` | 取消定时任务 | `id` | 更新后的任务记录 |
| `schedule_update_time` | 修改计划执行时间 | `id`, `scheduled_time` | 更新后的任务记录 |
| `schedule_delete` | 删除定时任务 | `id` | `{"id": <deleted_id>}` |

### 命名一致性

遵循现有 `{domain}_{action}` 模式（`backup_list`, `server_list`, `project_list`），避免 `get_` 前缀。

## 参数设计

```rust
// schedule_list — 按项目/状态筛选，均不传则查全部
ScheduleListParam {
    project_id: Option<i64>,
    status: Option<String>,  // "pending" | "executing" | "completed" | "cancelled" | "failed"
}

// schedule_get_by_id / schedule_cancel / schedule_delete
ScheduleIdParam {
    id: i64,
}

// schedule_create
ScheduleCreateParam {
    project_id: i64,
    project_name: String,
    environment: i64,
    appconfig_id: i64,
    publish_type: String,      // "一键发布" | "手动发布"
    scheduled_time: String,    // "YYYY-MM-DD HH:mm:ss"
}

// schedule_update_time
ScheduleUpdateTimeParam {
    id: i64,
    scheduled_time: String,    // "YYYY-MM-DD HH:mm:ss"
}
```

## 参数校验

`schedule_create` 在 handler 层进行校验：

| 参数 | 规则 | 错误行为 |
|---|---|---|
| `publish_type` | 仅接受 `"一键发布"` 或 `"手动发布"` | 返回 `ErrorData::invalid_params` |
| `scheduled_time` | 非空字符串 | 返回 `ErrorData::invalid_params` |
| `project_id` | > 0 | 返回 `ErrorData::invalid_params` |

## 状态变更约束

| 操作 | 前置状态 | 目标状态 | 约束说明 |
|---|---|---|---|
| `schedule_cancel` | `pending` | `cancelled` | 非 pending 任务拒绝 |
| `schedule_update_time` | `pending` | `pending`（仅改时间） | 非 pending 任务拒绝 |
| `schedule_delete` | 任意 | —（删除） | 不做状态限制 |

状态校验流程统一为：handler 先调用 `get_schedule_status(conn, id)` 获取当前状态，若不符合前置条件则返回 `ErrorData` 含明确错误信息（如 `"任务状态为 completed，不能取消"`），而非静默返回 0 行受影响。

## 实现方案

完全遵循现有 MCP 三层架构，改动 3 个文件：

### 1. `src-tauri/src/mcp/types.rs`

新增 4 个参数结构体，放在 Phase 2 数据库查询参数区域之后：

- `ScheduleListParam` — `project_id: Option<i64>` + `status: Option<String>`
- `ScheduleIdParam` — `id: i64`
- `ScheduleCreateParam` — 6 个必填字段
- `ScheduleUpdateTimeParam` — `id: i64` + `scheduled_time: String`

`pending_schedule_list` 无需参数结构体，定义方式与现有的 `git_config_list()` 无参 tool 一致。

### 2. `src-tauri/src/mcp/db.rs`

新增 8 个查询函数，直接操作 `t_publish_schedule` 表：

| 函数 | SQL | 返回值 | 说明 |
|---|---|---|---|
| `query_schedules(conn, project_id?, status?)` | `SELECT ... WHERE ... ORDER BY scheduled_time DESC` | `Vec<Value>` | 可选双条件筛选 |
| `query_schedule_by_id(conn, id)` | `SELECT ... WHERE id = ?` | `Value` | 单条查询 |
| `query_pending_schedules(conn)` | `SELECT ... WHERE status = 'pending' ORDER BY scheduled_time ASC` | `Vec<Value>` | 待执行列表 |
| `create_schedule(conn, ...)` | `INSERT INTO ... VALUES (...) RETURNING id` | `i64`（新 ID） | 新建 |
| `get_schedule_status(conn, id)` | `SELECT status FROM ... WHERE id = ?` | `String` | 状态校验用 |
| `cancel_schedule(conn, id)` | `UPDATE ... SET status = 'cancelled', execute_time = ... WHERE id = ?` | — | 取消 |
| `update_schedule_time(conn, id, time)` | `UPDATE ... SET scheduled_time = ? WHERE id = ?` | — | 改时间 |
| `delete_schedule(conn, id)` | `DELETE FROM ... WHERE id = ?` | — | 删除 |

### 3. `src-tauri/src/mcp/handler.rs`

在 `McpHandler` 的 `#[tool]` 实现块中新增 7 个方法，参考现有 `backup_list` / `backup_create` 的模式：

- **查询类**（`schedule_list`, `schedule_get_by_id`, `pending_schedule_list`）：直接调 db 查询 → `serde_json::to_value` → `CallToolResult::success`
- **`schedule_create`**：校验参数 → `create_schedule` → 返回 `{"id": new_id}` → 审计日志
- **`schedule_cancel`**：`get_schedule_status` 校验为 pending → `cancel_schedule` → 调 `query_schedule_by_id` 返回最新记录 → 审计日志
- **`schedule_update_time`**：`get_schedule_status` 校验为 pending → `update_schedule_time` → 调 `query_schedule_by_id` 返回最新记录
- **`schedule_delete`**：`delete_schedule` → 返回 `{"id": id}`

### 审计日志范围

- `schedule_create` → 记录 `schedule_create` / `ok` + `project_id` + `scheduled_time`
- `schedule_cancel` → 记录 `schedule_cancel` / `ok` + `schedule_id`
- 其余纯查询/删除/改时间操作不写入审计日志（与现有 `backup_list` / `backup_restore_list` 等模式一致）

## 不涉及的内容

- 不修改前端 UI（定时发布对话框已有完整功能）
- 不修改 `src/database/publishSchedule/index.ts`（前端已有完整 CRUD）
- 不修改 `t_publish_schedule` 表结构
- 不实现定时任务的自动执行（执行由桌面端 scheduler 负责，不在 MCP 范围内）

## 数据流

```
外部 AI 工具
    │
    ▼
MCP Streamable HTTP (127.0.0.1:<port>/mcp)
    │
    ▼
McpHandler (handler.rs)
    │
    ├── 参数校验 (publish_type 白名单, project_id > 0)
    ├── 状态校验 (cancel/update_time 仅允许 pending)
    ├── 数据库操作 (db.rs → SQLite t_publish_schedule)
    └── 审计日志 (audit.rs, schedule_create / schedule_cancel 时)
```

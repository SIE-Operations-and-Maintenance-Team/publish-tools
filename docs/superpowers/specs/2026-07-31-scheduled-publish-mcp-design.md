# 定时发布 MCP 工具设计

**日期**：2026-07-31
**状态**：已确认

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

| Tool | 说明 | 关键参数 |
|---|---|---|
| `schedule_list` | 查询定时任务列表 | `status?`（可选筛选） |
| `schedule_get_by_id` | 按 ID 查询单个任务 | `id` |
| `get_pending_schedules` | 查询所有待执行任务 | 无参数 |
| `schedule_create` | 创建定时发布任务 | `project_id`, `project_name`, `environment`, `appconfig_id`, `publish_type`, `scheduled_time` |
| `schedule_cancel` | 取消定时任务（pending → cancelled） | `id` |
| `schedule_update_time` | 修改计划执行时间 | `id`, `scheduled_time` |
| `schedule_delete` | 删除定时任务 | `id` |

## 参数设计

```rust
// schedule_list — 按状态筛选，不传则查全部
ScheduleListParam {
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

## 状态变更约束

`schedule_cancel` 仅允许将 `pending` 状态的任务改为 `cancelled`，其他状态拒绝操作。`schedule_delete` 不做状态限制（允许删除任意状态的任务）。

## 实现方案

完全遵循现有 MCP 三层架构，改动 3 个文件：

### 1. `src-tauri/src/mcp/types.rs`

新增 6 个参数结构体（`ScheduleListParam`, `ScheduleIdParam`, `ScheduleCreateParam`, `ScheduleUpdateTimeParam`），放在 Phase 2 数据库查询参数区域之后。

### 2. `src-tauri/src/mcp/db.rs`

新增 7 个查询函数，直接操作 `t_publish_schedule` 表：

| 函数 | SQL |
|---|---|
| `query_schedules(conn, status?)` | `SELECT ... FROM t_publish_schedule WHERE ... ORDER BY scheduled_time DESC` |
| `query_schedule_by_id(conn, id)` | `SELECT ... FROM t_publish_schedule WHERE id = ?` |
| `query_pending_schedules(conn)` | `SELECT ... FROM t_publish_schedule WHERE status = 'pending' ORDER BY scheduled_time ASC` |
| `create_schedule(conn, ...)` | `INSERT INTO t_publish_schedule (...) VALUES (...) RETURNING id` |
| `cancel_schedule(conn, id)` | `UPDATE t_publish_schedule SET status = 'cancelled', execute_time = ... WHERE id = ?` |
| `update_schedule_time(conn, id, time)` | `UPDATE t_publish_schedule SET scheduled_time = ? WHERE id = ?` |
| `delete_schedule(conn, id)` | `DELETE FROM t_publish_schedule WHERE id = ?` |

### 3. `src-tauri/src/mcp/handler.rs`

在 `McpHandler` 的 `#[tool]` 实现块中新增 7 个方法，参考现有 `backup_list` / `backup_create` 的模式：
- 打开数据库连接
- 调用 db 层函数
- 序列化结果返回
- `schedule_create` 和 `schedule_cancel` 写入审计日志

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
    ├── 参数解析 (types.rs)
    ├── 数据库操作 (db.rs → SQLite t_publish_schedule)
    └── 审计日志 (audit.rs, schedule_create / schedule_cancel 时)
```
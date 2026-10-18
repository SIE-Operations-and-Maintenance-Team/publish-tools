use rusqlite::{params, Connection};
use serde_json::Value;
use std::path::PathBuf;
use tauri::Manager;

/// 打开 smom.db 连接，设置 busy_timeout = 5000ms 避免 SQLITE_BUSY
pub fn open_db(app_handle: &tauri::AppHandle) -> Result<Connection, String> {
    let mut path: PathBuf = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取 app_data_dir 失败: {e}"))?;
    path.push("smom.db");

    let conn = Connection::open(&path).map_err(|e| format!("打开数据库失败: {e}"))?;

    // 设置 busy_timeout = 5000ms，避免与 tauri-plugin-sql 的写操作产生 SQLITE_BUSY
    conn.execute_batch("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;")
        .map_err(|e| format!("设置数据库 pragma 失败: {e}"))?;

    Ok(conn)
}

/// 查询行并返回 Vec<Value>（每行一个 JSON 对象）
fn rows_to_json(
    conn: &Connection,
    sql: &str,
    params: &[&dyn rusqlite::types::ToSql],
) -> Result<Vec<Value>, String> {
    let mut stmt = conn
        .prepare(sql)
        .map_err(|e| format!("SQL 准备失败: {e}"))?;
    let col_count = stmt.column_count();
    let col_names: Vec<String> = (0..col_count)
        .map(|i| stmt.column_name(i).unwrap_or("?").to_string())
        .collect();

    let rows = stmt
        .query_map(params, |row| {
            let mut map = serde_json::Map::new();
            for (i, name) in col_names.iter().enumerate() {
                let val: rusqlite::types::Value = row.get_unwrap(i);
                let json_val = sqlite_val_to_json(val);
                map.insert(name.clone(), json_val);
            }
            Ok(Value::Object(map))
        })
        .map_err(|e| format!("SQL 查询失败: {e}"))?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| format!("读取行失败: {e}"))?);
    }
    Ok(result)
}

/// 将 rusqlite::types::Value 转为 serde_json::Value
fn sqlite_val_to_json(val: rusqlite::types::Value) -> Value {
    match val {
        rusqlite::types::Value::Null => Value::Null,
        rusqlite::types::Value::Integer(i) => Value::Number(i.into()),
        rusqlite::types::Value::Real(f) => serde_json::Number::from_f64(f)
            .map(Value::Number)
            .unwrap_or(Value::Null),
        rusqlite::types::Value::Text(s) => Value::String(s),
        rusqlite::types::Value::Blob(b) => Value::String(format!("<blob {} bytes>", b.len())),
    }
}

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
    let results = rows_to_json(
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
pub fn update_schedule_time(
    conn: &Connection,
    id: i64,
    scheduled_time: &str,
) -> Result<(), String> {
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

/// 查询应用配置（带项目名称），供 MCP 发布动作定位使用
pub fn query_app_configs_for_action(
    conn: &Connection,
    project_id: Option<i64>,
) -> Result<Vec<Value>, String> {
    let base = "SELECT ac.id, ac.project_id, p.name AS project_name, ac.environment, ac.ms_build_path, ac.dll_mode, ac.dll_mode_value, ac.config_items_json, ac.build_mode FROM t_app_config ac LEFT JOIN t_project p ON ac.project_id = p.id";
    match project_id {
        Some(pid) => {
            let sql = format!("{base} WHERE ac.project_id = ?1 ORDER BY ac.id");
            let params: [&dyn rusqlite::types::ToSql; 1] = [&pid];
            rows_to_json(conn, &sql, &params)
        }
        None => {
            let sql = format!("{base} ORDER BY ac.id");
            rows_to_json(conn, &sql, &[])
        }
    }
}

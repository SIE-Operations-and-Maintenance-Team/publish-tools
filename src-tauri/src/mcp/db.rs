use rusqlite::{Connection, params};
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

    let conn = Connection::open(&path)
        .map_err(|e| format!("打开数据库失败: {e}"))?;

    // 设置 busy_timeout = 5000ms，避免与 tauri-plugin-sql 的写操作产生 SQLITE_BUSY
    conn.execute_batch("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;")
        .map_err(|e| format!("设置数据库 pragma 失败: {e}"))?;

    Ok(conn)
}

/// 查询行并返回 Vec<Value>（每行一个 JSON 对象）
fn rows_to_json(conn: &Connection, sql: &str, params: &[&dyn rusqlite::types::ToSql]) -> Result<Vec<Value>, String> {
    let mut stmt = conn.prepare(sql)
        .map_err(|e| format!("SQL 准备失败: {e}"))?;
    let col_count = stmt.column_count();
    let col_names: Vec<String> = (0..col_count)
        .map(|i| stmt.column_name(i).unwrap_or("?").to_string())
        .collect();

    let rows = stmt.query_map(params, |row| {
        let mut map = serde_json::Map::new();
        for i in 0..col_count {
            let name = &col_names[i];
            let val: rusqlite::types::Value = row.get_unwrap(i);
            let json_val = sqlite_val_to_json(val);
            map.insert(name.clone(), json_val);
        }
        Ok(Value::Object(map))
    }).map_err(|e| format!("SQL 查询失败: {e}"))?;

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
        rusqlite::types::Value::Real(f) => {
            serde_json::Number::from_f64(f)
                .map(Value::Number)
                .unwrap_or(Value::Null)
        }
        rusqlite::types::Value::Text(s) => Value::String(s),
        rusqlite::types::Value::Blob(b) => Value::String(format!("<blob {} bytes>", b.len())),
    }
}

// ── 查询函数 ──

/// 查询项目列表（t_project）
pub fn query_projects(conn: &Connection, keyword: Option<&str>) -> Result<Vec<Value>, String> {
    let (sql, params): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = if let Some(kw) = keyword {
        let like = format!("%{}%", kw);
        (
            "SELECT id, code, name, is_default, description FROM t_project WHERE name LIKE ?1 OR code LIKE ?1 ORDER BY id".into(),
            vec![Box::new(like)],
        )
    } else {
        (
            "SELECT id, code, name, is_default, description FROM t_project ORDER BY id".into(),
            vec![],
        )
    };
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    rows_to_json(conn, &sql, &param_refs)
}

/// 查询服务器列表（t_server）
pub fn query_servers(conn: &Connection, project_id: Option<i64>, name: Option<&str>) -> Result<Vec<Value>, String> {
    let mut conditions = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    if let Some(pid) = project_id {
        conditions.push("project_id = ?".to_string());
        params.push(Box::new(pid));
    }
    if let Some(n) = name {
        conditions.push(format!("name LIKE ?{}", params.len() + 1));
        params.push(Box::new(format!("%{}%", n)));
    }
    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };
    let sql = format!("SELECT id, project_id, name, os, ip, port, account, description FROM t_server {} ORDER BY id", where_clause);
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    rows_to_json(conn, &sql, &param_refs)
}

/// 查询应用配置列表（t_app_config）
pub fn query_app_configs(conn: &Connection, project_id: Option<i64>) -> Result<Vec<Value>, String> {
    let (sql, params): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = if let Some(pid) = project_id {
        (
            "SELECT id, project_id, environment, ms_build_path, dll_mode, dll_mode_value, config_items_json, build_mode FROM t_app_config WHERE project_id = ?1 ORDER BY id".into(),
            vec![Box::new(pid)],
        )
    } else {
        (
            "SELECT id, project_id, environment, ms_build_path, dll_mode, dll_mode_value, config_items_json, build_mode FROM t_app_config ORDER BY id".into(),
            vec![],
        )
    };
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    rows_to_json(conn, &sql, &param_refs)
}

/// 查询 TFS 配置列表（t_team_foundation_server）
pub fn query_tfs_configs(conn: &Connection) -> Result<Vec<Value>, String> {
    rows_to_json(conn, "SELECT id, tfs_name, tfs_server_url, tfs_source_path, tfvc_path, remark, tfs_local_path FROM t_team_foundation_server ORDER BY id", &[])
}

/// 查询 Git 配置列表（t_git）
pub fn query_git_configs(conn: &Connection) -> Result<Vec<Value>, String> {
    rows_to_json(conn, "SELECT id, git_name, git_repository, git_path, branch_name, remark FROM t_git ORDER BY id", &[])
}

/// 查询备份记录列表（t_backup）
pub fn query_backups(conn: &Connection, project_id: Option<i64>) -> Result<Vec<Value>, String> {
    let (sql, params): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = if let Some(pid) = project_id {
        (
            "SELECT id, project_id, project_name, environment, backup_date, remark, backup_items_json FROM t_backup WHERE project_id = ?1 ORDER BY id DESC".into(),
            vec![Box::new(pid)],
        )
    } else {
        (
            "SELECT id, project_id, project_name, environment, backup_date, remark, backup_items_json FROM t_backup ORDER BY id DESC".into(),
            vec![],
        )
    };
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    rows_to_json(conn, &sql, &param_refs)
}

/// 创建备份记录（t_backup INSERT）
pub fn create_backup(
    conn: &Connection,
    project_id: i64,
    project_name: &str,
    environment: i64,
    remark: Option<&str>,
    backup_items_json: &str,
) -> Result<i64, String> {
    conn.execute(
        "INSERT INTO t_backup (project_id, project_name, environment, backup_date, remark, backup_items_json) VALUES (?1, ?2, ?3, datetime('now', 'localtime'), ?4, ?5)",
        params![project_id, project_name, environment, remark, backup_items_json],
    ).map_err(|e| format!("创建备份记录失败: {e}"))?;

    Ok(conn.last_insert_rowid())
}

/// 查询还原记录列表（t_restore）
pub fn query_restores(conn: &Connection, backup_id: Option<i64>) -> Result<Vec<Value>, String> {
    let (sql, params): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = if let Some(bid) = backup_id {
        (
            "SELECT id, backup_id, restore_date, result, log_content FROM t_restore WHERE backup_id = ?1 ORDER BY id DESC".into(),
            vec![Box::new(bid)],
        )
    } else {
        (
            "SELECT id, backup_id, restore_date, result, log_content FROM t_restore ORDER BY id DESC".into(),
            vec![],
        )
    };
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    rows_to_json(conn, &sql, &param_refs)
}
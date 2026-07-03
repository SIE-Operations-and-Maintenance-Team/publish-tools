import Database from "@tauri-apps/plugin-sql";

let database: Database | null = null;
let schemaReady = false;

// Sqlite数据库[smom.db]
export async function db(): Promise<Database> {
    if (!database) database = await Database.load("sqlite:smom.db");
    if (!schemaReady) {
        await ensureSchema(database);
        schemaReady = true;
    }
    return database;
}

async function ensureSchema(database: Database) {
    // ========== 建表（CREATE TABLE IF NOT EXISTS，幂等安全） ==========
    await database.execute(`CREATE TABLE IF NOT EXISTS t_project (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        code TEXT,
        name TEXT,
        is_default INTEGER,
        assembly_out_path TEXT,
        description TEXT
    )`);

    await database.execute(`CREATE TABLE IF NOT EXISTS t_app_config (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        environment INTEGER,
        ms_build_path TEXT,
        dll_mode TEXT,
        dll_mode_value TEXT,
        config_items_json TEXT,
        build_mode TEXT default 'Debug'
    )`);

    await database.execute(`CREATE TABLE IF NOT EXISTS t_server (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        name TEXT,
        os INTEGER,
        ip TEXT,
        port INTEGER,
        account TEXT,
        pwd TEXT,
        description TEXT
    )`);

    await database.execute(`CREATE TABLE IF NOT EXISTS t_backup (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        project_name TEXT,
        environment INTEGER,
        backup_date TEXT,
        remark TEXT,
        backup_items_json TEXT
    )`);

    await database.execute(`CREATE TABLE IF NOT EXISTS t_restore (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        backup_id INTEGER,
        restore_date TEXT,
        result INTEGER,
        log_content TEXT
    )`);

    await database.execute(`CREATE TABLE IF NOT EXISTS t_team_foundation_server (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        tfs_name TEXT,
        tfs_server_url TEXT,
        tfs_source_path TEXT,
        tfvc_path TEXT,
        remark TEXT,
        tfs_local_path TEXT
    )`);

    await database.execute(`CREATE TABLE IF NOT EXISTS t_git (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        git_name TEXT,
        git_repository TEXT,
        git_path TEXT,
        branch_name TEXT,
        remark TEXT
    )`);

    await database.execute(`CREATE TABLE IF NOT EXISTS t_publish_schedule (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        project_name TEXT,
        environment INTEGER,
        appconfig_id INTEGER,
        publish_type TEXT,
        scheduled_time TEXT,
        status TEXT DEFAULT 'pending',
        create_time TEXT,
        execute_time TEXT,
        result_log TEXT
    )`);

    await database.execute(`CREATE TABLE IF NOT EXISTS t_settings (
        id INTEGER NOT NULL PRIMARY KEY,
        one_click_publish_enabled INTEGER DEFAULT 0,
        win_service_stop_retry_count INTEGER DEFAULT 3,
        win_service_stop_retry_interval INTEGER DEFAULT 2,
        win_copy_retry_count INTEGER DEFAULT 3,
        win_copy_retry_interval INTEGER DEFAULT 2,
        update_time TEXT
    )`);

    // ========== 改表（已有表加字段，先检查是否存在） ==========
    const columns = await database.select<{ name: string }[]>("PRAGMA table_info(t_app_config)");
    const hasBuildMode = columns.some((column) => column.name === "build_mode");
    if (!hasBuildMode) {
        await database.execute("ALTER TABLE t_app_config ADD COLUMN build_mode TEXT DEFAULT 'Debug'");
    }
}

// 关闭数据库连接
export async function closeDb() {
    if (!database) return;
    await database.close();
    database = null;
    schemaReady = false;
}
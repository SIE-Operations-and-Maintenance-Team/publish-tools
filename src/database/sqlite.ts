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
        win_service_retry_count INTEGER DEFAULT 3,
        win_service_retry_interval INTEGER DEFAULT 2,
        win_copy_retry_count INTEGER DEFAULT 3,
        win_copy_retry_interval INTEGER DEFAULT 2,
        upload_retry_count INTEGER DEFAULT 99,
        upload_retry_interval INTEGER DEFAULT 3,
        update_time TEXT
    )`);

    await database.execute(`CREATE TABLE IF NOT EXISTS t_discovery_prefix (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  prefix TEXT UNIQUE NOT NULL,
  enabled INTEGER DEFAULT 1,
  is_default INTEGER DEFAULT 0
)`);

    // 发布台账（一次发布一条记录，含断点续跑检查点与发布说明）
    await database.execute(`CREATE TABLE IF NOT EXISTS t_publish_record (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        project_name TEXT,
        environment INTEGER,
        start_date TEXT,
        end_date TEXT,
        duration_ms INTEGER,
        result INTEGER,
        resume_count INTEGER,
        stage_json TEXT,
        change_log_json TEXT,
        dll_items_json TEXT,
        service_results_json TEXT,
        backup_id INTEGER,
        appconfig_snapshot_json TEXT,
        remark TEXT
    )`);

    // 发布锁（整机全局单锁，跨项目/环境互斥）
    await database.execute(`CREATE TABLE IF NOT EXISTS t_publish_lock (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        environment INTEGER,
        token TEXT,
        acquired_at TEXT,
        expire_at TEXT,
        remark TEXT
    )`);

    // 发布任务队列（MCP 动作提交后的排队与执行状态，供跨会话查询）
    await database.execute(`CREATE TABLE IF NOT EXISTS t_publish_job (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        source TEXT,
        appconfig_id INTEGER,
        project_id INTEGER,
        project_name TEXT,
        environment INTEGER,
        status TEXT NOT NULL,
        message TEXT,
        created_at TEXT,
        started_at TEXT,
        ended_at TEXT,
        backup_id INTEGER
    )`);

    // ========== 改表（已有表加字段，先检查是否存在） ==========
    const columns = await database.select<{ name: string }[]>("PRAGMA table_info(t_app_config)");
    const hasBuildMode = columns.some((column) => column.name === "build_mode");
    if (!hasBuildMode) {
        await database.execute("ALTER TABLE t_app_config ADD COLUMN build_mode TEXT DEFAULT 'Debug'");
    }

    // t_server 加 SSH MCP 同步来源键（项目/环境/主机），有值 = 已纳管由远端管理，NULL = 本地自建
    const serverColumns = await database.select<{ name: string }[]>("PRAGMA table_info(t_server)");
    if (!serverColumns.some((column) => column.name === "source_key")) {
        await database.execute("ALTER TABLE t_server ADD COLUMN source_key TEXT");
    }
    // 部分唯一索引：纳管行的 source_key 唯一（NULL 不受限制，本地自建行可多行为 NULL）
    await database.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_t_server_source_key ON t_server(source_key) WHERE source_key IS NOT NULL"
    );

    // t_settings 加 SSH MCP 同步设置（API 地址 + 启动时自动同步开关）
    const syncSettingsColumns = await database.select<{ name: string }[]>("PRAGMA table_info(t_settings)");
    if (!syncSettingsColumns.some((column) => column.name === "ssh_mcp_url")) {
        await database.execute("ALTER TABLE t_settings ADD COLUMN ssh_mcp_url TEXT DEFAULT 'http://127.0.0.1:61823'");
    }
    if (!syncSettingsColumns.some((column) => column.name === "ssh_mcp_auto_sync")) {
        await database.execute("ALTER TABLE t_settings ADD COLUMN ssh_mcp_auto_sync INTEGER DEFAULT 0");
    }

    // t_settings 加启动默认菜单（'workstation' 发布工作台 / 'home' 项目发布）
    if (!syncSettingsColumns.some((column) => column.name === "startup_menu")) {
        await database.execute("ALTER TABLE t_settings ADD COLUMN startup_menu TEXT DEFAULT 'workstation'");
    }

    // t_settings 加上传重试设置（项目发布上传文件到服务器的重试次数/间隔，秒）
    if (!syncSettingsColumns.some((column) => column.name === "upload_retry_count")) {
        await database.execute("ALTER TABLE t_settings ADD COLUMN upload_retry_count INTEGER DEFAULT 99");
    }
    if (!syncSettingsColumns.some((column) => column.name === "upload_retry_interval")) {
        await database.execute("ALTER TABLE t_settings ADD COLUMN upload_retry_interval INTEGER DEFAULT 3");
    }

    // ========== 改列（服务重试列名由 stop_retry 统一为 retry，老库存在旧列则逐列重命名） ==========
    // 注：Rust 端 migration 未在 main.rs 注册（死代码），实际建表/改列均由本函数承担
    const settingsColumns = await database.select<{ name: string }[]>("PRAGMA table_info(t_settings)");
    const hasSettingsColumn = (name: string) => settingsColumns.some((column) => column.name === name);
    if (hasSettingsColumn("win_service_stop_retry_count")) {
        await database.execute("ALTER TABLE t_settings RENAME COLUMN win_service_stop_retry_count TO win_service_retry_count");
    }
    if (hasSettingsColumn("win_service_stop_retry_interval")) {
        await database.execute("ALTER TABLE t_settings RENAME COLUMN win_service_stop_retry_interval TO win_service_retry_interval");
    }
    // 兜底：新旧列名都不存在（畸形老库）时补建，保证 t_settings 结构完整
    if (!hasSettingsColumn("win_service_retry_count") && !hasSettingsColumn("win_service_stop_retry_count")) {
        await database.execute("ALTER TABLE t_settings ADD COLUMN win_service_retry_count INTEGER DEFAULT 3");
    }
    if (!hasSettingsColumn("win_service_retry_interval") && !hasSettingsColumn("win_service_stop_retry_interval")) {
        await database.execute("ALTER TABLE t_settings ADD COLUMN win_service_retry_interval INTEGER DEFAULT 2");
    }
}

// 关闭数据库连接
export async function closeDb() {
    if (!database) return;
    await database.close();
    database = null;
    schemaReady = false;
}
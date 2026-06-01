use tauri_plugin_sql::{Migration, MigrationKind};

// 数据库迁移
pub fn db_migration() -> Vec<Migration> {
    // 表：项目
    let t_project = "CREATE TABLE IF NOT EXISTS t_project (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        code TEXT,
        name TEXT,
        is_default INTEGER,
        assembly_out_path TEXT,
        description TEXT
    );";

    // 表：应用配置
    let t_app_config = "CREATE TABLE IF NOT EXISTS t_app_config (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        environment INTEGER,
        ms_build_path TEXT,
        dll_mode TEXT,
        dll_mode_value TEXT,
        config_items_json TEXT,
        build_mode TEXT default 'Debug'
    );";

    // 表：服务器
    let t_server = "CREATE TABLE IF NOT EXISTS t_server (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        name TEXT,
        os INTEGER,
        ip TEXT,
        port INTEGER,
        account TEXT,
        pwd TEXT,
        description TEXT
    );";

    // 表：备份记录
    let t_backup = "CREATE TABLE IF NOT EXISTS t_backup (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        project_name TEXT,
        environment INTEGER,
        backup_date TEXT,
        remark TEXT,
        backup_items_json TEXT
    );";

    // 表：还原记录
    let t_restore = "CREATE TABLE IF NOT EXISTS t_restore (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        backup_id INTEGER,
        restore_date TEXT,
        result INTEGER,
        log_content TEXT
    );";

    // 表：TFS
    let t_team_foundation_server = "CREATE TABLE IF NOT EXISTS t_team_foundation_server (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        tfs_name TEXT,
        tfs_server_url TEXT,
        tfs_source_path TEXT,
        tfvc_path TEXT,
        remark TEXT,
        tfs_local_path TEXT
    );";

    // 表：Git
    let t_git = "CREATE TABLE IF NOT EXISTS t_git (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        git_name TEXT,
        git_repository TEXT,
        git_path TEXT,
        branch_name TEXT,
        remark TEXT
    );";

    let migrations = vec![
        // 数据迁移
        Migration {
            version: 1,
            description: "初始化创建项目[t_project]表.",
            sql: t_project,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "初始化创建应用配置[t_app_config]表.",
            sql: t_app_config,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "初始化创建服务器[t_server]表.",
            sql: t_server,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "初始化创建服务器[t_backup]表.",
            sql: t_backup,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "初始化创建服务器[t_restore]表.",
            sql: t_restore,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "初始化创建TFS[t_team_foundation_server]表.",
            sql: t_team_foundation_server,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "初始化创建Git[t_git]表.",
            sql: t_git,
            kind: MigrationKind::Up,
        },
    ];
    migrations
}

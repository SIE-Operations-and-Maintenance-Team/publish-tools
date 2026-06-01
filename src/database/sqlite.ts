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
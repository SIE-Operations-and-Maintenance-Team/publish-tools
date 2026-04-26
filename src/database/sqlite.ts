import Database from "@tauri-apps/plugin-sql";

// Sqlite数据库[smom.db]
export async function db(): Promise<Database> {
    return await Database.load("sqlite:smom.db");
}

// 关闭数据库连接
export async function closeDb() {
    await (await db()).close();
}
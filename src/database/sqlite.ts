import Database from "@tauri-apps/plugin-sql";

// Sqlite数据库[smom.db]
export async function db(): Promise<Database> {
    return await Database.load("sqlite:smom.db");
}

// 关闭数据库连接
export async function closeDb() {
    await (await db()).close();
}

// 初始化数据库 - 确保所有表都被创建
export async function initializeDatabase() {
    try {
        const database = await db();
        
        // 创建 Git 表（如果不存在）
        await database.execute(
            `CREATE TABLE IF NOT EXISTS t_git (
                id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                git_name TEXT,
                git_repository TEXT,
                git_path TEXT,
                branch_name TEXT,
                remark TEXT
            );`
        );
        
        // 创建 Git 提交记录表（如果不存在）
        await database.execute(
            `CREATE TABLE IF NOT EXISTS t_git_commits (
                id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                commit_sha TEXT,
                branch_name TEXT,
                author TEXT,
                message TEXT,
                date TEXT
            );`
        );
        
        console.log("数据库初始化完成");
    } catch (error) {
        console.error("数据库初始化失败:", error);
    }
}

// 事务处理
// TODO: 事务处理待实现
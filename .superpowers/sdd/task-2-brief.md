### Task 2: 数据库 Schema

**Files:**
- Modify: `src/database/sqlite.ts`

**Interfaces:**
- Produces: `t_project` 表含 `backup_base_path TEXT` 列（新安装 + 已安装升级）

- [ ] **Step 1: 更新建表语句**

打开 `src/database/sqlite.ts`，在 `ensureSchema` 函数中，找到 `CREATE TABLE IF NOT EXISTS t_project`（约第 18 行），在 `assembly_out_path TEXT,` 之后加一行：

```diff
  await database.execute(`CREATE TABLE IF NOT EXISTS t_project (
      id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      code TEXT,
      name TEXT,
      is_default INTEGER,
      assembly_out_path TEXT,
+     backup_base_path TEXT,
      description TEXT
  )`);
```

- [ ] **Step 2: 新增已安装客户端升级逻辑**

在 `ensureSchema` 函数末尾（`build_mode` 的 `ALTER TABLE` 块之后，约第 106 行之后）追加：

```ts
// 为已有 t_project 表补充 backup_base_path 列
const projectColumns = await database.select<{ name: string }[]>(
  "PRAGMA table_info(t_project)"
);
const hasBackupBasePath = projectColumns.some((col) => col.name === "backup_base_path");
if (!hasBackupBasePath) {
  await database.execute("ALTER TABLE t_project ADD COLUMN backup_base_path TEXT");
}
```

- [ ] **Step 3: 验证编译**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/database/sqlite.ts
git commit -m "feat: t_project 表新增 backup_base_path 列（新安装+升级）"
```

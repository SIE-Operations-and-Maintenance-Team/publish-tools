### Task 3: DAO 层适配

**Files:**
- Modify: `src/database/project/index.ts`

**Interfaces:**
- Consumes: `RowProjectType.backupBasePath: string | null` (from Task 1), `t_project.backup_base_path` (from Task 2)
- Produces: 5 个方法 SQL 含 `backup_base_path` 列，参数绑定对齐

- [ ] **Step 1: 修改 `getProjectList` — SELECT 列**

第 12 行，select 列表末尾加 `backup_base_path backupBasePath`：

```ts
let dataSql =
    "select id,code,name,description,is_default isDefault, assembly_out_path assemblyOutPath, backup_base_path backupBasePath from t_project";
```

- [ ] **Step 2: 修改 `getProjectDefault` — 两处 SELECT**

第 67 行，`select` 列表同 Step 1：

```ts
let dataSql =
    "select id,code,name,description,is_default isDefault, assembly_out_path assemblyOutPath, backup_base_path backupBasePath from t_project where is_default = 1;";
```

第 86 行，fallback 查询也同样更新：

```ts
let dataMaxIdSql =
    "select id,code,name,description,is_default isDefault, assembly_out_path assemblyOutPath, backup_base_path backupBasePath from t_project order by id desc LIMIT 1;";
```

- [ ] **Step 3: 修改 `getProjectById` — SELECT 列**

第 110 行：

```ts
let dataSql =
    "select id,code,name,description,is_default isDefault, assembly_out_path assemblyOutPath, backup_base_path backupBasePath from t_project where id = $1;";
```

- [ ] **Step 4: 修改 `insertProject` — INSERT 列 + 参数**

第 145 行，SQL：

```ts
let insertSql =
    "INSERT INTO t_project (code, name, description, is_default, assembly_out_path, backup_base_path) VALUES($1, $2, $3, $4, $5, $6) RETURNING id;";
```

第 174-182 行，`execute` 绑定数组追加 `project.backupBasePath`：

```ts
let rowResult = await (
    await db()
).execute(execSql, [
    project.code,
    project.name,
    project.description,
    project.isDefault,
    project.assemblyOutPath,
    project.backupBasePath,
]);
```

- [ ] **Step 5: 修改 `updateProject` — UPDATE 列 + 参数**

第 207 行，SQL：

```ts
let updateSql =
    "UPDATE t_project SET code=$1, name=$2, description=$3, is_default=$4, assembly_out_path=$5, backup_base_path=$6 WHERE id=$7;";
```

第 234-243 行，`execute` 绑定数组追加 `project.backupBasePath`（注意 `id` 变为 `$7`）：

```ts
let rowResult = await (
    await db()
).execute(execSql, [
    project.code,
    project.name,
    project.description,
    project.isDefault,
    project.assemblyOutPath,
    project.backupBasePath,
    project.id
]);
```

- [ ] **Step 6: 运行类型检查**

```bash
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/database/project/index.ts
git commit -m "feat: project DAO 适配 backup_base_path 列"
```

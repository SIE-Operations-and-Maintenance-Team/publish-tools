# 服务端备份路径配置 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在手动发布界面新增按项目配置的服务端备份基础路径，覆盖默认备份路径逻辑。

**Architecture:** 数据层通过 `sqlite.ts` 的 `PRAGMA table_info` + `ALTER TABLE` 模式新增 `t_project.backup_base_path` 列；DAO 层适配 5 个方法的 SQL；UI 层在项目弹窗和发布信息卡片各新增一个输入框，发布信息卡片用 `watch` + debounce 持久化到数据库；备份逻辑层 `getBackupPath` 签名增加可选第 3 参，共影响 6 个备份方法。

**Tech Stack:** Vue 3 + TypeScript + Element Plus + SQLite (`@tauri-apps/plugin-sql`)

## Global Constraints

- 选填字段，不阻塞现有流程
- 沿用 `build_mode` 的 `PRAGMA table_info` + `ALTER TABLE` 模式
- TypeScript 严格模式，签名变更需编译通过
- 遵循项目已有命名风格（snake_case DB 列名、camelCase TS 字段）

---

### Task 1: 类型定义

**Files:**
- Modify: `src/types/project.d.ts`
- Modify: `src/types/manuallyPublish.d.ts`

**Interfaces:**
- Produces: `RowProjectType.backupBasePath: string | null`, `CommonPapersPublishType.backupBasePath?: string`

- [ ] **Step 1: 给 `RowProjectType` 新增 `backupBasePath` 字段**

打开 `src/types/project.d.ts`，在 `RowProjectType` 末尾（`assemblyOutPath` 之后）加：

```ts
// project
declare type RowProjectType = {
	id: number | null;
	code: string | null;
	name: string | null;
	description: string | null;
	isDefault: number | null;
	assemblyOutPath: string | null;
	backupBasePath: string | null;
};
```

- [ ] **Step 2: 给 `CommonPapersPublishType` 新增可选字段**

打开 `src/types/manuallyPublish.d.ts`，在 `CommonPapersPublishType` 中加：

```ts
declare type CommonPapersPublishType = {
	projectName: string;
	environment: number;
	publishMode: number;
	isBackup: number;
	generateDate: string;
	notes?: string;
	isNewVersion: boolean | null;
	backupBasePath?: string;  // 服务端备份基础路径，从数据库按项目回填
};
```

- [ ] **Step 3: 验证类型编译**

```bash
npm run build
```

期望：无类型错误。

- [ ] **Step 4: Commit**

```bash
git add src/types/project.d.ts src/types/manuallyPublish.d.ts
git commit -m "feat: 类型定义新增 backupBasePath 字段"
```

---

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

---

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

---

### Task 4: 项目弹窗 — 备份基础路径输入框

**Files:**
- Modify: `src/views/project/components/projectDialog.vue`

**Interfaces:**
- Consumes: `RowProjectType.backupBasePath` (from Task 1)
- Produces: 项目新增/编辑弹窗中可输入 `backupBasePath`

- [ ] **Step 1: 在 `state.ruleForm` 初始值中加 `backupBasePath`**

第 110-117 行，在 `assemblyOutPath: null,` 之后加：

```ts
const state = reactive<FormDialogType<RowProjectType>>({
  ruleForm: {
    id: null,
    code: null,
    name: null,
    description: null,
    isDefault: 0,
    assemblyOutPath: null,
    backupBasePath: null,
  },
  // ...
});
```

- [ ] **Step 2: 在 template 中「描述」字段之前新增输入框**

在第 62 行 `</el-col>`（程序集输出路径结束）之后、第 63 行 `<el-col :span="24">`（描述）之前，插入：

```html
<el-col :span="24" class="mb20">
  <el-form-item label="备份基础路径" prop="backupBasePath">
    <el-input
      v-model="state.ruleForm.backupBasePath"
      placeholder="选填，如 /home/backups/smom"
      maxlength="450"
      clearable
    ></el-input>
  </el-form-item>
</el-col>
```

- [ ] **Step 3: 运行类型检查**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/views/project/components/projectDialog.vue
git commit -m "feat: 项目弹窗新增备份基础路径输入框"
```

---

### Task 5: 发布信息卡片 — 备份路径输入框 + 持久化

**Files:**
- Modify: `src/views/papersPublish/index.vue`

**Interfaces:**
- Consumes: `useProjectDb` (existing DAO), `publishConfig.backupBasePath` (from Task 1)
- Produces: template 中输入框 + script 中 `watch` 持久化逻辑

- [ ] **Step 1: 新增 `import`**

在第 179 行（`utils/other` import 之后）加：

```ts
import { useProjectDb } from "@/database/project/index";
```

- [ ] **Step 2: 新增 `watch` 导入**

第 169 行已有 `ref, reactive, onBeforeMount, defineAsyncComponent, nextTick`，追加 `watch`：

```ts
import { ref, reactive, onBeforeMount, defineAsyncComponent, nextTick, watch } from "vue";
```

- [ ] **Step 3: 在 template 中「发布信息」行前新增备份路径输入框**

第 85 行 `<tr v-show="publishConfig.notes">` 之前插入：

```html
<tr>
  <th>备份路径</th>
  <td colspan="3">
    <el-input
      v-model="publishConfig.backupBasePath"
      placeholder="选填，配置后备份到指定路径；不填则使用默认路径"
      :disabled="publishItem.loading"
      clearable
    />
  </td>
</tr>
```

- [ ] **Step 4: 新增持久化逻辑**

在第 198 行 `publishItem` 定义之后插入完整的持久化代码块：

```ts
// 备份路径持久化
const projectDbForBackup = useProjectDb();
const isLoadingBackupPath = ref(false);
let saveBackupPathTimer: ReturnType<typeof setTimeout>;

// 回填：解析 .smom 后，从数据库加载备份路径
const loadBackupBasePath = async () => {
  if (!publishConfig.projectName) return;
  isLoadingBackupPath.value = true;
  try {
    const result = await projectDbForBackup.getProjectList({
      code: null, name: publishConfig.projectName, sorting: null,
      skipCount: 0, maxResultCount: 1000,
    });
    if (result.code === 0) {
      // getProjectList 的 name 是 LIKE 模糊匹配，前端精确过滤
      const project = result.data.data.find(p => p.name === publishConfig.projectName);
      if (project) publishConfig.backupBasePath = project.backupBasePath ?? '';
    }
  } catch (e) {
    console.error('加载备份路径失败:', e);
  } finally {
    isLoadingBackupPath.value = false;
  }
};

// 用户修改时自动持久化（debounce 800ms）
watch(
  () => publishConfig.backupBasePath,
  (newVal) => {
    if (isLoadingBackupPath.value || !publishConfig.projectName) return;
    clearTimeout(saveBackupPathTimer);
    saveBackupPathTimer = setTimeout(async () => {
      try {
        const result = await projectDbForBackup.getProjectList({
          code: null, name: publishConfig.projectName, sorting: null,
          skipCount: 0, maxResultCount: 1000,
        });
        if (result.code !== 0) return;
        const project = result.data.data.find(p => p.name === publishConfig.projectName);
        if (!project) return;
        project.backupBasePath = newVal || null;
        await projectDbForBackup.updateProject(project);
      } catch (e) {
        console.error('持久化备份路径失败:', e);
      }
    }, 800);
  }
);
```

- [ ] **Step 5: 在 `onSelectPublishFile` 解析完成后调用回填**

第 274 行 `ElMessage.success("解析[SMOM发布文件]成功！");` 之后，`publishItem.value.loading = false;` 之前插入：

```ts
  await loadBackupBasePath();
```

- [ ] **Step 6: 运行类型检查**

```bash
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/views/papersPublish/index.vue
git commit -m "feat: 发布信息卡片新增备份路径输入框及持久化逻辑"
```

---

### Task 6: `getBackupPath` 签名变更

**Files:**
- Modify: `src/views/papersPublish/index.vue`

**Interfaces:**
- Consumes: `publishConfig.backupBasePath` (from Task 5)
- Produces: `getBackupPath(path, currentDate, backupBasePath?)` — 新签名，14 处调用点全部更新

- [ ] **Step 1: 修改 `getBackupPath` 函数体**

替换第 2236-2241 行：

```ts
// 获取备份路径
const getBackupPath = (path: string, currentDate: string, backupBasePath?: string | null) => {
  const bkPath = removeSlash(path);
  const bkLastIndex = bkPath.lastIndexOf("/");
  const folderName = currentDate.replace(/-/g, "").replace(/:/g, "").replace(/\s+/g, "");
  const fileName = bkPath.substring(bkLastIndex + 1);

  // 有自定义基础路径 → 使用自定义路径作为前缀
  if (backupBasePath) {
    return `${removeSlash(backupBasePath)}/${folderName}/${fileName}`;
  }

  // 无自定义路径 → 保持现有逻辑
  const backupPrefixPath = bkPath.substring(0, bkLastIndex);
  return `${backupPrefixPath}/Backups/${folderName}/${fileName}`;
};
```

- [ ] **Step 2: 更新 `localPublishBeforeBackup` 内 5 处 `getBackupPath` 调用（A 组）**

每处 `getBackupPath(xxx, currentDate)` 加第 3 参 `publishConfig.backupBasePath`：

| 行号 | 原调用 | 改为 |
|------|--------|------|
| 770 | `getBackupPath(bLocalPublishConfig.webApiHost.serverConfigs[j].publishPath, currentDate)` | 末尾加 `, publishConfig.backupBasePath` |
| 794 | 同上 pattern（ScheduleServer） | 末尾加 `, publishConfig.backupBasePath` |
| 818 | 同上 pattern（WebClient） | 末尾加 `, publishConfig.backupBasePath` |
| 842 | 同上 pattern（SpcMonitor） | 末尾加 `, publishConfig.backupBasePath` |
| 866 | `getBackupPath(bLocalPublishConfig.wpfClient.publishPath, currentDate)` | 末尾加 `, publishConfig.backupBasePath` |

- [ ] **Step 3: 更新 `remotePublishBeforeBackup` 内 5 处 `getBackupPath` 调用（A 组）**

同上 pattern，每处 `getBackupPath(xxx, currentDate)` 加第 3 参 `publishConfig.backupBasePath`：

| 行号 | 所属服务 |
|------|---------|
| 1791 | WebApiHost |
| 1822 | ScheduleServer |
| 1849 | WebClient |
| 1876 | SpcMonitor |
| 1899 | WpfClient |

- [ ] **Step 4: 修改 `localPublishServerBackup` 签名 + 内部调用（B 组）**

第 895 行，加第 4 参：

```ts
const localPublishServerBackup = async (
  publishServer: PublishServerType,
  currentDate: string,
  serverName: string,
  backupBasePath?: string | null,  // ponytail: optional to avoid changing all callers at once
) => {
```

第 915 行 `getBackupPath(serverConfig.publishPath, currentDate)` → 加 `, backupBasePath`。

- [ ] **Step 5: 修改 `localPublishWpfBackup` 签名 + 内部调用（B 组）**

第 978 行，加第 5 参：

```ts
const localPublishWpfBackup = async (
  publishServer: PublishWpfType,
  currentDate: string,
  serverName: string,
  isNewVersion: boolean | null = false,
  backupBasePath?: string | null,
) => {
```

第 996 行 `getBackupPath(publishServer.publishPath, currentDate)` → 加 `, backupBasePath`。

- [ ] **Step 6: 修改 `remotePublishServerBackup` 签名 + 内部调用（B 组）**

第 2089 行，加第 4 参：

```ts
const remotePublishServerBackup = async (
  publishServers: PublishServerType[],
  currentDate: string,
  serverName: string,
  backupBasePath?: string | null,
) => {
```

第 2113 行 `getBackupPath(serverConfig.publishPath, currentDate)` → 加 `, backupBasePath`。

- [ ] **Step 7: 修改 `remotePublishWpfBackup` 签名 + 内部调用（B 组）**

第 1940 行，加第 5 参：

```ts
const remotePublishWpfBackup = async (
  publishServer: PublishWpfType,
  currentDate: string,
  serverName: string,
  isNewVersion: boolean | null = false,
  backupBasePath?: string | null,
) => {
```

第 1961 行 `getBackupPath(publishServer.publishPath, currentDate)` → 加 `, backupBasePath`。

- [ ] **Step 8: 更新 B 组方法的 10 处调用方传参**

在 `localPublishBeforeBackup` 中（4 处 `localPublishServerBackup` + 1 处 `localPublishWpfBackup`），每处调用末尾加 `publishConfig.backupBasePath`：

| 行号 | 原调用 |
|------|--------|
| 758 | `localPublishServerBackup(..., "WebApiHost")` → `localPublishServerBackup(..., "WebApiHost", publishConfig.backupBasePath)` |
| 782 | 同上 pattern（ScheduleServer） |
| 806 | 同上 pattern（WebClient） |
| 829 | 同上 pattern（SpcMonitor） |
| 853 | `localPublishWpfBackup(..., "WpfClient", localPublishConfig.value.isNewVersion)` → `localPublishWpfBackup(..., "WpfClient", localPublishConfig.value.isNewVersion, publishConfig.backupBasePath)` |

在 `remotePublishBeforeBackup` 中同理（4 处 `remotePublishServerBackup` + 1 处 `remotePublishWpfBackup`）：

| 行号 | 原调用 |
|------|--------|
| 1778 | `remotePublishServerBackup(..., "WebApiHost")` → `remotePublishServerBackup(..., "WebApiHost", publishConfig.backupBasePath)` |
| 1805 | 同上 pattern（ScheduleServer） |
| 1836 | 同上 pattern（WebClient） |
| 1862 | 同上 pattern（SpcMonitor） |
| 1886 | `remotePublishWpfBackup(..., "WpfClient", remotePublishConfig.value.isNewVersion)` → `remotePublishWpfBackup(..., "WpfClient", remotePublishConfig.value.isNewVersion, publishConfig.backupBasePath)` |

- [ ] **Step 9: 运行类型检查 + 构建**

```bash
npm run build
```

预期：零类型错误。如有 `getBackupPath` 调用点漏改，TS 会在此报错。

- [ ] **Step 10: Commit**

```bash
git add src/views/papersPublish/index.vue
git commit -m "feat: getBackupPath 支持自定义备份基础路径"
```

---

## Verification

全部 task 完成后，执行端到端验证：

1. **全新安装验证** — 删除 `smom.db`，启动应用，检查 `t_project` 表含 `backup_base_path` 列
2. **升级验证** — 使用已有 `smom.db`（无 `backup_base_path` 列），启动应用，检查 `PRAGMA table_info` 已添加
3. **UI 验证** — 打开项目编辑弹窗，确认「备份基础路径」输入框可见
4. **发布验证** — 解析一个 `.smom` 文件，确认「备份路径」输入框从数据库回填
5. **备份验证** — 配置路径后发布，检查备份文件写入指定路径；不配置时走默认路径
6. **持久化验证** — 修改备份路径后关闭窗口，重新打开同一 `.smom`，确认路径保持

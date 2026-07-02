# 服务端备份路径配置 — 需求分析报告

> 版本：v1.2 | 日期：2026-07-02 | 作者：SIE-QIUQINGSHENG | 审阅：Round 4

---

## 1. 需求概述

### 1.1 需求来源

在「手动发布」(`papersPublish`) 界面中，新增"服务端备份路径"的可配置能力。用户在发布时可以为每个项目指定一个自定义的服务端备份基础路径，覆盖现有的默认备份路径计算逻辑。

### 1.2 用户故事

> 作为 SMOM 发布工具的使用者，我希望能够在发布时为备份文件指定一个自定义的服务端路径（如 `/data/backups/myproject`），而不是固定在发布路径的上级目录的 `Backups/` 子目录下。当我配置了路径后，备份文件写入我指定的位置；不配置时，保持现有行为不变。

### 1.3 成功标准

| 编号 | 标准 | 验证方式 |
|------|------|----------|
| S1 | 项目管理界面可配置备份基础路径，选填字段 | 打开项目新增/编辑弹窗，看到新字段 |
| S2 | 发布信息卡片在「发布前备份」开关下方显示备份路径输入框 | 解析 .smom 后界面渲染新输入框 |
| S3 | 配置路径后，备份文件写入 `${basePath}/{日期时间戳}/{文件名}` | 远程/本机发布后检查备份文件位置 |
| S4 | 不配置路径时，保持现有行为：`${publishPath}/../Backups/{日期时间戳}/{文件名}` | 回归测试 |
| S5 | 路径配置持久化到 SQLite，下次发布同一项目自动回填 | 关闭重开后重新发布同一项目 |
| S6 | 备份记录 (`t_backup`) 中 `backupPath` 字段记录实际使用的路径 | 查看备份记录详情 |

---

## 2. 现状分析

### 2.1 当前备份路径计算

```
文件: src/views/papersPublish/index.vue:2236

function getBackupPath(path: string, currentDate: string):
  Input:  publishPath = "/app/webapi/Bin"
          currentDate = "2026-07-02 14:30:00"

  1. bkPath = removeSlash(path)           → "/app/webapi/Bin"
  2. 取上级目录                             → "/app/webapi"
  3. folderName = 日期去分隔符              → "20260702143000"
  4. return "/app/webapi/Backups/20260702143000/Bin"
```

**特点**：备份路径始终在 `publishPath` 的上级目录的 `Backups/` 下，不可配置。

### 2.2 备份路径调用点（共 14 处，分布在 6 个方法中）

**A. 备份路径记录**（`*BeforeBackup` 方法中，用于保存到备份记录 `backupItemsJson`）

| 方法 | 行号 | 场景 |
|------|------|------|
| `localPublishBeforeBackup` | 770, 794, 818, 842, 866 | 本机：WebApiHost / ScheduleServer / WebClient / SpcMonitor / WpfClient |
| `remotePublishBeforeBackup` | 1790, 1821, 1848, 1874, 1898 | 远程：同上 5 个服务 |

**B. 实际备份执行**（`*ServerBackup` / `*WpfBackup` 方法中，用于创建目录和复制文件）

| 方法 | 行号 | 场景 |
|------|------|------|
| `localPublishServerBackup` | 915 | 本机：非 WPF 服务备份执行 |
| `localPublishWpfBackup` | 996 | 本机：WPF 服务备份执行 |
| `remotePublishServerBackup` | 2113 | 远程：非 WPF 服务备份执行 |
| `remotePublishWpfBackup` | 1961 | 远程：WPF 服务备份执行 |

> ⚠️ A 组和 B 组方法都需要传递 `basePath`。A 组由 `localPublishBeforeBackup` / `remotePublishBeforeBackup` 直接调用 `getBackupPath`；B 组在各自的 `*Backup` 方法内部调用，需要从上层传入 `basePath`。

### 2.3 数据库现状

```
表: t_project (sqlite.ts:18-25)
┌──────────────────┬──────────┬──────────────────┐
│ 列               │ 类型     │ 说明             │
├──────────────────┼──────────┼──────────────────┤
│ id               │ INTEGER  │ 主键自增         │
│ code             │ TEXT     │ 项目编码         │
│ name             │ TEXT     │ 项目名称         │
│ is_default       │ INTEGER  │ 是否默认         │
│ assembly_out_path│ TEXT     │ 程序集输出路径   │
│ description      │ TEXT     │ 描述             │
└──────────────────┴──────────┴──────────────────┘
```

需要新增列 `backup_base_path TEXT`。

已有先例：`ensureSchema` 末尾（102-106 行）通过 `PRAGMA table_info` 检测 `build_mode` 列，不存在则 `ALTER TABLE` 添加。本次沿用相同模式。

### 2.4 数据访问层现状

```
文件: src/database/project/index.ts

所有 SQL 为硬编码列名：
  - getProjectList:     "select id,code,name,description,is_default isDefault,
                         assembly_out_path assemblyOutPath from t_project"
  - getProjectDefault:  同上
  - getProjectById:     同上
  - insertProject:      "INSERT INTO t_project (code, name, description, is_default,
                         assembly_out_path) VALUES($1,$2,$3,$4,$5)"
  - updateProject:      "UPDATE t_project SET code=$1, name=$2, description=$3,
                         is_default=$4, assembly_out_path=$5 WHERE id=$6"
```

> ⚠️ 每个 SQL 的列名和参数占位符都是手工维护的，新增列需要修改 **所有** SELECT/INSERT/UPDATE 语句。

### 2.5 UI 现状

| 界面 | 文件 | 说明 |
|------|------|------|
| 项目弹窗 | `project/components/projectDialog.vue` | 当前字段：项目编码、项目名称、是否默认、程序集输出路径、描述 |
| 发布信息卡片 | `papersPublish/index.vue` | 当前字段：项目名称、项目环境、发布方式、生成时间、发布前备份(开关)、发布信息(备注) |

### 2.6 类型定义

```ts
// src/types/project.d.ts — 需新增 backupBasePath
declare type RowProjectType = {
    id: number | null;
    code: string | null;
    name: string | null;
    description: string | null;
    isDefault: number | null;
    assemblyOutPath: string | null;
    // + backupBasePath: string | null;
};

// src/types/manuallyPublish.d.ts — CommonPapersPublishType 需新增
declare type CommonPapersPublishType = {
    // ...现有字段
    // + backupBasePath?: string;  // 服务端备份基础路径（从数据库回填）
};
```

---

## 3. 方案设计

### 3.1 数据层

#### Schema 变更（`sqlite.ts`）

沿用现有 `PRAGMA table_info` + `ALTER TABLE` 的模式（已有 `build_mode` 先例，第 102-106 行）：

**1. 更新建表语句** — 全新安装时包含新列：

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

**2. 新增 ALTER TABLE** — 已安装客户端升级：

```ts
// 在 ensureSchema 末尾追加（参照 build_mode 的写法）
const projectColumns = await database.select<{ name: string }[]>(
  "PRAGMA table_info(t_project)"
);
const hasBackupBasePath = projectColumns.some((col) => col.name === "backup_base_path");
if (!hasBackupBasePath) {
  await database.execute("ALTER TABLE t_project ADD COLUMN backup_base_path TEXT");
}
```

> 两条路径都覆盖：全新安装走 `CREATE TABLE IF NOT EXISTS`（含新列），已安装升级走 `ALTER TABLE`。

#### 类型变更

- `RowProjectType` 新增 `backupBasePath: string | null`
- `CommonPapersPublishType` 新增 `backupBasePath?: string`

#### CRUD 适配

每个 SQL 语句依次修改：

```
SELECT: + backup_base_path backupBasePath
INSERT: + backup_base_path 列 + $6 参数
UPDATE: + backup_base_path=$6, 后续参数序号后移
```

具体变更：

| 方法 | 当前参数 | 变更后参数 |
|------|---------|-----------|
| `getProjectList` | select id,code,name,description,is_default,assembly_out_path | + backup_base_path |
| `getProjectDefault` | 同上 | + backup_base_path |
| `getProjectById` | 同上 | + backup_base_path |
| `insertProject` | VALUES($1,$2,$3,$4,$5) | VALUES($1,$2,$3,$4,$5,$6) |
| `updateProject` | SET code=$1,…assembly_out_path=$5 WHERE id=$6 | SET …assembly_out_path=$5, backup_base_path=$6 WHERE id=$7 |

### 3.2 界面层

#### 3.2.1 项目编辑弹窗

位置: `src/views/project/components/projectDialog.vue`

在「程序集输出路径」行下方，新增：

```html
<el-col :span="24" class="mb20">
  <el-form-item label="备份基础路径" prop="backupBasePath">
    <el-input
      v-model="state.ruleForm.backupBasePath"
      placeholder="选填，如 /home/backups/smom"
      maxlength="450"
      clearable
    />
  </el-form-item>
</el-col>
```

- 选填字段，无验证规则
- `maxlength="450"` 与现有「程序集输出路径」一致
- ⚠️ 需在 `state.ruleForm` 初始值中添加 `backupBasePath: null`（第 111 行附近，`getDefaultSubObject` 会将 string 类型重置为 null，行为正确）

#### 3.2.2 发布信息卡片

位置: `src/views/papersPublish/index.vue` template 部分，第 84 行后「发布信息」行之前。

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

**数据流**：

```
.smom 解析完成 → 拿到 projectName
  → getProjectList({ name: projectName }) 查数据库
  → 找到项目 → publishConfig.backupBasePath = project.backupBasePath
  → 界面回填输入框
  → 用户修改 → watch 检测变化 → projectDb.updateProject 写入数据库
```

> ⚠️ `papersPublish/index.vue` 当前未引入 `useProjectDb`，需新增 `import { useProjectDb } from "@/database/project/index"`。

**持久化实现**（用 `watch` 取代 `@change`，避免 blur 时序问题）：

> ⚠️ 注意：`getProjectList` 的 `name` 参数是 `like` 模糊匹配（`%name%`），不是精确匹配。用 `getProjectList` 后加前端精确过滤。

```ts
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
      const project = result.data.data.find(p => p.name === publishConfig.projectName);
      if (project) publishConfig.backupBasePath = project.backupBasePath ?? '';
    }
  } catch (e) {
    console.error('加载备份路径失败:', e);
  } finally {
    isLoadingBackupPath.value = false;
  }
};
// 在 onSelectPublishFile 解析完成后调用

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

> ⚠️ `updateProject` 是全量更新，需要传完整项目对象。直接复用查询返回的对象，只覆盖 `backupBasePath` 字段。

### 3.3 备份逻辑变更

#### 修改 `getBackupPath`

```ts
// 现有签名
const getBackupPath = (path: string, currentDate: string) => { ... }

// 新签名
const getBackupPath = (path: string, currentDate: string, basePath?: string | null) => {
  const bkPath = removeSlash(path);
  const bkLastIndex = bkPath.lastIndexOf("/");
  const folderName = currentDate.replace(/-/g, "").replace(/:/g, "").replace(/\s+/g, "");
  const fileName = bkPath.substring(bkLastIndex + 1);

  // 有自定义基础路径 → 使用自定义路径作为前缀
  if (basePath) {
    return `${removeSlash(basePath)}/${folderName}/${fileName}`;
  }

  // 无自定义路径 → 保持现有逻辑
  const backupPrefixPath = bkPath.substring(0, bkLastIndex);
  return `${backupPrefixPath}/Backups/${folderName}/${fileName}`;
};
```

#### 传递 basePath 的改动

涉及 **6 个方法** 的签名变更，按粒度分为两类：

**A 组：备份路径记录方法（仅修改 getBackupPath 调用）**

| 方法 | 当前 | 改后 |
|------|------|------|
| `localPublishBeforeBackup()` | 内部 5 处调用 `getBackupPath(path, date)` | 传入 `publishConfig.backupBasePath` 作为第 3 参 |
| `remotePublishBeforeBackup()` | 同上 5 处 | 同上 |

> A 组方法在 top-level，可直接读取 `publishConfig.backupBasePath`，**无需改方法签名**。

**B 组：实际备份执行方法（需改方法签名 + 内部 getBackupPath 调用）**

| 方法 | 当前签名 | 改后签名 | 内部调用点 |
|------|----------|----------|-----------|
| `localPublishServerBackup` | `(publishServer, currentDate, serverName)` | `+ basePath?: string` | 915 |
| `localPublishWpfBackup` | `(publishServer, currentDate, serverName, isNewVersion?)` | `+ basePath?: string` | 996 |
| `remotePublishServerBackup` | `(publishServers[], currentDate, serverName)` | `+ basePath?: string` | 2113 |
| `remotePublishWpfBackup` | `(publishServer, currentDate, serverName, isNewVersion?)` | `+ basePath?: string` | 1961 |

> B 组方法的调用方（`localPublishBeforeBackup` / `remotePublishBeforeBackup`）需要同步传入 `publishConfig.backupBasePath`。共有 10 处调用方更新（`localPublishServerBackup` ×4 + `localPublishWpfBackup` ×1 + `remotePublishServerBackup` ×4 + `remotePublishWpfBackup` ×1）。

**汇总**：签名变更 4 个方法 + getBackupPath 14 处调用点 + 调用方传参 10 处。

### 3.4 错误处理

| 场景 | 行为 |
|------|------|
| 配置了路径但目录不存在 | `mkdir -p` 创建（现有逻辑已覆盖） |
| 配置了路径但无写权限 | 备份命令执行失败，日志报错，发布继续（现有行为） |
| 路径为空字符串 | 视为未配置，走默认逻辑 |

---

## 4. 影响范围汇总

### 4.1 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/database/sqlite.ts` | 修改 | 建表语句加列 + PRAGMA 检测后 ALTER TABLE 加列 |
| `src/types/project.d.ts` | 修改 | `RowProjectType` 新增 `backupBasePath` |
| `src/types/manuallyPublish.d.ts` | 修改 | `CommonPapersPublishType` 新增 `backupBasePath` |
| `src/database/project/index.ts` | 修改 | 5 个方法的 SQL 语句适配新列 |
| `src/views/project/components/projectDialog.vue` | 修改 | 新增备份基础路径输入框 |
| `src/views/papersPublish/index.vue` | 修改 | 新增备份路径输入框、回填逻辑、getBackupPath 签名变更 |

### 4.2 无影响部分

- 备份记录表 `t_backup` 结构不变（已通过 `backupItemsJson` 存储完整路径）
- 定时发布不受影响（走相同的 `publish.config.json` 流程）
- 还原功能不受影响（读取 `backupItemsJson` 中的 `backupPath` 字段）

---

## 5. 风险与约束

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 已安装客户端 ALTER TABLE 执行失败 | 低 | 沿用 `build_mode` 已有的 `PRAGMA table_info` + `ALTER TABLE` 模式，已验证可行 |
| 用户配置了无效路径导致备份失败 | 中 | 不阻塞发布流程，日志报错 |
| `getBackupPath` 签名变更漏改调用点 | 低 | TypeScript 编译期即可发现，共 14 处 + 调用方传参 10 处 |
| 项目名在数据库匹配不到 | 低 | `getProjectList` LIKE 查询不到 → `backupBasePath` 为 null，走默认逻辑 |

---

## 6. 待确认问题

| # | 问题 | 建议 |
|---|------|------|
| Q1 | 根据 `projectName` 查项目获取 `backupBasePath`，当前 DAO 无 `getProjectByName` | 用 `getProjectList({ name: projectName })` 即可，无需新增专用方法 |
| Q2 | `el-input` 的 `@change` 在 blur 触发，用户输入后直接点发布可能未持久化 | 改用 `watch(() => publishConfig.backupBasePath, ...)` 带 debounce 实时写库 |
| Q3 | 新参数命名一致性 | `getBackupPath` 第 3 参建议用 `backupBasePath` 与类型/数据库字段一致 |

---

## 7. 验收清单

- [ ] 项目弹窗能输入「备份基础路径」并保存
- [ ] 发布信息卡片显示「备份路径」输入框，从数据库回填
- [ ] 有配置时，备份到指定路径（本机发布）
- [ ] 有配置时，备份到指定路径（远程发布）
- [ ] 无配置时，备份到默认路径（回归验证）
- [ ] 备份记录中 `backupPath` 值正确
- [ ] 修改路径后实时持久化到数据库

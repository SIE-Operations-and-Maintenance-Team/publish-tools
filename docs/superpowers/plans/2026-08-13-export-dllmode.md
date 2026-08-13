# 导出配置包含获取DLL方式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 应用配置导出时保留真实的获取DLL方式（含 TFS/Git 配置记录随导出），导入时插入新记录并重映射 id，跨机器迁移后可直接发布/备份。

**Architecture:** 导出文件格式从 v1 升为 v2（`ExportItem` 新增可选 `tfsConfigs`/`gitConfigs` 数组），`collectExportData` 原样导出 `dllMode/dllModeValue` 并收集引用的 TFS/Git 配置；`executeImport` 先插入 TFS/Git 配置（直接 SQL 绕过 `insertTfs` 重名校验，总是插入新记录）并建立 oldId→newId 映射，重写 `dllModeValue` 中的 id 后再插入 appconfig；失败补偿扩展为清理本次插入的 TFS/Git 记录。UI 层版本检查改为接受 v1/v2。

**Tech Stack:** Vue 3 + TypeScript 5.2 + Tauri 2（tauri-plugin-sql）。无单元测试设施，验证 = `vue-tsc` 类型检查 + `npm run build` + 手工验证。

## Global Constraints

- 导出文件 `version` 从 `1` 升为 `2`（类型 `1 | 2`）；导入端接受 `1` 和 `2`，v1 文件走原逻辑（无 tfs/git 字段）
- TFS/Git 配置导入**总是插入新记录**，必须用 `database.execute` 直接 SQL，**绕过** `src/database/teamFoundationServer/index.ts` 的 `insertTfs` 重名校验
- 悬空引用（引用的 TFS/Git 配置不存在或 dllModeValue 无效）：该条回退 `dllMode: "当天", dllModeValue: null` + `console.warn`，**不跳过导出**
- `dllModeValue` 重映射：解析 JSON 后**精确替换 `id` 字段**再 stringify，**禁止使用正则**（避免误伤变更集编号/日期/commit sha 中的数字）
- 导入失败补偿：除现有 `newProjectId` 级联删除外，**新增删除本次插入的 `newTfsIds` / `newGitIds`**，只删本次插入的，不影响目标库原有记录；补偿清理失败 `console.error` 上报
- 项目无单元测试设施，不新增测试框架；每个任务以 `npx vue-tsc --noEmit` 验证，最终任务跑完整 `npm run build`
- TS 类型文件（`*.d.ts`）使用 tab 缩进（项目既有风格）
- 提交信息用中文，前缀遵循仓库惯例（`feat:` / `fix:` / `docs:`）

---

### Task 1: 导出文件类型定义升级 v2

**Files:**
- Modify: `src/types/import-export.d.ts`

**Interfaces:**
- Produces: `ExportFile.version: 1 | 2`、`ExportItem.tfsConfigs?: ExportTfsConfig[]`、`ExportItem.gitConfigs?: ExportGitConfig[]`、`ExportTfsConfig`（`oldTfsId: number` + tfs 字段）、`ExportGitConfig`（`oldGitId: number` + git 字段）——Task 2/3 消费

- [ ] **Step 1: 修改类型定义**

将 `src/types/import-export.d.ts` 中的 `ExportFile.version: 1` 改为 `1 | 2`，`ExportItem` 增加两个可选字段，并在文件末尾新增两个类型。修改后完整文件内容：

```typescript
// src/types/import-export.d.ts

/** 导出文件顶层结构 */
declare type ExportFile = {
	version: 1 | 2;          // v2：新增 tfsConfigs/gitConfigs（TFS/Git 配置随导出）
	exportedAt: string;        // ISO 8601
	items: ExportItem[];
};

/** 单个导出项 */
declare type ExportItem = {
	project: ExportProject;
	appconfig: ExportAppconfig;
	servers: ExportServer[];
	tfsConfigs?: ExportTfsConfig[];   // v2 新增，本 item 引用的 TFS 配置（按 id 去重，不含 id）
	gitConfigs?: ExportGitConfig[];   // v2 新增，本 item 引用的 Git 配置（按 id 去重，不含 id）
};

/** 导出项目字段（不含 id） */
declare type ExportProject = {
	code: string;
	name: string;
	description: string | null;
	isDefault: number | null;
	assemblyOutPath: string | null;
};

/** 导出应用配置字段（不含 id, projectId） */
declare type ExportAppconfig = {
	environment: number;
	msBuildPath: string | null;
	dllMode: string | null;
	dllModeValue: string | null;
	buildMode: string | null;
	configItemsJson: string;
};

/** 导出服务器字段（不含 id, projectId） */
declare type ExportServer = {
	oldServerId: number;   // 保存原始 server ID 用于导入时重映射
	name: string;
	os: number;
	ip: string;
	port: number;
	account: string;
	pwd: string;
	description: string | null;
};

/** 导出 TFS 配置字段（不含 id，oldTfsId 用于导入时重映射） */
declare type ExportTfsConfig = {
	oldTfsId: number;
	tfsName: string | null;
	tfsServerUrl: string | null;
	tfsSourcePath: string | null;
	tfsLocalPath: string | null;
	tfvcPath: string | null;
	remark: string | null;
};

/** 导出 Git 配置字段（不含 id，oldGitId 用于导入时重映射） */
declare type ExportGitConfig = {
	oldGitId: number;
	gitName: string | null;
	gitRepository: string | null;
	gitPath: string | null;
	branchName: string | null;
	remark: string | null;
};

/** 导入预览行 */
declare type ImportPreviewItem = {
	index: number;
	projectCode: string;
	projectName: string;
	environment: number;
	serverCount: number;
	conflict: boolean;          // 当前库中 project.code 是否冲突
};

/** 单条导入结果 */
declare type ImportResult = {
	index: number;
	success: boolean;
	projectCode: string;
	environment: number;
	message: string;
};
```

- [ ] **Step 2: 类型检查验证**

Run: `npx vue-tsc --noEmit`
Expected: 无错误（现有代码 `exportFile.version !== 1` 处 `version` 类型收窄为 `1 | 2`，`!== 1` 比较合法，不会报错）

- [ ] **Step 3: Commit**

```bash
git add -f src/types/import-export.d.ts
git commit -m "feat: 导出文件类型升级 v2，支持 TFS/Git 配置随导出"
```

---

### Task 2: 导出流程保留获取DLL方式

**Files:**
- Modify: `src/database/import-export/index.ts`
  - 新增 `extractDllModeId` helper（放 `extractServerIds` 之后）
  - `collectExportData` 中第 52 行（查询 appconfig 之后）到第 104 行（push 之前）插入解析逻辑
  - `collectExportData` 中 push 部分（原第 104-122 行）替换

**Interfaces:**
- Consumes: Task 1 的 `ExportTfsConfig` / `ExportGitConfig` 类型；全局类型 `RowTfsType`（`src/types/tfs.d.ts`）、`RowGitType`（`src/types/git.d.ts`）
- Produces: `collectExportData(appconfigIds: number[]): Promise<ExportItem[]>` 现在返回含 `tfsConfigs`/`gitConfigs` 的 item——Task 3 消费

- [ ] **Step 1: 新增 `extractDllModeId` helper**

在 `src/database/import-export/index.ts` 中 `extractServerIds` 函数之后新增：

```typescript
/**
 * 从 dllModeValue JSON 中提取引用的 TFS/Git 配置 id
 * @param dllModeValue - SelectTfsType / SelectGitType 的 JSON 字符串
 * @returns 有效 id；dllModeValue 为空、非 JSON、或 id 非正数时返回 null
 */
function extractDllModeId(dllModeValue: string | null): number | null {
  if (!dllModeValue) return null;
  try {
    const parsed = JSON.parse(dllModeValue);
    return typeof parsed?.id === "number" && parsed.id > 0 ? parsed.id : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: 在 `collectExportData` 中新增 dllMode 解析逻辑**

在 `collectExportData` 循环内、查询 servers（`const servers: ExportServer[] = [];` 之前）插入：

```typescript
// 2.5 解析获取DLL方式：TFS/Git 模式收集引用的配置记录；悬空引用回退「当天」
let dllMode = ac.dllMode;
let dllModeValue = ac.dllModeValue;
const tfsConfigs: ExportTfsConfig[] = [];
const gitConfigs: ExportGitConfig[] = [];

const fallbackToToday = () => {
  console.warn(
    `[import-export] appconfig ${id} 的获取DLL方式引用无效（dllMode=${ac.dllMode}），回退为「当天」`
  );
  dllMode = "当天";
  dllModeValue = null;
};

if (dllMode === "TFS") {
  const tfsId = extractDllModeId(dllModeValue);
  if (tfsId) {
    const tfsRows = await (
      await db()
    ).select<RowTfsType[]>(
      "SELECT id, tfs_name tfsName, tfs_server_url tfsServerUrl, tfs_source_path tfsSourcePath, tfs_local_path tfsLocalPath, tfvc_path tfvcPath, remark FROM t_team_foundation_server WHERE id = $1",
      [tfsId]
    );
    if (tfsRows && tfsRows.length > 0) {
      const tfs = tfsRows[0];
      tfsConfigs.push({
        oldTfsId: tfs.id ?? 0,
        tfsName: tfs.tfsName,
        tfsServerUrl: tfs.tfsServerUrl,
        tfsSourcePath: tfs.tfsSourcePath,
        tfsLocalPath: tfs.tfsLocalPath,
        tfvcPath: tfs.tfvcPath,
        remark: tfs.remark,
      });
    } else {
      fallbackToToday();
    }
  } else {
    fallbackToToday();
  }
} else if (dllMode === "Git") {
  const gitId = extractDllModeId(dllModeValue);
  if (gitId) {
    const gitRows = await (
      await db()
    ).select<RowGitType[]>(
      "SELECT id, git_name gitName, git_repository gitRepository, git_path gitPath, branch_name branchName, remark FROM t_git WHERE id = $1",
      [gitId]
    );
    if (gitRows && gitRows.length > 0) {
      const git = gitRows[0];
      gitConfigs.push({
        oldGitId: git.id ?? 0,
        gitName: git.gitName,
        gitRepository: git.gitRepository,
        gitPath: git.gitPath,
        branchName: git.branchName,
        remark: git.remark,
      });
    } else {
      fallbackToToday();
    }
  } else {
    fallbackToToday();
  }
}
```

> 说明：`fallbackToToday` 在循环内每 appconfig 定义一次，闭包捕获该次的 `dllMode`/`dllModeValue`；若某条引用无效，该条回退「当天」，其余条目不受影响。一个 appconfig 的 dllMode 只可能命中 TFS/Git 之一，`tfsConfigs`/`gitConfigs` 不会同时非空。

- [ ] **Step 3: 替换 push 部分的硬编码**

将 `collectExportData` 中原 push 代码（含注释 `// 导出时固定为「当天」获取方式，不保留原配置的获取DLL方式内容` 的整块，原第 104-122 行）替换为：

```typescript
// 原样保留获取DLL方式；TFS/Git 引用的配置记录随导出，悬空引用已回退「当天」
items.push({
  project: {
    code: proj.code ?? "",
    name: proj.name ?? "",
    description: proj.description,
    isDefault: proj.isDefault,
    assemblyOutPath: proj.assemblyOutPath,
  },
  appconfig: {
    environment: ac.environment ?? 0,
    msBuildPath: ac.msBuildPath,
    dllMode,
    dllModeValue,
    buildMode: ac.buildMode ?? "Debug",
    configItemsJson: ac.configItemsJson ?? "{}",
  },
  servers,
  tfsConfigs: tfsConfigs.length > 0 ? tfsConfigs : undefined,
  gitConfigs: gitConfigs.length > 0 ? gitConfigs : undefined,
});
```

- [ ] **Step 4: 类型检查验证**

Run: `npx vue-tsc --noEmit`
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add -f src/database/import-export/index.ts
git commit -m "feat: 导出配置时保留获取DLL方式，TFS/Git 配置记录随导出（悬空引用回退当天）"
```

---

### Task 3: 导入流程插入 TFS/Git 配置并重映射 id

**Files:**
- Modify: `src/database/import-export/index.ts`
  - `executeImport` 外层声明处（`let newProjectId = 0;` 附近）新增 `newTfsIds`/`newGitIds`
  - try 内、冲突检测之后、插 project 之前插入 TFS/Git 配置
  - 插 appconfig 的 execute 之前新增 `dllModeValue` 重映射
  - catch 补偿块中追加 TFS/Git 清理

**Interfaces:**
- Consumes: Task 1 的 `ExportItem.tfsConfigs/gitConfigs`；Task 2 导出的 item 结构
- Produces: `executeImport(items: ExportItem[]): Promise<ImportResult[]>` 完整支持 v2 文件——Task 4 验证

- [ ] **Step 1: 外层声明新增补偿删除列表**

`executeImport` 中 `let newProjectId = 0;`（带注释 `// 声明在外层，供 catch 中失败补偿清理使用`）之后新增：

```typescript
const newTfsIds: number[] = []; // 本次插入的 TFS 配置 id，失败时补偿删除
const newGitIds: number[] = []; // 本次插入的 Git 配置 id，失败时补偿删除
```

- [ ] **Step 2: try 内插入 TFS/Git 配置**

在 try 内 `const database = await db();` 与冲突检测（`// 1. 冲突检测...`）之后、`// 2. 插入新 project` 之前插入：

```typescript
// 1.5 插入 TFS/Git 配置（先于 project；总是插入新记录，不做同名匹配）
//     直接 SQL 插入，绕过 insertTfs 业务层的重名校验（t_git 的 insertGit 无校验，统一走直接 SQL）
const tfsIdMap: Record<number, number> = {};
for (const tfs of item.tfsConfigs ?? []) {
  const insertTfsResult = await database.execute(
    "INSERT INTO t_team_foundation_server (tfs_name, tfs_server_url, tfs_source_path, tfs_local_path, tfvc_path, remark) VALUES($1, $2, $3, $4, $5, $6) RETURNING id;",
    [
      tfs.tfsName,
      tfs.tfsServerUrl,
      tfs.tfsSourcePath,
      tfs.tfsLocalPath,
      tfs.tfvcPath,
      tfs.remark,
    ]
  );
  const newTfsId = insertTfsResult.lastInsertId ?? 0;
  if (!newTfsId || newTfsId <= 0) {
    throw new Error("插入 TFS 配置失败，未获取到新 ID");
  }
  newTfsIds.push(newTfsId);
  tfsIdMap[tfs.oldTfsId] = newTfsId;
}

const gitIdMap: Record<number, number> = {};
for (const git of item.gitConfigs ?? []) {
  const insertGitResult = await database.execute(
    "INSERT INTO t_git (git_name, git_repository, git_path, branch_name, remark) VALUES($1, $2, $3, $4, $5) RETURNING id;",
    [
      git.gitName,
      git.gitRepository,
      git.gitPath,
      git.branchName,
      git.remark,
    ]
  );
  const newGitId = insertGitResult.lastInsertId ?? 0;
  if (!newGitId || newGitId <= 0) {
    throw new Error("插入 Git 配置失败，未获取到新 ID");
  }
  newGitIds.push(newGitId);
  gitIdMap[git.oldGitId] = newGitId;
}
```

- [ ] **Step 3: appconfig 插入前重映射 dllModeValue 中的配置 id**

将 `// 3. 插入新 appconfig（buildMode 默认 Debug）` 的 execute 调用替换为（在 execute 前新增重映射逻辑，`dllModeValue` 变量替代原 `item.appconfig.dllModeValue` 参数）：

```typescript
// 3. 插入新 appconfig（buildMode 默认 Debug）
//    TFS/Git 模式：把 dllModeValue 中的配置 id 重映射为本次插入的新 id（精确替换 id 字段，不用正则）
let dllModeValue = item.appconfig.dllModeValue;
if (
  (item.appconfig.dllMode === "TFS" || item.appconfig.dllMode === "Git") &&
  dllModeValue
) {
  try {
    const parsed = JSON.parse(dllModeValue);
    const idMap = item.appconfig.dllMode === "TFS" ? tfsIdMap : gitIdMap;
    if (typeof parsed?.id === "number" && idMap[parsed.id]) {
      parsed.id = idMap[parsed.id];
      dllModeValue = JSON.stringify(parsed);
    }
  } catch {
    // dllModeValue 非 JSON 时原样写入（仅手工构造的文件可能出现，使用时报错由业务层提示）
  }
}
const insertAppconfigResult = await database.execute(
  "INSERT INTO t_app_config (project_id, environment, ms_build_path, dll_mode, dll_mode_value, build_mode, config_items_json) VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING id;",
  [
    newProjectId,
    item.appconfig.environment,
    item.appconfig.msBuildPath,
    item.appconfig.dllMode,
    dllModeValue,
    item.appconfig.buildMode || "Debug",
    item.appconfig.configItemsJson,
  ]
);
```

- [ ] **Step 4: catch 补偿扩展**

在 catch 块中现有 `if (newProjectId) { ... }` 补偿块之后（`result.success = false;` 之前）追加：

```typescript
// 失败补偿：删除本次已插入的 TFS/Git 配置记录（只删本次插入的，不影响目标库原有记录）
for (const tid of newTfsIds) {
  try {
    const database = await db();
    await database.execute(
      "DELETE FROM t_team_foundation_server WHERE id = $1",
      [tid]
    );
  } catch (cleanErr) {
    // 补偿清理失败需上报，不吞掉
    console.error(
      `[import-export] 补偿清理失败 TFS id=${tid}:`,
      cleanErr
    );
  }
}
for (const gid of newGitIds) {
  try {
    const database = await db();
    await database.execute("DELETE FROM t_git WHERE id = $1", [gid]);
  } catch (cleanErr) {
    // 补偿清理失败需上报，不吞掉
    console.error(
      `[import-export] 补偿清理失败 Git id=${gid}:`,
      cleanErr
    );
  }
}
```

- [ ] **Step 5: 类型检查验证**

Run: `npx vue-tsc --noEmit`
Expected: 无错误

- [ ] **Step 6: Commit**

```bash
git add -f src/database/import-export/index.ts
git commit -m "feat: 导入时插入 TFS/Git 配置并重映射 dllModeValue id，失败补偿清理新记录"
```

---

### Task 4: 导入端版本检查兼容 v1/v2 与全量验证

**Files:**
- Modify: `src/views/appconfig/index.vue:488-491`（`onImportConfig` 的版本检查）

**Interfaces:**
- Consumes: Task 1-3 的全部产出；验证端到端行为

- [ ] **Step 1: 修改版本检查**

将 `onImportConfig` 中的版本检查（`if (exportFile.version !== 1) { ... }`，原第 488-491 行）替换为：

```typescript
    // 5. 版本检查（v1：无 tfs/git 字段走原逻辑；v2：完整恢复获取DLL方式）
    if (![1, 2].includes(exportFile.version)) {
      ElMessage.error(`文件版本不兼容，当前支持 v1/v2，文件为 v${exportFile.version}`);
      return;
    }
```

- [ ] **Step 2: 全量构建验证**

Run: `npm run build`
Expected: `vue-tsc --noEmit` 无错误 + `vite build` 成功

- [ ] **Step 3: 手工验证清单**（按序执行）

| # | 场景 | 操作 | 预期 |
|---|---|---|---|
| 1 | 导出含各模式 | 配置页新建/选用含 `TFS`、`Git`、`DLL名称`、`日期范围`、`当天`、`全部` 的 appconfig，全选导出 | 导出成功；用 `aesDecrypt`（或临时打印解密内容）检查文件 JSON：`dllMode/dllModeValue` 原样保留，`tfsConfigs/gitConfigs` 按 id 去重 |
| 2 | 导入到干净库 | 清空 `t_team_foundation_server`/`t_git` 后导入导出文件 | 两表出现新记录；`t_app_config.dll_mode_value` 中 `id` 为新 id；编辑对话框打开 TFS/Git 选择器回显正确（名称、查询条件） |
| 3 | 发布/备份可用 | 对导入后的 appconfig 执行发布或生成备份项 | 按 TFS/Git 模式正常获取 DLL（`getTfsDllFiles`/`getGitDllFiles` 查到新记录） |
| 4 | 悬空引用回退 | 删除某 appconfig 引用的 TFS 配置后导出该条 | 导出成功且该条 `dllMode: "当天"`，控制台有 `console.warn` |
| 5 | 失败补偿 | 目标库只读（或无写入权限）时导入 | 该条 `导入失败: ...` 提示；无残留的新 project/tfs/git 记录 |
| 6 | v1 旧文件 | 用修改前导出的旧 v1 文件导入 | 正常导入，dllMode 为「当天」，不报版本错误 |

- [ ] **Step 4: Commit**

```bash
git add -f src/views/appconfig/index.vue
git commit -m "feat: 导入版本检查兼容 v1/v2"
```

# 导出配置包含获取DLL方式设计

**日期**: 2026-08-13  
**状态**: 已确认  
**相关表**: `t_app_config`, `t_team_foundation_server`, `t_git`  
**上游文档**: [2026-07-29-import-export-design.md](./2026-07-29-import-export-design.md)（原导入导出设计，本文档为其扩展）

---

## 背景与目标

应用配置导出（`src/database/import-export/index.ts`）当前把 `dllMode` 硬编码为 `"当天"`、`dllModeValue` 硬编码为 `null`，导致导出→导入后获取DLL方式丢失，需要手动重配。

目标：导出时保留真实的获取DLL方式（`全部` / `当天` / `最近3天` / `日期范围` / `DLL名称` / `TFS` / `Git`），导入后完整可用。

## 非目标

- 不导出备份记录、还原记录、定时发布、全局设置表（沿用原设计）
- 不做 TFS/Git 配置的更新/合并：导入始终插入新记录（见"导入策略"）
- 不改变 `t_team_foundation_server` / `t_git` 管理页的既有重名校验行为（仅导入流程绕过）

---

## 关键决策

| 决策点 | 结论 | 理由 |
|---|---|---|
| TFS/Git 的 `dllModeValue` 引用处理 | **连 TFS/Git 配置记录一起导出**，导入时插入新记录并重映射 id | 跨机器迁移后可直接发布/备份，无需手动重配 |
| 导入时同名/已有记录 | **总是插入新记录**（与 servers 导入行为一致） | 简单可靠；名称匹配复用存在"同名不同内容"歧义 |
| 悬空引用（引用的 TFS/Git 配置已被删除） | **该条回退 `"当天"` + console.warn**，不跳过导出 | 保证导入后可用，导出数量不变，与现状行为一致 |

---

## 数据结构变更（导出文件 v1 → v2）

`src/types/import-export.d.ts`：

```typescript
declare type ExportFile = {
  version: 1 | 2;              // v2：新增 tfsConfigs/gitConfigs 字段
  exportedAt: string;
  items: ExportItem[];
};

declare type ExportItem = {
  project: ExportProject;
  appconfig: ExportAppconfig;
  servers: ExportServer[];
  tfsConfigs?: ExportTfsConfig[];   // v2 新增，本 item 引用的 TFS 配置（去重，不含 id）
  gitConfigs?: ExportGitConfig[];   // v2 新增，本 item 引用的 Git 配置（去重，不含 id）
};

// 不含 id（导入时自增生成），oldTfsId 用于导入时重映射
declare type ExportTfsConfig = {
  oldTfsId: number;
  tfsName: string | null;
  tfsServerUrl: string | null;
  tfsSourcePath: string | null;
  tfsLocalPath: string | null;
  tfvcPath: string | null;
  remark: string | null;
};

declare type ExportGitConfig = {
  oldGitId: number;
  gitName: string | null;
  gitRepository: string | null;
  gitPath: string | null;
  branchName: string | null;
  remark: string | null;
};
```

说明：

- `ExportAppconfig.dllMode / dllModeValue` 改为**原样导出**（去掉硬编码）
- v1 文件无 `tfsConfigs/gitConfigs` 字段，导入端按字段可选性兼容，无需区分处理
- `configItemsJson` 中的 serverId 重映射机制（正则替换）不变，与本次改动正交

---

## 导出流程（`collectExportData`）

对每个 appconfig id：

1. 查询 appconfig / project / servers（现有逻辑不变）
2. **新增**：解析 `ac.dllMode`：
   - `dllMode === "TFS"`：解析 `dllModeValue` 为 `SelectTfsType`，取 `id` 查询 `t_team_foundation_server`
     - 查到 → 收集 `ExportTfsConfig`（按 id 去重），`dllMode/dllModeValue` 原样导出
     - 查不到（悬空）→ `console.warn`，该条回退 `dllMode: "当天", dllModeValue: null`
   - `dllMode === "Git"`：同上查 `t_git`
   - 其余模式：值自包含，原样导出，无需处理
3. 组装 `ExportItem`（含 `tfsConfigs` / `gitConfigs`）

## 导入流程（`executeImport`）

顺序：**先插 TFS/Git → 再插 project/appconfig/servers**（tfs/git 与 project 无依赖，放最前便于失败补偿按序清理）。

1. **TFS/Git 配置插入**：对 `item.tfsConfigs` 逐条 `INSERT INTO t_team_foundation_server (tfs_name, tfs_server_url, tfs_source_path, tfs_local_path, tfvc_path, remark) VALUES(...) RETURNING id`，记录 `oldTfsId → newId` 映射；`gitConfigs` 同理。
   - **注意**：必须用 `database.execute` 直接 SQL，**绕过** `src/database/teamFoundationServer/index.ts` 的 `insertTfs` 重名校验——该函数拒绝同名插入，与"总是插入新记录"策略冲突。`t_git` 的 `insertGit` 无校验，但为统一也走直接 SQL。
2. 插 project（现有逻辑不变）
3. 插 appconfig 前，若 `dllMode === "TFS"` / `"Git"`：解析 `dllModeValue` 为 `SelectTfsType` / `SelectGitType`，用映射**精确替换 `id` 字段**（改对象字段后重新 `JSON.stringify`，不使用正则——避免误伤变更集编号/日期/commit sha 中的数字），再作为 `dllModeValue` 写入
4. servers 插入及 serverId 重映射（现有逻辑不变）
5. 旧数据清理（删旧 project 级联，现有逻辑不变）
6. **失败补偿扩展**：catch 中除现有 `newProjectId` 级联删除（t_server / t_app_config / t_project）外，**新增删除本次插入的 `newTfsIds` / `newGitIds`**——只删本次插入的记录，不影响目标库原有记录；补偿清理失败时 `console.error` 上报（与现有行为一致）

## 版本兼容

- `src/views/appconfig/index.vue` 版本检查：`exportFile.version !== 1` → `![1, 2].includes(exportFile.version)`，错误提示更新为"当前支持 v1/v2"
- v1 文件：无 tfs/git 字段，走原逻辑（dllMode 恒为"当天"）
- v2 文件：完整恢复获取DLL方式
- `checkImportConflicts` 不变

---

## 错误处理

| 场景 | 行为 |
|---|---|
| 悬空引用（TFS/Git 配置已删除） | console.warn + 该条回退「当天」，不跳过导出 |
| TFS/Git 配置插入失败 | 整条 item 走失败补偿（清理本次插入的 project/tfs/git 记录），`导入失败: <原因>` 上报，不吞错 |
| 补偿清理失败 | console.error 上报，新数据保留（与现有行为一致） |
| v1 文件 | 正常导入（无 tfs/git 字段，dllMode 原样写入） |

## 验证

1. `npm run build`（vue-tsc 类型检查 + Vite 生产构建）
2. 手工验证：
   - 导出含各 dllMode（TFS / Git / DLL名称 / 日期范围 / 当天 / 最近3天 / 全部）的配置，检查导出文件明文（AES 解密后）中 `dllMode/dllModeValue` 原样、`tfsConfigs/gitConfigs` 正确去重
   - 导入到另一环境（或清库后导入）：`t_team_foundation_server` / `t_git` 出现新记录，`t_app_config.dll_mode_value` 中 id 已重映射为新 id
   - 打开导入后的配置编辑对话框：TFS/Git 选择器回显正确（名称、查询条件）
   - 执行发布/备份：按 TFS/Git 模式正常获取 DLL
   - 悬空引用场景：手动删除 TFS 配置后导出，该条 dllMode 为「当天」且控制台有 warn
   - 导入失败场景：目标库无写权限（只读）时，失败后无残留新记录
   - v1 旧文件导入不受影响

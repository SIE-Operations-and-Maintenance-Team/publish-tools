# Task 3 Report: DAO 层适配

## Status: DONE

## Commits
- `9e36e0d` feat: project DAO 适配 backup_base_path 列

## What was changed

File: `src/database/project/index.ts` -- 5 个方法全部适配 `backup_base_path` 列。

1. **getProjectList** (line 12) -- SELECT 末尾加 `, backup_base_path backupBasePath`
2. **getProjectDefault** (line 67 + line 86) -- 两个 SELECT 各加 `, backup_base_path backupBasePath`
3. **getProjectById** (line 110) -- SELECT 末尾加 `, backup_base_path backupBasePath`
4. **insertProject** (line 145 + line 176) -- INSERT 列加 `backup_base_path`，VALUES 用 `$6`，execute 绑定数组末尾追加 `project.backupBasePath`
5. **updateProject** (line 208 + line 237) -- SET 子句加 `backup_base_path=$6`，`id` 变为 `$7`，execute 绑定数组追加 `project.backupBasePath` 前插 `project.id` 后移

## Concerns

1. **类型检查未通过**：`vue-tsc --noEmit` 报错 `src/views/project/components/projectDialog.vue(110,3): error TS2741: Property 'backupBasePath' is missing`。这是 Task 1 将 `backupBasePath` 加入 `RowProjectType` 后产生的遗留问题 -- `projectDialog.vue` 的 `state.ruleForm` 初始化和 `getDefaultSubObject` 重置逻辑尚未添加 `backupBasePath` 字段。该修复不在本 Task 范围内，需要在后续 Task（UI 层适配）中处理。

2. **DAO 层 SQL 变更本身无语法问题**：5 个方法的 SQL 修改均为机械添加列名和参数绑定，逻辑对齐正确（`updateProject` 中 `id` 已正确从 `$6` 调整为 `$7`）。

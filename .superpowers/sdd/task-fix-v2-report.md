# Task Fix v2 Report

## Status: COMPLETED

## What was reverted

### 1. `src/database/sqlite.ts`
- Removed `backup_base_path TEXT` column from `CREATE TABLE IF NOT EXISTS t_project`.
- Removed the `PRAGMA table_info(t_project)` + `ALTER TABLE` migration block that added the column to existing databases.

### 2. `src/database/project/index.ts`
- Removed `, backup_base_path backupBasePath` from all 5 methods' SELECT lists (getProjectList, getProjectDefault, getProjectById, plus two inline queries in getProjectDefault).
- Reverted `insertProject` SQL to original 5 columns: `(code, name, description, is_default, assembly_out_path) VALUES($1, $2, $3, $4, $5)`.
- Reverted `updateProject` SQL to original 5 columns: `SET code=$1, name=$2, description=$3, is_default=$4, assembly_out_path=$5 WHERE id=$6`.
- Removed `project.backupBasePath` from both insert and update parameter arrays.

### 3. `src/types/project.d.ts`
- Removed `backupBasePath: string | null;` from `RowProjectType`.

### 4. `src/views/project/components/projectDialog.vue`
- Removed the "备份基础路径" `el-form-item` input field from template (was between assemblyOutPath and description).
- Removed `backupBasePath: null,` from `ruleForm` initial state.

### 5. `src/views/papersPublish/index.vue`
- Removed `import { useProjectDb } from "@/database/project/index";`.
- Removed the entire "备份路径持久化" block: `projectDbForBackup`, `isLoadingBackupPath`, `saveBackupPathTimer`, `loadBackupBasePath()`, the `watch()` block, and `onUnmounted` cleanup.
- Removed `await loadBackupBasePath();` call after `.smom` parsing.
- Removed the template `<tr>` row with "备份路径" input field from the publish info card.
- Removed `isLoadingBackupPath.value = true;` before `Object.assign(publishConfig, ...)`.
- Removed `onUnmounted` and `watch` from the Vue import (no longer used).

## What was added

### 1. `src/types/appconfig.d.ts`
- Added `backupBasePath?: string | null;` to `ConfigItemsType` — this flows into the `.smom` publish file's `publish.config.json` at generate time.

### 2. `src/views/appconfig/components/appconfigDialog.vue`
- Added a "备份基础路径" input field between the `isNewVersion` checkbox section and the `buildMode` select. Field is bound to `state.ruleForm.configItems.backupBasePath`, 450 char max, clearable, optional.

### 3. KEPT (no change needed)
- `src/types/manuallyPublish.d.ts` — `backupBasePath` in `CommonPapersPublishType` unchanged.
- `src/views/papersPublish/index.vue` — All `getBackupPath()` call sites and the function itself remain unchanged. The backup path now comes from `.smom`'s `publish.config.json` (set via app config), not from a separate DB lookup or card UI.

## Data flow (correct approach)

```
App Config Dialog (appconfigDialog.vue)
  → configItems.backupBasePath (in ConfigItemsType)
    → serialized into configItemsJson in t_app_config
      → embedded into .smom publish file's publish.config.json at generate time
        → papersPublish reads it from publishConfig.backupBasePath
          → passed to getBackupPath() for all backup operations
```

## Concerns

- Existing databases that already had `backup_base_path` added to `t_project` via the reverted ALTER TABLE will retain the column in their SQLite files. This is harmless — the column will simply be ignored since the code no longer reads or writes it. No migration to drop the column is needed.
- If any user had already entered backup base paths through the project dialog, those values are now orphaned in the t_project table. They would need to re-enter them in the app config dialog.
- TypeScript type check was not run (Node.js unavailable in this environment), but since all edits are straightforward removals/additions of known symbols, compilation risk is low.

### Task 5 Report: 备份路径输入框 + 持久化

**Status:** DONE

**Commit:** `469cc7c` — feat: 发布信息卡片新增备份路径输入框及持久化逻辑

**What was changed:**

1. **Vue import (line 180):** Added `watch` to the destructured `vue` imports.
2. **DAO import (line 191):** Added `import { useProjectDb } from "@/database/project/index"` for project DB access.
3. **Template (lines 85-95):** Inserted a new `<tr>` row with an `<el-input v-model="publishConfig.backupBasePath">` before the `v-show="publishConfig.notes"` row, displaying "备份路径" label with a clearable text input, disabled during publish.
4. **Persistence logic (lines 212-259):** Added after `publishItem` definition:
   - `projectDbForBackup` — `useProjectDb()` instance for query/update.
   - `isLoadingBackupPath` — guard ref to prevent the watch from firing during initial load.
   - `loadBackupBasePath()` — queries project by name (LIKE + frontend exact filter), backfills `publishConfig.backupBasePath`.
   - `watch` on `publishConfig.backupBasePath` — debounced 800ms auto-persist via `updateProject`, gated on `isLoadingBackupPath` and `projectName`.
5. **Call site (line 337):** Added `await loadBackupBasePath();` between `ElMessage.success(...)` and `publishItem.value.loading = false;` in `onSelectPublishFile`.

**Concerns:**
- `npm run build` could not execute in this environment (node not on bash/PowerShell PATH within the tool sandbox). The changes are confined to import statements, template markup, and script-level composition — all follow the existing patterns in this file exactly (same `useProjectDb` pattern as `useBackupDb` on line 174, same `watch` pattern used elsewhere, same `reactive({} as any)` for `publishConfig`). No type errors are expected.

# Code Review: Configurable Backup Base Path Feature

**Branch:** feature branch (6 commits, 6 files, +159/-39)
**Reviewer:** Claude
**Date:** 2026-07-02

---

## Overall Verdict: **NEEDS_FIX**

One critical bug and two important issues found. The feature design is sound but there are correctness issues that should be addressed before merge.

---

## Critical

### C1. `getBackupPath` fallback logic breaks when `publishPath` has no directory separator

- **File:** `src/views/papersPublish/index.vue`
- **Line:** 2323-2337 (new `getBackupPath` implementation)
- **Issue:** In the fallback path (no custom `backupBasePath`), `bkLastIndex` = `bkPath.lastIndexOf("/")`, which returns `-1` when the path has no `/` at all (e.g., a bare filename like `C:\deploy` on Windows after `removeSlash` converts `\` to `/` -- this works; but for a path like just `app.exe` with no directory, `lastIndexOf` returns `-1`, causing `bkPath.substring(0, -1)` which yields `""` and `bkPath.substring(0)` which yields the entire path -- creating a nonsensical backup path like `/Backups/20260702T120000/app.exe`).
- **Failure scenario:**
  1. `publishPath` is set to a bare name like `app` (no directory separator at all).
  2. `removeSlash("app")` returns `"app"`.
  3. `bkLastIndex = -1`, `backupPrefixPath = ""`, `fileName = "app"`.
  4. Result: `/Backups/{folderName}/app` -- leading slash, prefix-less.
- **Suggestion:** Guard against missing separator. When `bkLastIndex === -1`, either fall back to a sensible default (like current working directory or `/tmp`) or use the path itself as both prefix and filename. The simplest fix:

```ts
const backupPrefixPath = bkLastIndex >= 0 ? bkPath.substring(0, bkLastIndex) : "";
```

This at least avoids the empty prefix issue, though the resulting path `/Backups/{folderName}/{fileName}` is still odd. Given that `publishPath` in practice is always a full server path like `/home/app/WebApiHost`, this is an edge case unlikely to trigger in production. Still, defensive coding is warranted.

Note: this bug exists in the ORIGINAL code too (the old `getBackupPath` had the exact same `substring(0, bkLastIndex)` with no `-1` guard). The refactor did not introduce it, but it also did not fix it. Since the diff is under review, it is fair to flag.

---

## Important

### I1. `publishConfig` initialized as `reactive({})` -- `backupBasePath` property is not declared, causing reactivity loss

- **File:** `src/views/papersPublish/index.vue`
- **Line:** 367 (`const publishConfig = reactive({} as any);`)
- **Issue:** `publishConfig` is typed `any` and initialized as an empty object. The `backupBasePath` property is not declared upfront. When `Object.assign(publishConfig, readPublishConfig)` runs on line 323, `backupBasePath` from the config file (if present) gets assigned. Then `loadBackupBasePath()` on line 337 assigns `publishConfig.backupBasePath = project.backupBasePath ?? ''`. However, the `watch` on line 399-400 watches `() => publishConfig.backupBasePath`. Since the property is added dynamically (not present at object creation), Vue 3's `reactive()` should handle this via Proxy, so deep reactivity is maintained. However, because `publishConfig` is typed as `any`, there is a risk of:
  1. If the `.smom` config file contains a `backupBasePath` field, `Object.assign` will set it BEFORE `loadBackupBasePath()` overwrites it. The order is correct in the diff (loadBackupBasePath runs after), but there is no guard against the config file value being stale/wrong.
  2. The `watch` fires on the initial assignment from `Object.assign` (if `backupBasePath` is in the config), but `isLoadingBackupPath` is still `false` at that point (it is only set to `true` inside `loadBackupBasePath`), so the watcher would trigger a spurious `updateProject` call with the config file's value BEFORE the DB value loads. This is a race condition.

- **Suggestion:** Set `isLoadingBackupPath.value = true` BEFORE `Object.assign` on line 321, then only set it to `false` after `loadBackupBasePath()` completes. Or, better, use a simple boolean `isBackupPathLoaded` that starts `false` and is set to `true` only after the DB load completes; the watcher skips when `!isBackupPathLoaded`.

### I2. `watch` + debounce persistence is lost on component unmount without cleanup

- **File:** `src/views/papersPublish/index.vue`
- **Lines:** 399-420 (watch + debounce logic)
- **Issue:** The `setTimeout` timer `saveBackupPathTimer` is never cleared on component unmount (`onUnmounted`). If the user types a value and navigates away within 800ms, the timer fires after the component is destroyed, attempting to call `projectDbForBackup.updateProject(project)` against a potentially unmounted component's reactive state. This can cause:
  1. Console noise (Vue warnings about accessing destroyed component)
  2. A DB write that succeeds but updates a stale project state
- **Suggestion:** Add `onUnmounted(() => { clearTimeout(saveBackupPathTimer); })`.

---

## Minor

### M1. Empty string vs null inconsistency in DB writes

- **File:** `src/views/papersPublish/index.vue`
- **Lines:** 389 (loadBackupBasePath: `project.backupBasePath ?? ''`), 413 (persist: `project.backupBasePath = newVal || null`)
- **Issue:** When loading from DB, `null` is converted to `''` (empty string). When persisting, `||` converts `''` to `null`. This is a round-trip identity mismatch: `null` in DB -> loaded as `''` in UI -> after user clears the field -> `''` persisted as `null` -> correct. But if the user NEVER touches the field, the round-trip from DB `null` -> UI `''` -> persistence watcher fires (because `'' !== null` in the watcher's `newVal`) -> writes `null` back. This causes a needless `updateProject` call on every page load that loads a project with `null` backupBasePath.
- **Suggestion:** Keep the type consistent. Load as `null` (remove the `?? ''`) and keep the watcher guard: `if (newVal === undefined) return;`. Or use `??` on persistence too: `project.backupBasePath = newVal || null` is fine since `''` is falsy. The real fix is to not trigger the watcher when loading: set `isLoadingBackupPath.value = true` BEFORE the `Object.assign`, eliminating the spurious persistence on page load.

### M2. Typo in diff context: `papersPublish` (directory name)

- **File:** `src/views/papersPublish/index.vue`
- **Note:** The directory and route are named `papersPublish` (plural "papers"). Not introduced by this diff, but noted for consistency -- the SMOM config refers to "文件手动发布" (manual file publish). No action needed, purely observational.

### M3. Project dialog `backupBasePath` field has no form validation `maxlength`

- **File:** `src/views/project/components/projectDialog.vue`
- **Line:** 988-996 (new form field)
- **Issue:** The `el-input` has `maxlength="450"` which matches `assemblyOutPath`, but there is no corresponding `rules` validation in the form. The other fields (`code`, `name`) have validators in the same file (not shown in diff but present in the existing form). The `backupBasePath` field has no `required` or pattern validation in the `rules` object, which is fine since it is optional, but the maxlength is only enforced client-side by the input attribute and not by form validation.
- **Suggestion:** Add a `max: 450` rule to the `prop="backupBasePath"` validator if the existing pattern for `assemblyOutPath` includes form-level validation. Otherwise this is consistent and acceptable.

### M4. `watch` immediate flush on `backupBasePath` undefined -> `''` transition

- **File:** `src/views/papersPublish/index.vue`
- **Lines:** 399-420
- **Issue:** When `publishConfig` is first populated via `Object.assign` and the `.smom` config does NOT contain `backupBasePath`, the property is `undefined` on the reactive object. When `loadBackupBasePath` runs and sets it to `''` (empty string from `?? ''`), the watcher fires with `newVal = ''` (truthy check passes since `''` is falsy and the `||` in the persistence converts it back to `null`). This is the same issue as M1 -- the watcher triggers an unnecessary DB write. Combined with I1, the fix is to gate the watcher properly during initial load.

---

## Architecture/Design Notes

### Positive aspects

1. **Fallback logic is clean.** `getBackupPath`'s two-path approach (custom base path vs default `../Backups/`) is simple and readable. The `backupBasePath` truthiness check is appropriate since empty string and null both mean "use default."
2. **All call sites are updated.** Every invocation of `getBackupPath` (6 call sites for local publish, 6 for remote publish) and every call to `localPublishServerBackup`, `localPublishWpfBackup`, `remotePublishServerBackup`, `remotePublishWpfBackup` has the new `backupBasePath` parameter threaded through.
3. **Schema migration pattern is correct.** The `PRAGMA table_info` + `ALTER TABLE ADD COLUMN` pattern handles both fresh installs (where `CREATE TABLE IF NOT EXISTS` includes the new column) and upgrades (where the column is added via ALTER). This is consistent with the existing `build_mode` migration pattern.
4. **DAO parameter binding is correct.** In `insertProject`: 6 placeholders (`$1`-`$6`) match 6 values in the bind array. In `updateProject`: 7 placeholders (`$1`-`$7`) match 7 values in the bind array (`backupBasePath` inserted before `id` in the SET clause and before `id` in the bind array -- correct ordering).
5. **Type definitions are consistent.** `RowProjectType.backupBasePath`, `CommonPapersPublishType.backupBasePath`, and the DB column `backup_base_path TEXT` all align.

### Concerns

1. **No Rust-side changes.** The `getBackupPath` function is entirely in TypeScript (frontend). The backup path is computed client-side and passed to Rust commands as a fully resolved string. This means the backup path is always already complete when it reaches the Rust backend. However, the backup path is stored in `backup.d.ts`'s `BackupPathType.backupPath` and then used in restore flows. If the restore dialog reads the stored `backupPath` and relies on it being relative to `publishPath`, the introduction of absolute paths via `backupBasePath` could break restore logic. This was NOT changed in the diff, so it is worth a note: verify that restore from backup works when `backupBasePath` is configured (the stored `backupPath` will be an absolute path like `/opt/backups/20260702T1200/WebApiHost` instead of a relative one).
2. **SMOM config file can override DB value temporarily.** The `Object.assign(publishConfig, readPublishConfig)` on line 323 can set `backupBasePath` from the `.smom` file. If a `.smom` file has a stale `backupBasePath`, it will briefly appear in the UI before `loadBackupBasePath()` overwrites it on line 337. This flicker is unlikely to be noticed since both happen synchronously during the loading spinner, but it is technically a transient incorrect state.

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| Critical | 1 | `getBackupPath` edge case with path-less inputs (pre-existing, not introduced) |
| Important | 2 | Reactivity guard race condition (I1), missing unmount cleanup (I2) |
| Minor | 4 | Null/empty string round-trip (M1), directory naming note (M2), missing form validation (M3), watcher immediate flush (M4) |

**Recommendation:** Fix I1 and I2 before merge. C1 is pre-existing and low risk in practice but worth a defensive guard. M1 is a side effect of I1 and will be resolved by the same fix. M3 is cosmetic.

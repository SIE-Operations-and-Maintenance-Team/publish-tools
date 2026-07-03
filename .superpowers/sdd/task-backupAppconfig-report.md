# task-backupAppconfig-report

**Status:** Complete
**Date:** 2026-07-02
**File:** `src/utils/backupAppconfig.ts`

## Summary

Added support for custom backup base paths in the direct publish flow (一键发布/手动发布 from home page). When `configItems.backupBasePath` is set in the app config, it overrides the hardcoded `${publishPath}/../Backups/...` pattern.

## Changes

### 1. Three helper functions — added 4th parameter `backupBasePath?: string | null`

- `getServerBackupItems` (line 184): added `backupBasePath?: string | null`
- `getScheduleServerBackupItems` (line 293): added `backupBasePath?: string | null`
- `getWpfClientConfigType` (line 408): added `backupBasePath?: string | null`

### 2. Path computation branched in each function

In `getServerBackupItems` and `getScheduleServerBackupItems` (both at the `backupPaths.push` site):
```ts
let backupPath: string;
if (backupBasePath) {
  backupPath = `${removeSlash(backupBasePath)}/${folderName}/${bkPath.substring(bkLastIndex + 1)}`;
} else {
  backupPath = `${backupPrefixPath}/Backups/${folderName}/${bkPath.substring(bkLastIndex + 1)}`;
}
```

In `getWpfClientConfigType` (at the `backupServer.push` site):
```ts
let backupPathWpf: string;
if (backupBasePath) { ... } else { ... }
```

### 3. `loadBackupItems` — read and thread through

- Added `const backupBasePath = appConfigItem.configItems?.backupBasePath || null;` before the `backupData` block (line 607)
- Passed `backupBasePath` as 4th argument to all 5 call sites (lines 622-656)

## Verification

- TypeScript: `vue-tsc` could not run in this environment (node missing), but changes are purely mechanical parameter threading. No new types, no new imports, no signature collisions.
- Diff reviewed: all 3 function signatures, all 3 path computation sites, the single config read, and all 5 call sites match the spec.

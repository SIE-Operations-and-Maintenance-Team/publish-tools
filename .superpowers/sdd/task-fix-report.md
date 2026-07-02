# Fix Report — backup-base-path I1 & I2

**Status:** DONE
**Date:** 2026-07-02

---

## I1: `isLoadingBackupPath` guard too late

**Root cause:** `Object.assign(publishConfig, readPublishConfig)` at line 323 could set `backupBasePath`
from the `.smom` config file BEFORE `isLoadingBackupPath` was set to `true` (which only happened inside
`loadBackupBasePath()` at line 220). The watcher at line 239-260 checked `isLoadingBackupPath.value`
but fired on the initial assign, triggering a spurious `updateProject` call.

**Fix:** Moved `isLoadingBackupPath.value = true` to immediately before `Object.assign` (line 327),
ensuring the watcher is guarded during the entire config population phase. The value is still set to
`false` in `loadBackupBasePath()`'s `finally` block (line 234).

**Changed lines:**
- Added line 327: `isLoadingBackupPath.value = true;` (before `Object.assign` on line 328)

---

## I2: Missing `onUnmounted` cleanup for debounce timer

**Root cause:** `saveBackupPathTimer` (a `setTimeout` with 800ms debounce) was never cleared on
component unmount. If the user navigated away within 800ms of typing, the timer would fire on a
destroyed component, causing Vue warnings and potentially a DB write against stale state.

**Fix:**
1. Added `onUnmounted` to the Vue import (line 180).
2. Added `onUnmounted(() => { clearTimeout(saveBackupPathTimer); })` right after the watch block
   (lines 262-264), cleaning up the timer when the component is destroyed.

**Changed lines:**
- Line 180: `import { ..., onUnmounted, ... } from "vue";`
- Lines 262-264: `onUnmounted(() => { clearTimeout(saveBackupPathTimer); });`

---

## Commits

| Hash | Message |
|------|---------|
| `d136b81` | fix: resolve two important issues in backup-base-path feature |

---

## Verification

- `vue-tsc --noEmit` passes with no errors.
- Diff touches only `src/views/papersPublish/index.vue` (+6/-1).
- Both I1 and I2 are resolved.

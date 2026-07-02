# Task 6 Report: getBackupPath 签名变更

## Status: DONE

## Commit

| Hash | Message |
|---|---|
| `e9d54e6` | feat: getBackupPath 支持自定义备份基础路径 |

## Edits Summary

Total: **29 edits** in `src/views/papersPublish/index.vue`

| Category | Count | Description |
|---|---|---|
| Func def | 1 | `getBackupPath(path, currentDate, backupBasePath?)` -- 新增可选第3参数, 有自定义路径时优先使用 |
| A-group (local) | 5 | `localPublishBeforeBackup` 内 WebApiHost/ScheduleServer/WebClient/SpcMonitor/WpfClient 的 `getBackupPath` 调用加第3参 |
| A-group (remote) | 5 | `remotePublishBeforeBackup` 内 WebApiHost/ScheduleServer/WebClient/SpcMonitor/WpfClient 的 `getBackupPath` 调用加第3参 |
| B-group signatures | 4 | `localPublishServerBackup`, `localPublishWpfBackup`, `remotePublishServerBackup`, `remotePublishWpfBackup` 签名加 `backupBasePath?` |
| B-group internals | 4 | 上述4方法内部 `getBackupPath` 调用传 `backupBasePath` |
| B-group callers (local) | 5 | `localPublishBeforeBackup` 内4处 `localPublishServerBackup` + 1处 `localPublishWpfBackup` 调用加 `publishConfig.backupBasePath` |
| B-group callers (remote) | 5 | `remotePublishBeforeBackup` 内4处 `remotePublishServerBackup` + 1处 `remotePublishWpfBackup` 调用加 `publishConfig.backupBasePath` |

## Verification

- `vue-tsc --noEmit` 通过 (零类型错误)
- `vite build` 通过 (1773 modules transformed, 产物正常输出)
- `grep -n getBackupPath` 确认所有 14 处调用点的第3参均已到位, 无遗漏

## Concerns

无. 所有调用点已更新, 类型检查与构建均通过.

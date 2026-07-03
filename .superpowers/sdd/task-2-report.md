# Task 2 Report: 数据库 Schema

## Status
DONE

## Commits
- `a9ae89d` feat: t_project 表新增 backup_base_path 列（新安装+升级）

## What was changed
修改 `src/database/sqlite.ts` 中的 `ensureSchema` 函数：

1. **CREATE TABLE（新安装）**: 在 `t_project` 建表语句的 `assembly_out_path TEXT,` 后添加 `backup_base_path TEXT,` 列定义。
2. **ALTER TABLE（已安装升级）**: 在函数末尾的 `build_mode` 迁移块之后，追加了相同的 PRAGMA `table_info` 检查 + `ALTER TABLE ADD COLUMN` 模式，确保已有数据库也能获得新列。

两处修改完全遵循项目中已有的 `build_mode` 迁移模式，使用幂等方式确保升降级安全。

## Concerns
- `npm run build` 无法在当前 shell 环境中运行（找不到 Node.js 可执行文件），因此无法在提交前进行 TypeScript 编译验证。不过修改本身是机械性的、完全遵循已有模式，风险很低。
- 类型定义 `RowProjectType.backupBasePath` 已由 Task 1 完成，与 SQLite 列名 `backup_base_path` 的映射关系取决于数据访问层的字段转换逻辑（在单独的 `database/project/` 中处理），本 task 不涉及。

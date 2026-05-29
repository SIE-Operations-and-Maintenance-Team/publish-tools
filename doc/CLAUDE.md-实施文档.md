# CLAUDE.md 生成实施文档

## 项目概述

**SmomPublish** (SMOM平台发布工具 v0.0.20) — 基于 Tauri 2.0 的桌面端发布管理工具，前端 Vue 3 + Element Plus，后端 Rust。

## 待生成的 CLAUDE.md 内容大纲

### 1. 开发和构建命令

| 命令 | 用途 |
|---|---|
| `npm run dev` | 启动 Vite 开发服务器（端口 5200） |
| `npm run build` | 类型检查 + Vite 生产构建 → `dist/` |
| `npm run tauri` | Tauri CLI（dev/build 等） |
| `cargo build` | 构建 Rust 后端（在 `src-tauri/` 下执行） |

### 2. 架构概览

#### 技术栈
- **前端**: Vue 3.3 + TypeScript 5.2 + Vite 5.4 + Pinia + Vue Router 4 + Element Plus 2.7
- **后端**: Tauri 2.0 (Rust) — 提供文件操作、SSH、构建、压缩等原生能力
- **数据库**: SQLite (smom.db)，通过 `tauri-plugin-sql` 访问
- **国际化**: vue-i18n 9，支持 zh-cn / en / zh-tw
- **桌面特性**: 系统托盘、单实例锁、自动更新、窗口隐藏到托盘（关闭时最小化）

#### 项目结构

```
src/
├── views/          # 业务页面（home, project, appconfig, papersPublish, servers, tfs, git, backups, sshInstall）
├── database/       # SQLite 数据访问层（每个业务域一个 index.ts）
├── stores/         # Pinia 状态管理（themeConfig, routesList, tagsViewRoutes, keepAliveNames 等）
├── router/         # 路由配置（route.ts 定义路由, backEnd.ts 处理后端控制路由（预留）, index.ts 路由实例）
├── layout/         # 布局组件（defaults/classic/transverse/columns 四种布局）
├── components/     # 通用组件（svgIcon, iconSelector）
├── types/          # TypeScript 类型定义（*.d.ts 按业务域划分）
├── utils/          # 工具函数（command.ts 调用 Rust、storage.ts 本地存储、other.ts 通用工具）
└── i18n/           # 国际化文件（lang/ 框架级, pages/ 页面级）
src-tauri/src/
├── main.rs         # Tauri 应用入口，注册所有插件和命令
├── lib.rs          # 模块声明
├── tray.rs         # 系统托盘菜单
├── cmd_module/     # 前端可调用的 Rust 命令
│   ├── file_module.rs      # 文件操作、构建、SSH、压缩等核心命令
│   ├── parse_sln_module.rs # .sln 解决方案文件解析
│   ├── sqlite_module.rs    # 数据库迁移定义
│   └── wpf_upgrade_module.rs # WPF 项目版本升级
├── git/            # Git 操作
└── utils/          # 压缩 (compression.rs)、MSBuild (msbuild.rs)
```

#### 前后端通信

前端通过 `src/utils/command.ts` 的 `cmdInvoke(cmd, args)` 封装调用 Rust 命令。所有 Tauri 命令在 `main.rs` 的 `invoke_handler` 中注册。

#### 路由机制

- 使用 `createWebHashHistory`（hash 模式）
- 路由定义在 `src/router/route.ts` 的 `dynamicRoutes` 中，采用单层 children 结构
- `backEnd.ts` 预留了后端控制路由的能力（`getBackEndControlRoutes()` 当前返回 null）
- 路由守卫在首次加载时初始化后端路由，并对多级路由做扁平化处理后重新嵌套（`formatTwoStageRoutes` / `formatFlatteningRoutes`）

#### 数据库

SQLite 数据库 `smom.db`，表结构通过 `sqlite_module.rs` 的 migration 定义。前端通过 `src/database/sqlite.ts` 的 `db()` 获取连接，各业务域的 `src/database/<domain>/index.ts` 封装具体 CRUD。

#### 关键依赖

| 包 | 用途 |
|---|---|
| `@tauri-apps/api` | Tauri 前端 API |
| `@tauri-apps/plugin-sql` | SQLite 数据库 |
| `@tauri-apps/plugin-updater` | 自动更新 |
| `@tauri-apps/plugin-dialog` | 原生对话框 |
| `@tauri-apps/plugin-http` | HTTP 请求 |
| `@tauri-apps/plugin-process` | 进程管理（重启） |
| `crypto-js` | AES 加解密 |
| `vue-grid-layout` | 可拖拽网格布局 |

#### 业务领域

1. **home** — 发布平台主页，一键发布入口
2. **project** — 项目管理（.sln 解析、DLL 复制、构建）
3. **appconfig** — 应用配置管理（构建模式、环境配置）
4. **papersPublish** — 手动发布单据
5. **servers** — 服务器管理（SSH 连接、远程命令、文件上传下载）
6. **teamFoundationServer** — TFS 版本控制集成
7. **git** — Git 版本控制集成
8. **backups** — 备份记录管理
9. **sshInstall** — SSH 安装部署

### 3. 注意事项

- 窗口关闭时默认隐藏到托盘而非退出（`CloseRequested` 事件中 `prevent_close`）
- 右键菜单全局禁用（仅 input/textarea 除外）
- AES 加密密钥通过 Rust 端 `get_encryption_key` 命令获取
- 自动更新端点配置在 Gitee

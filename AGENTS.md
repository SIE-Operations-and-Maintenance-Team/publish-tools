# AGENTS.md

本项目为 **SMOM平台发布工具**（`smom-publish`）——基于 Tauri 2.0 的桌面端发布管理工具。本文件是项目指令主体（跨工具开放标准，Codex、Gemini CLI、Cursor 等可直接读取），Claude Code 通过根目录 `CLAUDE.md` 的 `@AGENTS.md` 导入链接加载。

## 协作与范围

- 除代码、命令、路径、日志、报错、配置键、API 名称、专有名词外，回复使用简体中文。
- 本项目使用 Git 托管；修改前先检查工作区已有未提交或待提交改动，不覆盖用户修改。
- 优先用 CodeGraph 查定义、引用、调用链和符号信息（`.codegraph/` 已建索引）；不可用时再退回文本搜索与文件读取。

## 变更流程

- 修改代码、配置、发布脚本、数据库脚本或新增文件前，先在 `doc/` 新建或更新实施方案，说明目标、范围、步骤、风险和验证方式，`doc/` 忽略代码托管。
- 实施方案需用户确认后再执行。
- doc 命名方式为 `日期-标题.md`，例如 `20260101-A方案.md`。
- 只读分析、问题解答、现有文档评审不需要创建实施文档。
- 新增文件、模块、类、函数或 helper 前，必须先产出 Dedupe Ticket。
- Dedupe Ticket 必须包含：Intent signature、Queries、Top matches、Decision、Rationale。

## 构建与运行

```bash
npm install                # 安装依赖
npm run dev                # 启动 Vite 开发服务器 (端口 15200)
npm run tauri dev          # 启动 Tauri 桌面应用（开发模式）
npm run build              # vue-tsc 类型检查 + Vite 生产构建 → dist/
npm run tauri build        # 打包 Tauri 桌面应用（输出到 src-tauri/target/release/）
```

> **Node**: >= 16.0.0, **npm**: >= 7.0.0。在 `src-tauri/` 下执行 `cargo build` 可单独构建 Rust 后端。

## 测试

- 本项目未配置专门测试框架与测试脚本：`package.json` 的 `scripts` 仅含 `dev`、`build`、`preview`、`tauri`、`version:bump`，无 `test` 命令。
- 现有验证门禁为 `npm run build`（`vue-tsc --noEmit` 类型检查 + Vite 生产构建）；Rust 侧可在 `src-tauri/` 下运行 `cargo build` 验证编译。
- 后续引入测试时，补充本章节（框架、测试项目命名、运行命令、外部依赖）。

## 宿主进程

- 单宿主桌面应用：Tauri 2.0（Vue 3 前端与 Rust 后端打包为同一桌面进程）。
- 开发模式：`npm run tauri dev` 同时启动 Vite 开发服务器（端口 15200）与 Rust 后端。
- 生产打包：`npm run tauri build` → 输出到 `src-tauri/target/release/`。

## 高层架构

**SMOM平台发布工具** — 基于 Tauri 2.0 的桌面端发布管理工具，用于 SMOM 框架的快速发布、项目管理和服务器部署。

### 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3.3 (Composition API) + TypeScript 5.2 + Vite 5.4 |
| UI | Element Plus 2.7 + vue-grid-layout |
| 状态管理 | Pinia |
| 路由 | Vue Router 4 (Hash 模式) |
| 国际化 | vue-i18n 9 (zh-cn / en / zh-tw) |
| 桌面后端 | Tauri 2.0 (Rust) |
| 数据库 | SQLite (tauri-plugin-sql) |
| 桌面特性 | 系统托盘、单实例锁、自动更新、窗口关闭隐藏到托盘 |

### 项目结构

```
src/
├── views/              # 业务页面（每个页面一个目录，含 index.vue + components/）
│   ├── home/           # 发布平台主页
│   ├── project/        # 项目管理（SLN 解析、DLL 复制、MSBuild 构建）
│   ├── appconfig/      # 应用配置管理
│   ├── papersPublish/  # 文件手动发布
│   ├── servers/        # 服务器管理（SSH、远程命令、文件上传下载）
│   ├── teamFoundationServer/  # TFS 版本控制集成
│   ├── git/            # Git 集成
│   ├── backups/        # 备份记录管理
│   └── sshInstall/     # SSH 安装部署（隐藏路由）
├── database/           # SQLite 数据访问层，每个业务域一个 index.ts
├── stores/             # Pinia store（themeConfig, routesList, tagsViewRoutes, keepAliveNames）
├── router/             # route.ts(路由定义), backEnd.ts(后端控制路由，预留), index.ts(实例)
├── layout/             # 布局组件，支持 defaults/classic/transverse/columns 四种布局
├── components/         # 通用组件（svgIcon, iconSelector）
├── types/              # TypeScript 类型定义（*.d.ts）
├── utils/              # 工具函数
│   ├── command.ts      # 封装 Tauri invoke → cmdInvoke()，统一返回 {code, msg, data}
│   ├── storage.ts      # LocalStorage/SessionStorage 封装
│   └── other.ts        # 通用工具（AES 加解密、深克隆、标题设置等）
└── i18n/               # 国际化（lang/ 框架级, pages/ 页面级）
src-tauri/src/
├── main.rs             # 应用入口，注册插件和所有 Tauri 命令
├── lib.rs              # 模块声明
├── tray.rs             # 系统托盘菜单
├── cmd_module/
│   ├── file_module.rs  # 文件操作、SSH、构建、压缩等核心命令
│   ├── parse_sln_module.rs  # .sln 解决方案解析
│   ├── sqlite_module.rs     # 数据库迁移定义
│   └── wpf_upgrade_module.rs # WPF 项目版本升级
├── git/                # Git 操作
└── utils/              # compression.rs(压缩), msbuild.rs(MSBuild 构建)
```

### 前后端通信

前端通过 `src/utils/command.ts` 的 `cmdInvoke(cmd, args)` 调用 Rust 命令：

```ts
import { cmdInvoke } from "@/utils/command";
const result = await cmdInvoke("copy_dll_files", { sourceDir, targetDir });
// result: { code: 0, msg: "...", data: ... }
```

所有 Rust 命令在 `src-tauri/src/main.rs` 的 `invoke_handler!` 宏中注册。

### 路由机制

- Hash 模式 (`createWebHashHistory`)
- 路由定义在 `src/router/route.ts` → `dynamicRoutes`，采用单层 children 嵌套结构
- `backEnd.ts` 预留后端控制路由能力 (`getBackEndControlRoutes()` 当前返回 null，使用前端静态路由)
- 路由守卫：首次加载时初始化路由，`formatFlatteningRoutes` + `formatTwoStageRoutes` 处理多级嵌套为二级结构（keep-alive 只支持二级缓存）
- 路径别名 `@` → `src/`

### 数据库

SQLite 数据库 `smom.db`，表结构通过 `sqlite_module.rs` 的 migration 定义。前端通过 `src/database/sqlite.ts` 的 `db()` 获取连接（单例），各业务域在 `src/database/<domain>/index.ts` 封装 CRUD。

### Rust 端关键依赖

| Crate | 用途 |
|---|---|
| `ssh2` | SSH 远程连接与命令执行 |
| `zip` | ZIP 压缩/解压 |
| `quick-xml` / `xml-doc` | XML/SLN 文件解析 |
| `chrono` | 日期时间处理 |
| `winreg` | Windows 注册表操作 |
| `encoding_rs` | 字符编码转换 |

## 核心框架类型

- 前后端通信入口：`src/utils/command.ts` 的 `cmdInvoke(cmd, args)`，统一返回 `{code, msg, data}`；Rust 命令在 `src-tauri/src/main.rs` 的 `invoke_handler!` 宏集中注册。
- SQLite 访问：`src/database/sqlite.ts` 的 `db()` 单例连接；各业务域在 `src/database/<domain>/index.ts` 封装 CRUD；表结构迁移在 `src-tauri/src/cmd_module/sqlite_module.rs`。
- 状态管理：Pinia stores（`themeConfig`、`routesList`、`tagsViewRoutes`、`keepAliveNames`）。
- 路由处理：`formatFlatteningRoutes` + `formatTwoStageRoutes`（多级嵌套压平为二级结构以支持 keep-alive 缓存）。
- Rust 核心命令模块：`src-tauri/src/cmd_module/file_module.rs`（文件/SSH/构建/压缩）、`parse_sln_module.rs`（.sln 解析）、`wpf_upgrade_module.rs`（WPF 版本升级）。

## 配置与集成

- Tauri 配置：`src-tauri/tauri.conf.json`（窗口、打包、更新端点等）。
- 自动更新：`tauri-plugin-updater`，端点为 Gitee 上的 `update.json`。
- 版本号管理：`npm run version:bump`（`scripts/bump-version.mjs`）统一升级版本。
- 数据库：SQLite `smom.db`（tauri-plugin-sql），连接见 `src/database/sqlite.ts`。
- 桌面特性集成：系统托盘（`src-tauri/src/tray.rs`）、单实例锁（`tauri-plugin-single-instance`）、窗口关闭隐藏到托盘。
- 构建工具链：`vite.config.ts` 的 `watch.ignored` 排除 `src-tauri` 目录，防止 Tauri 构建触发 HMR 循环。

### 注意事项

- 窗口关闭事件被拦截，默认隐藏到托盘（`CloseRequested` → `window.hide()` + `api.prevent_close()`），通过托盘菜单真正退出
- 右键菜单全局禁用，仅 `<input>` / `<textarea>` 内可用
- AES 加密密钥通过 Rust 端 `get_encryption_key` 命令获取，不在前端硬编码
- 应用通过 `tauri-plugin-single-instance` 确保单实例运行，重复启动会激活已有窗口
- 自动更新端点配置在 Gitee (`update.json`)，使用 `tauri-plugin-updater`
- `vite.config.ts` 中 `watch.ignored` 排除了 `src-tauri` 目录，防止 Tauri 构建触发 HMR 循环

## 版本控制

- 本项目使用 Git 托管；修改前运行 `git status --short`，检查工作区已有改动。
- 保护用户未提交修改，不自动提交、推送、重置、清理或切换分支。

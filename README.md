# SMOM平台发布工具

基于 **Tauri 2.0** 的 SMOM 框架发布管理桌面工具，覆盖"编译 → 配置 → 发布 → 备份 → 还原"完整链路，一站式的发布工作台与服务自发现能力，减少开发与运维人员的重复劳动。

## ✨ 功能特性

### 🚀 发布工作台

- 置顶导航首位，一站式完成发布：**欢迎 → 选择项目 → 代码源（Git / TFS）→ 服务器 → 应用配置 → 预览发布**，分步向导式操作
- 右侧实时聚合发布草稿：待发布清单与实时日志，未完成项高亮提示，预检通过后方可发布
- 复用既有发布链路（主页手动发布、生成发布、文件发布），已保存的应用配置自动带出，避免重复填写
- **新手引导**：首次安装自动弹出全屏真实表单向导，Header 提供重播入口；仅首次安装自动弹出一次，不重复打扰

### 📦 项目发布（发布平台主页）

- 四大入口：**编译项目**（MSBuild 构建）、**获取程序集**（DLL 复制）、**手动发布**、**定时发布**
- Dev / Uat / Pro / Other 多环境一键切换，项目配置自动带出
- 发布前备份（可配置远端备份路径）、异步上传开关
- 实时日志面板，支持一键清空，发布日志仅保留最新

### 🗂 项目管理

- SLN 解决方案解析，自动获取模块编译输出路径（Release / Debug、新旧版本）
- MSBuild 一键构建（支持强制重新生成）、DLL 批量复制
- 程序集名称（AssemblyName）查询、Manifest 模块版本号自动升级（末位自增）
- 定时发布任务管理：创建 / 取消 / 查看待执行任务
- 应用配置 TFS 变更集起止值修改

### ⚙️ 应用配置

- 按项目管理五大部署模块：**WebApiHost、ScheduleServer（调度）、WebClient、WpfClient、SpcMonitor**
- 每个模块可绑定多台服务器，分别配置服务标识与发布路径（WpfClient 同样支持多服务器发布）
- 与发布工作台、主页发布、文件发布、备份还原全链路联动

### 📄 文件发布

- 手动选择本地文件 / 目录，直接发布到指定服务器
- 发布前自动备份，支持远程还原

### 🖥 服务器管理

- SSH 服务器纳管：连接配置、所属项目筛选（支持一键清空）
- 远程命令执行、文件上传下载、Windows 服务启停
- SSH MCP 配置上传，供 AI 编码助手（如 ZCode）直连远程服务器操作
- **服务自发现**：SSH 连接按 systemd / Docker / 进程三条链路自动发现已部署服务路径，按名称自动映射到应用配置各模块；确认导入后直接生成服务条目，一键认领纳管服务器，无法识别模块的服务明确标注跳过
- 配套发现前缀管理（设置页），统一约定服务路径扫描规则

### 🔧 TFS 集成

- TFS 服务器与工作区配置管理
- 获取最新代码、签出 / 签入、撤销本地修改
- 变更集历史查询（按日期 / 用户筛选）、变更集详情与文件差异比较
- 查询记录一键生成发布日志

### 🌿 Git 集成

- Git 仓库配置管理
- 提交历史查询、按日期筛选
- 查询记录一键生成发布日志

### 💾 备份记录

- 发布前备份与还原全流程留痕
- 远程还原（含服务启停，遵循重试策略配置）
- 备份导入导出

### 🛠 设置

- 开机自启动（驻留系统托盘）
- 重试策略：服务启停重试次数 / 间隔、本地命令重试、文件复制重试
- 服务发现前缀管理
- 界面语言切换（简体中文 / English / 繁體中文）、四种布局主题

### ℹ️ 关于与自动更新

- 独立"关于"页面：显示当前版本号，支持手动检查更新
- 启动时自动检查更新，升级弹窗实时拉取 GitHub Release 说明，下载安装一键完成

### 🧊 桌面特性

- 系统托盘驻留、关闭窗口隐藏到托盘、单实例锁
- SQLite 本地存储，数据开机即用，无需外部依赖

## 🚀 快速开始（开发环境）

要求 Node >= 16、npm >= 7，以及 Rust stable 工具链。

```bash
# 克隆项目
git clone https://github.com/SIE-Operations-and-Maintenance-Team/publish-tools.git

# 进入项目
cd publish-tools

# 安装依赖
npm install

# 开发调试
npm run tauri dev

# 打包桌面应用（输出到 src-tauri/target/release/）
npm run tauri build
```

## 📥 安装与更新

前往 [Releases](https://github.com/SIE-Operations-and-Maintenance-Team/publish-tools/releases) 下载最新版本安装包，安装即用。应用启动时会自动检查更新，也可在"关于"页面手动检查，升级弹窗会展示对应版本的 Release 说明并支持一键下载安装。

## 🧱 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Vue 3.3（Composition API）+ TypeScript 5.2 + Vite 5.4 |
| UI | Element Plus 2.7 + vue-grid-layout |
| 状态管理 | Pinia |
| 路由 | Vue Router 4（Hash 模式） |
| 国际化 | vue-i18n 9（zh-cn / en / zh-tw） |
| 桌面后端 | Tauri 2.0（Rust） |
| 数据库 | SQLite（tauri-plugin-sql） |
| 桌面特性 | 系统托盘、单实例锁、自动更新、窗口关闭隐藏到托盘 |

## ❤️ 鸣谢

- [tauri](https://tauri.app)
- [vue](https://github.com/vuejs/vue)
- [typescript](https://www.tslang.cn/)
- [vite](https://vitejs.dev/)
- [element-plus](https://github.com/element-plus/element-plus)
- [vue-next-admin](https://gitee.com/lyt-top/vue-next-admin)
- [vue-router-next](https://github.com/vuejs/vue-router-next)
- [pinia](https://github.com/vuejs/pinia)
- [mitt](https://github.com/developit/mitt)
- [screenfull](https://github.com/sindresorhus/screenfull.js)
- [sass](https://github.com/sass/sass)
- [vue-i18n](https://github.com/intlify/vue-i18n-next)

#### 支持作者

如果帮助到了你，希望你可以去 [GitHub](https://github.com/SIE-Operations-and-Maintenance-Team/publish-tools) 帮我点个 ⭐ Star，这将是对我极大的鼓励与支持。

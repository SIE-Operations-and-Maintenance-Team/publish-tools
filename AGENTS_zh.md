# Rex.SmomPublish 项目代理文档

本文档概述了 Rex.SmomPublish 应用程序中的关键功能模块（"代理"），这是一个基于 Vue 3 的项目管理和发布系统。

## 核心架构

- **框架**: Vue 3（组合式 API）
- **构建工具**: Vite
- **UI 结构**: 模块化布局系统，包含：
  - 多种布局类型（经典、分栏、默认、横向）
  - 导航组件（侧边栏、头部、标签视图、面包屑）
  - 响应式设计模式

## 功能代理

### 1. 论文发布代理
**用途**: 管理论文发布工作流程
- **关键组件**:
  - `src/views/papersPublish/index.vue` - 主发布界面
  - `src/views/papersPublish/components/localPublishItem.vue` - 处理本地发布操作
  - `src/views/papersPublish/components/remotePublishItem.vue` - 管理远程发布操作
- **功能**:
  - 双通道发布（本地/远程）
  - 可视化状态指示器
  - 发布历史跟踪

### 2. 项目管理代理
**用途**: 处理项目配置和生命周期
- **关键组件**:
  - `src/views/project/index.vue` - 项目仪表盘
  - `src/views/project/components/projectDialog.vue` - 项目创建/修改界面
- **功能**:
  - 项目配置管理
  - 可视化项目组织
  - 与发布工作流程集成

### 3. 服务器管理代理
**用途**: 管理服务器配置和连接
- **关键组件**:
  - `src/views/servers/index.vue` - 服务器管理界面
  - `src/views/servers/components/serverDialog.vue` - 服务器配置对话框
  - `src/views/sshInstall/index.vue` - SSH 安装工作流程
- **功能**:
  - 多服务器配置支持
  - SSH 密钥管理
  - 连接测试功能

### 4. 版本控制代理

#### Git 集成代理
**用途**: 提供 Git 仓库管理
- **关键组件**:
  - `src/views/git/index.vue` - Git 界面
  - `src/views/git/components/gitDialog.vue` - 仓库操作
  - `src/views/git/components/gitLogDialog.vue` - 提交历史查看器
- **功能**:
  - 仓库初始化
  - 提交历史可视化
  - 分支管理

#### Team Foundation Server (TFS) 代理
**用途**: 集成 Microsoft TFS 仓库
- **关键组件**:
  - `src/views/teamFoundationServer/index.vue` - TFS 界面
  - `src/views/teamFoundationServer/components/tfsDialog.vue` - TFS 连接管理
  - `src/views/teamFoundationServer/components/historyDialog.vue` - TFS 历史查看器
- **功能**:
  - TFS 仓库连接
  - 工作项跟踪集成
  - 历史和日志管理

### 5. 备份与恢复代理
**用途**: 处理应用程序配置备份
- **关键组件**:
  - `src/views/backups/index.vue` - 备份管理界面
  - 多种恢复对话框组件，支持不同恢复方法
- **功能**:
  - 本地和远程备份选项
  - 版本化恢复点
  - 备份验证

### 6. 应用配置代理
**用途**: 管理全局应用程序设置
- **关键组件**:
  - `src/views/appconfig/index.vue` - 配置仪表盘
  - `src/views/appconfig/components/appconfigDialog.vue` - 详细配置编辑器
- **功能**:
  - 模块化配置区域
  - 实时预览功能
  - 配置验证

## UI 基础设施

- **布局系统**: 在 `src/layout/` 中实现的多种布局策略
- **组件库**: `src/components/` 中的可重用组件
- **图标系统**: 通过 `src/components/svgIcon/` 管理的 SVG 图标
- **状态管理**: Vuex 或 Pinia（文件结构中未明确显示）

## 技术依赖

- **构建**: Vite 及其插件（如 `vite-plugin-compression`）
- **UI 组件**: 具有网格功能的自定义布局系统
- **工具库**: 用于路径处理、验证等的实用工具库

本文档反映了截至 2026-05-13 的当前结构。如需实现细节，请参考上述列出的具体组件文件。
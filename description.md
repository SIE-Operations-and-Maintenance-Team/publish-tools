## 用户需求

参考 `E:\develop\Project Files\AIProject\ITSM-Manager` 中的 MCP 集成实现，为发布工具（Rex.SmomPublish）也添加 MCP 功能，供 AI 工具调用。

具体来说，需要将发布工具的一些核心功能封装成 MCP Server，使得 AI 工具（如 Claude Code 等）能够通过 MCP 协议直接调用发布工具的能力，例如：
- 项目构建与发布
- 服务器管理与 SSH 操作
- TFS/Git 版本控制集成
- 备份与恢复
- 应用配置管理

参考 ITSM-Manager 项目中 MCP 集成的实现方式（包括 MCP Server 的架构、工具定义、协议交互等），为发布工具设计和实现类似的 MCP 接口。

CC: [@SMOM运维](mention://squad/6041f9e0-89bc-49a6-868e-43a8d8dd65ec)
# 易用性改造设计 — 新手指引 × 发布工作台 × 服务自发现

> 版本：v0.1（待评审）  日期：2026-08-21  作者：Rex + Claude  状态：Draft
> 关联需求：用户提出的 3 点易用性诉求 + Qt 旧版 `PublishToolsPlus/mainwindow.h` 的 `findServicesStartingWithSIE / getServiceExecutablePath / extractRealPathFromExecutablePath / FillInfoWithSave` 逻辑

---

## 1. 背景与目标

### 1.1 现状

- 发布核心链路分散在 5 个独立页：`project → TFS/Git → servers → appconfig → papersPublish(home)`，用户需反复切页、记忆依赖，首次配置成本高。
- 无新手指引；空库首次启动无引导，用户不知“先配什么”。
- 服务器“发布路径”完全手填；Qt 旧版曾有本机 Windows Service 扫描（`SIE.*`/`WebClient`），Tauri 版缺失，且当前产线已以 **Linux + Docker** 为主，旧逻辑不再覆盖主流场景。

### 1.2 目标

- 新用户 5 分钟内完成**最小可用闭环**并通过一次预检发布。
- 日常发布在**一个工作台内完成**，不再切页；高级用户仍可使用原有独立页。
- 服务器发布路径支持**一键发现**（本地 + 远端 Windows Service + 远端 Docker 容器），结果以**建议待确认**形式回填，不直接写库。

### 1.3 非目标（本期不做）

- 不重写既有发布执行引擎（`papersPublish` 的 `generatePublishDialog` / `backupAppconfig` / `copy_dll_files` 等链路保持不变，工作台仅做编排与聚合）。
- 不做 Linux `systemd` 服务扫描（经确认为 Docker 容器为主，首期聚焦容器；`systemd` 预留扩展点）。
- 不强制替换旧页入口（旧页保留为“高级设置”，可回滚）。

### 1.4 成功标准

- 空库首启：按向导 5 步走完 → 预检成功率 100%（dry-run，不真发布）。
- 老库用户：工作台可独立完成一次真实发布，步骤数 ≤ 5 且无需跳出工作台。
- 发现能力：本机 / 远端 Windows / 远端 Docker 三链路各至少 1 个用例通过；零匹配时引导至前缀设置再扫；所有写库操作需用户显式“确认导入”。

---

## 2. 总体方案

### 2.1 方案选型

| 方案 | 描述 | 优点 | 缺点 | 结论 |
|------|------|------|------|------|
| 1 轻量补丁 | 仅在现有页加引导浮层 + 服务器页加“扫描本机” | 零路由改动 | 未解决“到处切页” | 不采纳 |
| **2 向导式发布工作台（采纳）** | 新增主链路 `/workstation` 作为默认入口，复用既有 Dialog/DB/发布引擎；新手指引 = 全屏分步真实表单（即工作台的首启强制版）；发现能力做成独立 Rust 模块 + 前端 composable | 改动面最小、复用最大、可分期、可回滚 | 需新增 1 个路由与 1 个 Rust 模块 | **采纳** |
| 3 彻底收敛 | 用工作台替代 5 页入口 | 体验最干净 | 迁移与回归风险大 | 延后 |

### 2.2 架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│  Tauri 前端 (Vue 3 + Pinia + Element Plus)                      │
│  ┌──────────────┐  ┌─────────────────────┐  ┌──────────────────┐ │
│  │ Onboarding   │  │ Workstation         │  │ 高级设置（保留）  │ │
│  │ 全屏 5 步    │→ │ /workstation Steps  │  │ project/tfs/git/ │ │
│  │ 真实表单     │  │ 聚合编排 + 预览发布  │  │ servers/appconfig│ │
│  └──────┬───────┘  └──────────┬──────────┘  └──────────────────┘ │
│         │  共用表单组件与校验  │  useServiceDiscovery()           │
│         └─────────────────────┴──────────────┬──────────────────┘ │
│  Pinia: useWorkstationStore / useOnboardingStore / useDiscoveryStore│
│  DB: t_project/t_server/t_app_config/t_git/t_team_foundation_server│
│      + t_discovery_prefix (+ 可选 t_onboarding_progress)       │
└──────────────────────────┬──────────────────────────────────────┘
                           │  cmdInvoke(...)
┌──────────────────────────┴──────────────────────────────────────┐
│  Rust 后端 (src-tauri)                                          │
│  file_module.rs (保留) + discovery_module.rs (新增)             │
│  - discover_local_services(prefixes)                            │
│  - discover_remote_windows_services(server, prefixes)           │
│  - discover_remote_docker_containers(server, prefixes)          │
│  - extract_real_path(pathName) 纯函数                           │
│  ssh_pool / Win32 API (windows feature)                         │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 关键决策

- **工作台复用策略**：不复制表单，工作台内通过抽屉/对话框**直接复用**现有 `projectDialog / tfsDialog / gitDialog / serverDialog / appconfigDialog`，发布执行复用 `papersPublish` 既有链路。
- **向导复用策略**：向导的每一步复用与工作台相同的表单组件与校验；向导本质是“带强制顺序与首启持久化”的工作台子集。
- **发现结果策略**：所有发现结果为**建议**，以卡片列表呈现，用户勾选后“确认导入”才写 `t_server` 或回填 `appconfig.publishPath`。

---

## 3. 信息架构与路由

- **新增路由**：`/workstation`（`src/views/workstation/index.vue`），`meta: { title: 'message.router.workstation', isAffix: true, isKeepAlive: true, icon: 'smom-icon-fabu' }`，挂在 `dynamicRoutes` 顶级 `children`。
- **默认落地**：`/` 重定向改为 `/workstation`；原 `/home` 保留（可作公告/快捷入口），不再是默认页。
- **保留旧页**：`project / tfs / git / servers / appconfig / papersPublish` 完整保留，侧边栏文案补充“高级”角标或分组，工作台每步提供“高级设置 →”快捷跳转。
- **帮助入口**：`src/layout/component/header.vue` 增 `？` 按钮（`ele-QuestionFilled`），行为：`hasCompletedOnboarding ? 重播引导 : 打开向导`。

---

## 4. 新手指引（Onboarding）

### 4.1 形态与触发

- **形态**：全屏 Modal（`el-dialog fullscreen`）+ 顶部 `el-steps`（5 步）+ 中部真实表单 + 底部 `上一步 / 跳过此步 / 下一步 / 完成并预检`。
- **触发**：
  - 首次启动：`App.vue` 或 `workstation/index.vue` 的 `onMounted` 检查 `localStorage.getItem('hasCompletedOnboarding') !== 'true'` 且 `workstationStore` 为空 → 自动打开向导。
  - 手动重播：Header `？` 常驻；已完成用户点击再次打开，自动跳过已有数据的步骤（可覆盖）。
  - 可跳过：每步支持“跳过此步”，跳过记录写入 `onboardingState.skippedSteps`；但“预检/发布”前做最终校验（见 4.3）。
- **持久化**：
  - `localStorage.onboardingState = { completed: boolean, currentStep: number, skippedSteps: number[] }`
  - 可选 SQLite `t_onboarding_progress(id, current_step, skipped_json, updated_at)` 若需跨重装记忆；首期用 `localStorage` 即可，表结构预留。

### 4.2 步骤定义（最小闭环）

| 步骤 | 标题 | 表单来源 | 校验与行为 |
|------|------|----------|------------|
| 0 | 欢迎 | 静态文案 + 环境检测（是否已有项目/服务器） | 展示“5 步完成首次发布”，已有数据提示可跳过 |
| 1 | 创建项目 | 复用 `views/project/components/projectDialog.vue` 表单 | 必填：项目名称、SLN 路径；成功后写入 `t_project` 并回填 `workstationDraft.projectId` |
| 2 | 配置代码源 | `tfsDialog` / `gitDialog` 二选一（Tab 切换） | 至少完成其一；校验 `tfsServerUrl/tfvcPath` 或 `gitRepository/gitPath`；支持“稍后配置”跳过 |
| 3 | 添加服务器 | `serverDialog` + 发现卡片 | 必填 IP/端口/账号；提供 **扫描本机 / 扫描远端（已填 IP）** 两个按钮；发现结果以卡片列表回填待确认 |
| 4 | 应用配置 | `appconfigDialog` 精简版 | 选择 DLL 模式/变更集，关联项目与服务器，回填备份路径 |
| 5 | 预检发布 | 只读预览 + 日志 | 聚合 `workstationDraft` 为 `RemotePublishType`，调用 `backupAppconfig` 的 dry-run 分支（`isBackup` 可选），展示生成的文件清单与日志；成功即标记 `hasCompletedOnboarding = true` |

### 4.3 校验与空状态

- 步骤内校验复用各 Dialog 的 `formRules`。
- 最终“预检/发布”按钮禁用条件：`!projectId || (!tfsId && !gitId) || serverIds.length === 0 || !appconfigDraft`，并在按钮旁用 `el-alert` 提示缺失项。
- 空状态：若检测到已有完整数据，向导首屏提供“直接进入工作台”快捷。

---

## 5. 发布工作台（Workstation）

### 5.1 布局

```
┌─────────────────────────────────────────────────────────┐
│ Header: 工作台 / 帮助？  [高级设置下拉]                  │
├──────────┬──────────────────────────────────────────────┤
│ Steps    │  表单区（随步骤切换）                          │
│ 1 项目   │  ┌──────────────────────────────────────┐  │
│ 2 代码源 │  │  项目选择（下拉 + 新建抽屉）            │  │
│ 3 服务器 │  │  服务器卡片（多选 + 发现入口）          │  │
│ 4 配置   │  │  应用配置（DLL/变更集、备份路径）       │  │
│ 5 预览   │  └──────────────────────────────────────┘  │
│          │  预览/日志区（右侧或底部）                    │
│          ├──────────────────────────────────────────────┤
│          │  [预检] [发布]  （常驻底部，校验不通过时禁用） │
└──────────┴──────────────────────────────────────────────┘
```

### 5.2 状态与数据流

- **Store**：`src/stores/workstation.ts` → `useWorkstationStore`，`state: { draft: WorkstationDraft, currentStep: number, discoveryResults: DiscoveryItem[] }`，`sessionStorage` 持久化（`pinia-plugin-persistedstate` 或自封装）。
- **类型**：

```ts
type WorkstationDraft = {
  projectId: number | null;
  tfsId: number | null;
  gitId: number | null;
  serverIds: number[];
  appconfigDraft: Partial<RowAppconfigType> & { publishMode: number };
  publishOptions: { isBackup: number; isNewVersion: boolean | null; backupBasePath?: string };
  notes?: string;
};
```

- **流转**：每步“下一步”前校验当前步 → 写入 `draft` → 允许进入下一步；最终“预检/发布”时将 `draft` 聚合为 `RemotePublishType | LocalPublishType`，复用 `src/views/home/components/generatePublishDialog.vue` 的 `getTfsDllFiles / getGitDllFiles / getReadAllDlls` 与 `papersPublish` 的发布编排，仅把分散的选择收敛到一处。

### 5.3 复用与扩展点

- 表单抽屉：点击“新建项目/服务器”等按钮，直接 `openDialog` 复用现有 Dialog，成功后回填 `draft`。
- 高级跳转：每步右上角“高级设置 →”链接至对应独立页（`router.push('/smom/project')` 等），返回时 `draft` 保持。

---

## 6. 服务自发现（Discovery）

### 6.1 能力矩阵

| 场景 | 触发 | 远端执行 | 匹配 | 建议发布目录 |
|------|------|----------|------|--------------|
| 本机 Windows | 按钮“扫描本机” | 本地 Win32 API | 前缀命中 | `extractRealPath(PathName)` 的 `absolutePath` |
| 远端 Windows | 填好 IP/账号后“扫描远端” | SSH → PowerShell `Get-CimInstance Win32_Service` | 前缀命中 | 同上 |
| 远端 Linux Docker | 同上 | SSH → `docker ps` + `docker inspect` | 容器名/镜像名命中前缀 | `Mounts[].Source`（宿主机目录），`WorkingDir` 作辅助展示 |

> 注：Qt 旧版仅覆盖“本机 Windows + `SIE.*`/`WebClient`”，本设计扩展至远端与 Docker，且前缀可配置。

### 6.2 前端

- **Composable**：`src/composables/useServiceDiscovery.ts`

```ts
type DiscoveryItem = {
  serviceName: string;          // 服务名 / 容器名
  displayName: string;
  rawPath: string;              // 原始 PathName / Mounts JSON
  suggestedPublishPath: string; // 建议发布目录（宿主机）
  source: 'win32' | 'docker';
  containerId?: string;
  mounts?: { Source: string; Destination: string }[];
  image?: string;
};

function useServiceDiscovery() {
  const prefixes = ref<string[]>([]);
  const scanning = ref(false);
  const results = ref<DiscoveryItem[]>([]);
  async function scanLocal(): Promise<DiscoveryItem[]> { /* cmdInvoke('discover_local_services') */ }
  async function scanRemote(serverId: number): Promise<DiscoveryItem[]> { /* cmdInvoke('discover_remote_windows_services' | 'discover_remote_docker_containers') */ }
  return { prefixes, scanning, results, scanLocal, scanRemote };
}
```

- **交互**：发现结果以 `el-card` 列表呈现，每项展示 `服务/容器名 → 建议目录`，支持单选/多选；底部“确认导入”才写库或回填表单；零结果时 `el-empty` + “去设置修改前缀”按钮（跳转 `/settings` 的前缀管理）。

### 6.3 后端 Rust

- **新增模块**：`src-tauri/src/cmd_module/discovery_module.rs`，注册至 `main.rs` 的 `invoke_handler!`。

```rust
#[tauri::command]
pub async fn discover_local_services(prefixes: Vec<String>) -> Result<Vec<DiscoveryItem>, String>;

#[tauri::command]
pub async fn discover_remote_windows_services(
    username: &str, password: &str, server: &str, prefixes: Vec<String>
) -> Result<Vec<DiscoveryItem>, String>;

#[tauri::command]
pub async fn discover_remote_docker_containers(
    username: &str, password: &str, server: &str, prefixes: Vec<String>
) -> Result<Vec<DiscoveryItem>, String>;

// 纯函数，供单测
pub fn extract_real_path(path_name: &str) -> String;
pub fn parse_docker_inspect_mounts(inspect_json: &str) -> Vec<Mount>;
```

- **本机 Windows**：`#[cfg(windows)]` 下调用 `windows` crate 的 `OpenSCManagerW / EnumServicesStatusExW / QueryServiceConfigW`，逻辑与 Qt 旧版一致；非 Windows 直接返回 `Err("仅 Windows 支持本机扫描")`。
- **远端 Windows**：`ssh_pool::get_session` 复用 `file_module.rs` 的连接池，执行 `powershell -Command "Get-CimInstance Win32_Service | Where-Object { $_.Name -like 'SIE*' } | Select-Object Name,PathName | ConvertTo-Json"`，解析后过滤前缀、调用 `extract_real_path`。
- **远端 Docker**：执行 `docker ps --format '{{.ID}}|{{.Names}}|{{.Image}}'` 列容器，过滤前缀命中者，再对命中者批量 `docker inspect --format '{{json .Mounts}}|{{.Config.WorkingDir}}' <id>`，解析 `Mounts[].Source` 作为建议目录。
- **路径清洗**：`extract_real_path` 完整复刻 Qt 逻辑——去引号 → 找 `-instance` 前截断 → 若含 `dotnet.exe` 取其后 → `Path::parent` 取目录 → 统一为 `/` 或 `\`（前端展示用 `/`，Windows 远端执行时保留 `\`）。

### 6.4 前缀配置

- **表**：`t_discovery_prefix(id INTEGER PRIMARY KEY, prefix TEXT UNIQUE NOT NULL, enabled INTEGER DEFAULT 1, is_default INTEGER DEFAULT 0)`。
- **预置**：`SIE.` / `SIE.WebApiHost` / `SIE.ScheduleServer` / `WebClient` / `SpcMonitor`（`is_default=1`，不可删除，可禁用）。
- **管理**：`/settings` 新增“服务发现前缀”区块（`el-tag` + `el-input`），CRUD 直连 `discovery_prefix` 表；工作台与向导每次扫描前读取 `enabled` 前缀。
- **零匹配引导**：发现结果为空时，卡片区展示“未发现符合前缀的服务/容器” + 按钮“去修改前缀并重扫”。

---

## 7. 数据与持久化

- **复用表**：`t_project / t_server / t_app_config / t_team_foundation_server / t_git / t_backup` 结构不变。
- **新增表**：`t_discovery_prefix`（必选），`t_onboarding_progress`（可选，首期可用 `localStorage` 替代，表结构预留）。
- **前端持久化**：`localStorage.hasCompletedOnboarding / localStorage.onboardingState / sessionStorage.workstationDraft`；发现前缀缓存 `localStorage.discoveryPrefixes`（与 DB 同步）。

---

## 8. 错误处理与边界

| 场景 | 处理 |
|------|------|
| 本机扫描无管理员权限 | 捕获 `OpenSCManager` 的 `ERROR_ACCESS_DENIED`，提示“请以管理员身份重开应用” |
| 远端 SSH 连通失败 | 复用 `server_connection` 错误码与 `ssh_pool` 重试，提示检查 IP/账号/端口 |
| 远端无 Docker | `docker ps` 返回非 0 时提示“未检测到 Docker，已跳过容器扫描”并继续尝试 Windows 服务 |
| 路径清洗失败（无 `-instance`） | 保留原始 `PathName` 并标“需手动确认”，不阻断流程 |
| 零匹配 | 引导至前缀设置页，非报错 |
| 向导中断 | `onboardingState.currentStep` 已持久化，重开可续 |
| 发布前校验不通过 | 禁用“预检/发布”并在按钮旁 `el-alert` 列出缺失项 |

---

## 9. 安全与性能

- 远端命令仅通过 `ssh_pool` 执行，前缀过滤在前端与后端双重校验，防止注入；`PathName` 仅作展示与建议，不直接执行。
- Docker `inspect` 批量执行时控制并发（≤ 5），避免远端压力。
- 本机 Win32 API 枚举为同步阻塞，置于 `tokio::task::spawn_blocking`。

---

## 10. 测试与验证

- **Rust 单测**：`extract_real_path` 覆盖 Qt 旧分支（引号、`-instance` 缺失、`dotnet.exe` 有无、`WebClient` 裸名）；`parse_docker_inspect_mounts` 解析真实 `docker inspect` 样例。
- **前端单测**：`useServiceDiscovery` 的过滤与卡片勾选；`useWorkstationStore` 的 Steps 校验与 `draft` 聚合。
- **e2e（Playwright）**：录制一次最小闭环（空库 → 向导 5 步 → 预检成功）；老库直接进工作台完成一次发布。
- **手动清单**：本机扫描 / 远端 Windows / 远端 Docker 三链路各 1 遍；前缀改后重扫生效；Header `？` 重播；跳步后最终校验。

---

## 11. 分期交付与回滚

| 阶段 | 内容 | 产出 | 依赖 |
|------|------|------|------|
| Phase 1（1-2 周） | 发现能力 + 前缀设置 | `discovery_module.rs`、`t_discovery_prefix`、服务器页“扫描本机/远端”按钮 | 无 |
| Phase 2（2-3 周） | 发布工作台 | `/workstation`、Pinia store、Steps 编排 | Phase 1（复用发现 composable） |
| Phase 3（1 周） | 新手指引 | 全屏向导、首启自弹、Header 重播 | Phase 2（复用工作台表单） |

- **回滚**：任一阶段可独立回滚——发现能力回滚仅移除按钮与 Rust 命令；工作台回滚仅移除路由与 Store，不影响旧页；向导回滚仅移除首启检查。

---

## 12. 风险与对策

| 风险 | 对策 |
|------|------|
| 远端 Windows 的 PowerShell 执行策略受限 | 回退至 `sc qc <svc>` / `wmic service get name,pathname` |
| Docker 宿主机路径无权限或为空（未挂载） | 展示 `WorkingDir` + 提示“容器未挂载宿主机目录，请手动填写” |
| 工作台与旧 `papersPublish` 发布逻辑分叉 | 工作台不复制发布执行，仅做参数聚合后调用既有链路，单测对比两者入参 |
| 首期工作量估不准 | 按 Phase 1→2→3 串行，每阶段结束可演示可交付 |

---

## 13. 附录

- **Qt 旧逻辑溯源**：`E:\develop\Project Files\QtProject\PublishToolsPlus\mainwindow.cpp#findServicesStartingWithSIE` 等 4 函数，本设计在 `extract_real_path` 与 `FillInfoWithSave` 的“建议待确认”变体中完整承接。
- **术语**：发布台 = Workstation；新手指引 = Onboarding；服务发现 = Discovery；建议 = Suggestion（不直接写库）。
- **国际化**：新增 `message.router.workstation / message.workstation.* / message.discovery.* / message.onboarding.*` 三组 key，复用 `src/i18n` 既有机制。

---

*评审通过后，执行 `writing-plans` 拆解为实施计划。*

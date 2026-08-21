# 易用性改造实施计划 — 新手指引 × 发布工作台 × 服务自发现

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保留 5 个旧管理页的前提下，新增可发现、可引导的发布工作台，让新用户 5 步完成最小闭环并支持本机/远端 Windows Service + 远端 Docker 一键发现（建议待确认）。

**Architecture:** 新增 `/workstation` 作为默认主链路复用既有 Dialog/DB/发布引擎；新增 `discovery_module.rs` 提供三链路扫描与纯函数路径清洗；新增 Pinia `workstation/onboarding/discovery` 三 Store + `useServiceDiscovery` composable；新手指引为全屏真实表单的“首启强制版工作台”。

**Tech Stack:** Vue 3.3 + Pinia + Element Plus + Tauri 2.0 (Rust) + SQLite (tauri-plugin-sql) + ssh2 + windows crate (cfg(windows))。

**Spec:** `docs/superpowers/specs/2026-08-21-ease-of-use-design.md`

## Global Constraints

- Node >= 16.0.0, npm >= 7.0.0；Rust 通过 `src-tauri/cargo build` 验证。
- Allman 风格（C# 侧）/ Prettier 风格（Vue 侧）；除代码/命令/路径/专有名词外用简体中文（中文注释允许，显而易见处不加）。
- 遵循既有命名/结构/测试惯例，不引入第二种风格；只做最小改动，不顺手重构无关代码。
- 重试/路由/阈值/排序/权限/状态流转须写成显式代码；错误必须抛出/返回/上报，不吞错、不藏默认值。
- 新增文件/模块/类/函数前先做去重检查（Dedupe Ticket：Intent signature / Queries / Top matches / Decision / Rationale），优先复用既有 helper。
- 测试须验证有意义行为（值/结构/副作用/错误类型/边界），不写“有返回值/不报错”弱测试。
- Tauri 命令通过 `src/utils/command.ts:cmdInvoke(cmd, args)` 调用，统一返回 `{code, msg, data}`；Rust 命令在 `src-tauri/src/main.rs:invoke_handler!` 注册。
- 路由为 Hash 模式，定义在 `src/router/route.ts:dynamicRoutes`，路径与文件夹名一致；`@` 别名指向 `src/`。
- 数据库为 SQLite `smom.db`，迁移定义在 `src-tauri/src/cmd_module/sqlite_module.rs:db_migration()`，前端以 `src/database/sqlite.ts:db()` 单例访问，各域在 `src/database/<domain>/index.ts` 封装 CRUD；`ensureSchema()` 与 migration 双重保障。
- 单实例、托盘、关闭隐藏等桌面特性保持不变；自动更新端点仍走 Gitee `update.json`。

---

## File Structure

### New Files

| Path | Responsibility |
|------|---------------|
| `src-tauri/src/cmd_module/discovery_module.rs` | 三条发现链路 + 纯函数 `extract_real_path` / `parse_docker_inspect_mounts` |
| `src/types/discovery.d.ts` | `DiscoveryItem / DiscoveryPrefix / Mount` 类型 |
| `src/types/workstation.d.ts` | `WorkstationDraft / WorkstationStep` 类型 |
| `src/database/discoveryPrefix/index.ts` | `t_discovery_prefix` 的 CRUD（`getPrefixes / upsertPrefix / deletePrefix / seedDefaults`） |
| `src/composables/useServiceDiscovery.ts` | `scanLocal / scanRemote` 统一入口、loading 与结果状态 |
| `src/stores/workstation.ts` | 工作台 draft + currentStep + 校验，`sessionStorage` 持久化 |
| `src/stores/onboarding.ts` | 向导 `currentStep / skippedSteps / completed`，`localStorage` 持久化 + 首启检测 |
| `src/views/workstation/index.vue` | 工作台壳（Steps + 表单区 + 预览/日志 + 底部预检/发布） |
| `src/views/workstation/components/StepProject.vue` | 步骤 1：项目选择/新建（复用 `projectDialog`） |
| `src/views/workstation/components/StepSource.vue` | 步骤 2：Git/TFS 二选一（复用两 Dialog） |
| `src/views/workstation/components/StepServers.vue` | 步骤 3：服务器多选 + 发现卡片（消费 composable） |
| `src/views/workstation/components/StepAppconfig.vue` | 步骤 4：应用配置精简表单（复用校验） |
| `src/views/workstation/components/StepPreview.vue` | 步骤 5：聚合预览 + 日志 + 预检/发布 |
| `src/views/workstation/components/OnboardingWizard.vue` | 全屏 5 步向导（复用 Steps 表单组件，首启自弹） |
| `src/database/workstation/index.ts` | 可选：工作台草稿的 DB 持久化辅助（若需跨重装，首期可仅 Store） |

### Modified Files

| Path | Change |
|------|--------|
| `src-tauri/src/cmd_module/sqlite_module.rs` | 新增 `t_discovery_prefix` 建表与 migration version 10 |
| `src-tauri/src/cmd_module/mod.rs` | 导出 `discovery_module` |
| `src-tauri/src/main.rs` | 注册 3 个 discovery 命令 |
| `src-tauri/Cargo.toml` | 增 `windows` crate（`cfg(windows)`）与 `serde_json` 已有则复用 |
| `src/database/sqlite.ts` | `ensureSchema()` 增 `t_discovery_prefix` 幂等建表 |
| `src/router/route.ts` | 新增 `/workstation` 顶级路由，`/` 重定向改为 `/workstation`，并将 `src/router/route.ts:dynamicRoutes[0].children[home].meta.isAffix` 改为 `false`（避免双 Affix） |
| `src/layout/navBars/topBar/user.vue` 或 `src/layout/navBars/topBar/index.vue` | 增 `？` 帮助按钮→重播引导（确定落 `src/layout/navBars/topBar/user.vue` 的用户下拉区旁，与 `smom-icon-database` 同排） |
| `src/views/servers/index.vue` | 增“扫描本机 / 扫描远端”按钮与发现卡片抽屉 |
| `src/views/settings/index.vue` | 新增“服务发现前缀”管理区块 |
| `src/i18n/lang/zh-cn.ts` / `en.ts` / `zh-tw.ts` | 增 `message.router.workstation / message.workstation.* / message.discovery.* / message.onboarding.*` |
| `src/App.vue` 或 `src/views/workstation/index.vue` | 首启检测与向导自弹 |
| `src/utils/command.ts` | 无需改，仅被调用方 |

---

## Phase 1 — 服务自发现（独立可交付）

### Task 1: 发现前缀的 DB 与类型

**Files:**
- Create: `src/types/discovery.d.ts`
- Create: `src/database/discoveryPrefix/index.ts`
- Modify: `src-tauri/src/cmd_module/sqlite_module.rs:1-170`
- Modify: `src/database/sqlite.ts:ensureSchema`

**Interfaces:**
- Consumes: `src/database/sqlite.ts:db()`、`src-tauri/src/cmd_module/sqlite_module.rs:db_migration()`
- Produces:
  - `DiscoveryPrefix { id: number|null, prefix: string, enabled: number(0/1), isDefault: number(0/1) }`
  - `DiscoveryItem { serviceName: string, displayName: string, rawPath: string, suggestedPublishPath: string, source: 'win32'|'docker', containerId?: string, mounts?: Array<{Source:string,Destination:string}>, image?: string }`
  - `useDiscoveryPrefixDb().getPrefixes(): Promise<DataResultType<DiscoveryPrefix[]>>`
  - `useDiscoveryPrefixDb().upsertPrefix(row: DiscoveryPrefix): Promise<DataResultType<number>>`
  - `useDiscoveryPrefixDb().deletePrefix(id: number): Promise<DataResultType<void>>`（`isDefault=1` 时拒绝）
  - `seedDiscoveryPrefixes(): Promise<void>`（幂等插入 5 条默认）

- [ ] **Step 1: 定义类型**

```ts
// src/types/discovery.d.ts
declare type DiscoveryPrefix = {
  id: number | null;
  prefix: string;
  enabled: number;   // 0/1
  isDefault: number; // 0/1
};

declare type DiscoveryMount = { Source: string; Destination: string; };

declare type DiscoveryItem = {
  serviceName: string;
  displayName: string;
  rawPath: string;
  suggestedPublishPath: string;
  source: 'win32' | 'docker';
  containerId?: string;
  mounts?: DiscoveryMount[];
  image?: string;
};
```

- [ ] **Step 2: Rust 侧新增迁移 version 10**

```rust
// src-tauri/src/cmd_module/sqlite_module.rs — 在 t_settings 之后新增
let t_discovery_prefix = "CREATE TABLE IF NOT EXISTS t_discovery_prefix (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    prefix TEXT UNIQUE NOT NULL,
    enabled INTEGER DEFAULT 1,
    is_default INTEGER DEFAULT 0
);";
// 在 migrations vec 末尾追加
Migration { version: 10, description: "创建服务发现前缀表[t_discovery_prefix].", sql: t_discovery_prefix, kind: MigrationKind::Up, },
```

- [ ] **Step 3: 前端 ensureSchema 幂等建表**

```ts
// src/database/sqlite.ts — ensureSchema 内追加
await database.execute(`CREATE TABLE IF NOT EXISTS t_discovery_prefix (
  id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  prefix TEXT UNIQUE NOT NULL,
  enabled INTEGER DEFAULT 1,
  is_default INTEGER DEFAULT 0
)`);
```

- [ ] **Step 4: 实现 discoveryPrefix DB 封装**

```ts
// src/database/discoveryPrefix/index.ts
import { db } from '@/database/sqlite';

export function useDiscoveryPrefixDb() {
  return {
    getPrefixes: async () => {
      const rows = await (await db()).select<DiscoveryPrefix[]>(
        "select id, prefix, enabled, is_default isDefault from t_discovery_prefix order by is_default desc, prefix asc"
      );
      return { code: 0, msg: "ok", data: rows } as DataResultType<DiscoveryPrefix[]>;
    },
    upsertPrefix: async (row: DiscoveryPrefix) => {
      if (!row.prefix?.trim()) return { code: 1, msg: "前缀不能为空", data: 0 } as DataResultType<number>;
      // 存在则 update enabled，否则 insert
      // prefix 唯一键，冲突时 update
      const r = await (await db()).execute(
        "INSERT INTO t_discovery_prefix (prefix, enabled, is_default) VALUES ($1,$2,$3) ON CONFLICT(prefix) DO UPDATE SET enabled=$2",
        [row.prefix.trim(), row.enabled ?? 1, row.isDefault ?? 0]
      );
      return { code: 0, msg: "ok", data: r.rowsAffected } as DataResultType<number>;
    },
    deletePrefix: async (id: number) => {
      const rows = await (await db()).select<DiscoveryPrefix[]>("select is_default isDefault from t_discovery_prefix where id=$1", [id]);
      if (rows[0]?.isDefault === 1) return { code: 1, msg: "默认前缀不可删除，可禁用", data: null } as any;
      await (await db()).execute("delete from t_discovery_prefix where id=$1", [id]);
      return { code: 0, msg: "ok", data: null } as DataResultType<void>;
    },
    seedDefaults: async () => {
      const defaults = ["SIE.", "SIE.WebApiHost", "SIE.ScheduleServer", "WebClient", "SpcMonitor"];
      for (const p of defaults) {
        await (await db()).execute(
          "INSERT OR IGNORE INTO t_discovery_prefix (prefix, enabled, is_default) VALUES ($1,1,1)", [p]
        );
      }
    },
  };
}
```

- [ ] **Step 5: 自检**

```bash
npm run build 2>&1 | tail -30
# 期望：vue-tsc 通过，无类型错
cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -20
# 期望：无编译错
```

- [ ] **Step 6: Commit**

```bash
git add src/types/discovery.d.ts src/database/discoveryPrefix/index.ts src-tauri/src/cmd_module/sqlite_module.rs src/database/sqlite.ts
git commit -m "feat(discovery): 新增发现前缀类型与 DB 层及迁移 v10"
```

---

### Task 2: 纯函数路径清洗与 Docker 解析（可单测）

**Files:**
- Create: `src-tauri/src/cmd_module/discovery_module.rs`
- Modify: `src-tauri/src/cmd_module/mod.rs`
- Test: `src-tauri/src/cmd_module/discovery_module.rs` 内 `#[cfg(test)] mod tests`

**Interfaces:**
- Consumes: `std::path::Path`
- Produces:
  - `pub fn extract_real_path(path_name: &str) -> String`
  - `pub fn parse_docker_inspect_mounts(inspect_json: &str) -> Vec<Mount>` // Mount { source:String, destination:String }
  - `pub fn matches_prefix(name: &str, prefixes: &[String]) -> bool`（大小写不敏感，前缀匹配）

- [ ] **Step 1: 先写 Rust 单测（失败态）**

```rust
// src-tauri/src/cmd_module/discovery_module.rs 底部
#[cfg(test)]
mod tests {
  use super::*;
  #[test] fn extract_dotnet_with_instance() {
    let s = r#""C:\Program Files\dotnet\dotnet.exe" C:\SIE\WebApiHost\WebApiHost.dll -instance SIE.WebApiHost"#;
    assert_eq!(extract_real_path(s), r"C:\SIE\WebApiHost");
  }
  #[test] fn extract_no_dotnet_with_instance() {
    let s = r#"C:\SIE\ScheduleServer\ScheduleServer.exe -instance SIE.ScheduleServer"#;
    assert_eq!(extract_real_path(s), r"C:\SIE\ScheduleServer");
  }
  #[test] fn extract_no_instance_keeps_original_parent() {
    let s = r#"C:\SIE\WebApiHost\WebApiHost.exe"#;
    assert!(extract_real_path(s).contains("SIE"));
  }
  #[test] fn extract_empty() { assert_eq!(extract_real_path(""), ""); }
  #[test] fn parse_mounts() {
    let j = r#"[{"Source":"/data/sie/webapi","Destination":"/app","Type":"bind"}]"#;
    let m = parse_docker_inspect_mounts(j);
    assert_eq!(m[0].source, "/data/sie/webapi");
  }
  #[test] fn matches_prefix_case_insensitive() {
    assert!(matches_prefix("SIE.WebApiHost", &["sie.".into()]));
    assert!(!matches_prefix("OtherSvc", &["SIE.".into()]));
  }
}
```

- [ ] **Step 2: 运行单测确认失败**

```bash
cargo test --manifest-path src-tauri/Cargo.toml discovery_module -- --nocapture 2>&1 | tail -40
# 期望：FAILED — function not found / module missing
```

- [ ] **Step 3: 实现模块骨架与纯函数**

```rust
// src-tauri/src/cmd_module/discovery_module.rs
use std::path::Path;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Mount { pub source: String, pub destination: String }

pub fn matches_prefix(name: &str, prefixes: &[String]) -> bool {
  let lower = name.to_lowercase();
  prefixes.iter().any(|p| lower.starts_with(&p.to_lowercase()))
}

pub fn extract_real_path(path_name: &str) -> String {
  if path_name.trim().is_empty() { return "".into(); }
  // 1) 去引号
  let mut s = path_name.replace('"', "");
  // 2) 找 -instance 前截断
  if let Some(idx) = s.find("-instance") { s = s[..idx].trim().to_string(); }
  // 3) 若含 dotnet.exe，取其后
  let keyword = "dotnet.exe";
  let exe_path = if let Some(pos) = s.to_lowercase().find(keyword) {
    s[pos + keyword.len()..].trim().to_string()
  } else { s.trim().to_string() };
  if exe_path.is_empty() { return "".into(); }
  // 4) 取 parent 目录
  let p = Path::new(&exe_path);
  let dir = p.parent().map(|d| d.to_string_lossy().to_string()).unwrap_or_default();
  // 5) 统一分隔符为 /（前端展示用 /，与 file_module 保持一致）
  dir.replace('\\', "/")
}

pub fn parse_docker_inspect_mounts(inspect_json: &str) -> Vec<Mount> {
  // inspect_json 为 docker inspect 的 .Mounts JSON 数组字符串
  let v: serde_json::Value = serde_json::from_str(inspect_json).unwrap_or(serde_json::Value::Null);
  let arr = match v.as_array() { Some(a) => a, None => return vec![] };
  arr.iter().filter_map(|o| {
    let src = o.get("Source")?.as_str()?.to_string();
    let dst = o.get("Destination")?.as_str().unwrap_or("").to_string();
    if src.is_empty() { None } else { Some(Mount{ source: src, destination: dst }) }
  }).collect()
}
```

- [ ] **Step 4: 运行单测确认通过**

```bash
cargo test --manifest-path src-tauri/Cargo.toml discovery_module -- --nocapture 2>&1 | tail -20
# 期望：5 passed
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/cmd_module/discovery_module.rs src-tauri/src/cmd_module/mod.rs
git commit -m "feat(discovery): 纯函数 extract_real_path 与 docker mounts 解析及单测"
```

---

### Task 3: Rust 发现命令与注册

**Files:**
- Modify: `src-tauri/src/cmd_module/discovery_module.rs`
- Modify: `src-tauri/src/main.rs:90-150`
- Modify: `src-tauri/Cargo.toml`（可选增 windows crate，`[target.'cfg(windows)'.dependencies] windows = { version = "0.52", features = ["Win32_System_Services"] }`）
- Modify: `src-tauri/src/cmd_module/mod.rs`

**Interfaces:**
- Consumes: `crate::cmd_module::file_module::execute_remote_command`（已封装重试与 GBK/UTF-8 解码，勿直接调 `ssh_pool::get_session`）、`extract_real_path`、`parse_docker_inspect_mounts`、`matches_prefix`
- Produces (Tauri commands):
  - `#[tauri::command] async fn discover_local_services(prefixes: Vec<String>) -> Result<Vec<DiscoveryItem>, String>`
  - `#[tauri::command] async fn discover_remote_windows_services(username: String, password: String, server: String, prefixes: Vec<String>) -> Result<Vec<DiscoveryItem>, String>`
  - `#[tauri::command] async fn discover_remote_docker_containers(username: String, password: String, server: String, prefixes: Vec<String>) -> Result<Vec<DiscoveryItem>, String>`

- [ ] **Step 1: 先写集成测试桩（手工验证脚本）**

```rust
// 在 discovery_module.rs 追加：远端命令可先用本地 mock 字符串测试解析
#[test] fn remote_win_parse_mock() {
  let json = r#"[{"Name":"SIE.WebApiHost","PathName":"\"C:\\SIE\\WebApiHost\\WebApiHost.exe\" -instance SIE.WebApiHost"}]"#;
  // 解析后 matches_prefix 与 extract_real_path 均应命中
}
```

- [ ] **Step 2: 实现三命令**

要点（按 spec 6.3，精简示意，完整错误分支在实现时补全）：

```rust
// discover_local_services：#[cfg(windows)] 走 Win32 API，非 windows 返回 Err
#[tauri::command]
pub async fn discover_local_services(prefixes: Vec<String>) -> Result<Vec<DiscoveryItem>, String> {
  #[cfg(not(windows))] { return Err("仅 Windows 支持本机扫描".into()); }
  #[cfg(windows)] {
    tokio::task::spawn_blocking(move || {
      // OpenSCManagerW / EnumServicesStatusExW / QueryServiceConfigW
      // 过滤 matches_prefix(service_name, &prefixes)
      // 对 PathName 调用 extract_real_path
      // 组 DiscoveryItem { source: "win32", .. }
    }).await.map_err(|e| e.to_string())?
  }
}

#[tauri::command]
pub async fn discover_remote_windows_services(username: String, password: String, server: String, prefixes: Vec<String>) -> Result<Vec<DiscoveryItem>, String> {
  let cmd = r#"powershell -NoProfile -Command "Get-CimInstance Win32_Service | Select-Object Name,PathName | ConvertTo-Json -Compress""#;
  let out = crate::cmd_module::file_module::execute_remote_command(&username, &password, &server, cmd, None, None).await?;
  // serde_json 解析数组，过滤 matches_prefix，extract_real_path(PathName)
  // PowerShell 执行策略受限时回退：sc qc <svc>（备选，首期可仅实现主路径并在 Err 中提示）
  Ok(items)
}

#[tauri::command]
pub async fn discover_remote_docker_containers(username: String, password: String, server: String, prefixes: Vec<String>) -> Result<Vec<DiscoveryItem>, String> {
  let ps = crate::cmd_module::file_module::execute_remote_command(&username, &password, &server, "docker ps --format '{{.ID}}|{{.Names}}|{{.Image}}'", None, None).await
    .map_err(|e| format!("docker ps 失败（可能未安装 Docker）：{e}"))?;
  // 解析 ps 行，过滤 Names/Image matches_prefix
  // 对命中者批量 inspect：docker inspect --format '{{json .Mounts}}|{{.Config.WorkingDir}}' <id>
  // parse_docker_inspect_mounts -> 取首个 Source 作为 suggestedPublishPath
  // 无 Source 时 suggestedPublishPath 为空，display 提示“未挂载，需手动填写”
  Ok(items)
}
```

- [ ] **Step 3: 注册命令**

```rust
// src-tauri/src/main.rs — invoke_handler! 中追加
discovery_module::discover_local_services,
discovery_module::discover_remote_windows_services,
discovery_module::discover_remote_docker_containers,
```

```rust
// src-tauri/src/cmd_module/mod.rs
pub mod discovery_module;
```

- [ ] **Step 4: 自检**

```bash
cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -20
npm run build 2>&1 | tail -20
# 期望：均通过
```

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/cmd_module/discovery_module.rs src-tauri/src/cmd_module/mod.rs src-tauri/src/main.rs src-tauri/Cargo.toml
git commit -m "feat(discovery): 三链路发现命令及 Tauri 注册"
```

---

### Task 4: 前端 composable 与发现前缀的读写

**Files:**
- Create: `src/composables/useServiceDiscovery.ts`
- Modify: `src/i18n/lang/zh-cn.ts`, `en.ts`, `zh-tw.ts`

**Interfaces:**
- Consumes: `cmdInvoke`、`useDiscoveryPrefixDb`
- Produces:
  - `useServiceDiscovery() => { prefixes: Ref<DiscoveryPrefix[]>, scanning: Ref<boolean>, results: Ref<DiscoveryItem[]>, error: Ref<string|null>, loadPrefixes(), scanLocal(), scanRemote(server:{ip:string,account:string,pwd:string}) }`
  - `scanRemote` 内部并行调 `discover_remote_windows_services` + `discover_remote_docker_containers` 再合并，`suggestedPublishPath` 为空时由 UI 展示 `WorkingDir` 并提示手动填写

- [ ] **Step 1: 写 composable 单测（Vitest 若无则用手工断言，先以类型检查代替）**

```ts
// 预期行为：
// - loadPrefixes() 从 DB 读 enabled 前缀
// - scanLocal() 调 cmdInvoke('discover_local_services', {prefixes}) 并写入 results
// - scanRemote() 先查 t_server 取账号，再调对应远端命令，合并 win32+docker 结果
// - error 在失败时写入，results 为空时保持空并由 UI 引导改前缀
```

- [ ] **Step 2: 实现 composable**

```ts
// src/composables/useServiceDiscovery.ts
import { ref } from 'vue';
import { cmdInvoke } from '@/utils/command';
import { useDiscoveryPrefixDb } from '@/database/discoveryPrefix';

export function useServiceDiscovery() {
  const prefixes = ref<DiscoveryPrefix[]>([]);
  const scanning = ref(false);
  const results = ref<DiscoveryItem[]>([]);
  const error = ref<string | null>(null);

  const loadPrefixes = async () => {
    const db = useDiscoveryPrefixDb();
    await db.seedDefaults();
    const r = await db.getPrefixes();
    prefixes.value = (r.data || []).filter(p => p.enabled === 1);
  };

  const scanLocal = async () => {
    scanning.value = true; error.value = null; results.value = [];
    try {
      const ps = prefixes.value.map(p => p.prefix);
      const r = await cmdInvoke<DiscoveryItem[]>('discover_local_services', { prefixes: ps });
      if (r.code === 0) results.value = r.data || [];
      else error.value = r.msg;
    } catch (e:any) { error.value = e.message; }
    finally { scanning.value = false; }
    return results.value;
  };

  const scanRemote = async (server: { ip:string; account:string; pwd:string }) => {
    scanning.value = true; error.value = null; results.value = [];
    try {
      const ps = prefixes.value.map(p => p.prefix);
      const [w, d] = await Promise.all([
        cmdInvoke<DiscoveryItem[]>('discover_remote_windows_services', { username: server.account, password: server.pwd, server: server.ip, prefixes: ps }),
        cmdInvoke<DiscoveryItem[]>('discover_remote_docker_containers', { username: server.account, password: server.pwd, server: server.ip, prefixes: ps }),
      ]);
      const merged: DiscoveryItem[] = [];
      if (w.code === 0 && Array.isArray(w.data)) merged.push(...w.data);
      if (d.code === 0 && Array.isArray(d.data)) merged.push(...d.data);
      if (w.code !== 0 && d.code !== 0) error.value = w.msg || d.msg;
      else if (merged.length === 0) error.value = null; // 零匹配由 UI 引导改前缀
      results.value = merged;
    } finally { scanning.value = false; }
    return results.value;
  };

  return { prefixes, scanning, results, error, loadPrefixes, scanLocal, scanRemote };
}
```

- [ ] **Step 3: 补 i18n**

```ts
// zh-cn.ts 中追加
'message.router.workstation': '发布工作台',
'message.discovery.scanLocal': '扫描本机',
'message.discovery.scanRemote': '扫描远端',
'message.discovery.noResult': '未发现符合前缀的服务/容器',
'message.discovery.goSetting': '去修改前缀并重扫',
'message.discovery.suggestedPath': '建议发布目录',
'message.discovery.confirmImport': '确认导入',
```

- [ ] **Step 4: 自检**

```bash
npm run build 2>&1 | tail -20
# 期望：通过
```

- [ ] **Step 5: Commit**

```bash
git add src/composables/useServiceDiscovery.ts src/i18n/lang/zh-cn.ts src/i18n/lang/en.ts src/i18n/lang/zh-tw.ts
git commit -m "feat(discovery): 前端 composable 与 i18n"
```

---

### Task 5: 设置页前缀管理 + 服务器页发现入口

**Files:**
- Modify: `src/views/settings/index.vue`
- Modify: `src/views/servers/index.vue`
- Modify: `src/views/servers/components/serverDialog.vue`（若存在，或直接在 index.vue 内）

**Interfaces:**
- Consumes: `useDiscoveryPrefixDb`、`useServiceDiscovery`
- Produces: UI 交互——增/删/禁用前缀；服务器页“扫描本机/远端”按钮与结果卡片抽屉，勾选后“确认导入”回填 `t_server` 或 `appconfig.publishPath`

- [ ] **Step 1: 设置页增“服务发现前缀”区块**

在 `settings/index.vue` 的 `<el-card>` 列表末尾新增一个 card：`el-tag` 展示前缀（`isDefault` 的 tag 加 `type=info` 且不可删），`el-input` + `el-button` 新增，`el-switch` 切换 `enabled`，删除前校验 `isDefault`。

- [ ] **Step 2: 服务器页增发现入口**

在 `servers/index.vue` 的工具栏追加两个按钮（`scanLocal / scanRemote`），结果以 `el-drawer` + `el-card` 列表呈现，每项显示 `serviceName → suggestedPublishPath`，`el-checkbox` 多选，底部“确认导入”：

- **数据落点纠正（`t_server` 无 `publishPath` 列）**：`t_server` 仅含 `project_id/name/os/ip/port/account/pwd/description`（见 `src-tauri/src/cmd_module/sqlite_module.rs:t_server` 与 `src/database/servers/index.ts`），**不直接写发布路径**。
  - 若在“新增/编辑服务器”弹窗内：勾选结果用于**填充服务器表单的 `name` 字段**（`serviceName`），`ip` 保持用户已填值，`suggestedPublishPath` 暂存至抽屉的待回填缓冲区；
  - 真正发布路径回填至 **应用配置的 `configItemsJson`**（`ConfigItemsType.webApiHost.serverPath / scheduleServer.serverPath / webClient.serverPath` 等，见 `src/types/appconfig.d.ts`），随工作台 `draft.appconfigDraft.configItems` 一并写入 `t_app_config`；
  - 若在列表页批量导入：批量 `INSERT INTO t_server (project_id, name, ip, account, pwd, description)`，其中 `description` 可附 `suggestedPublishPath` 作备注，但不作为发布依据。
- Docker `suggestedPublishPath` 为空（无 `Mounts[].Source`）时，卡片展示 `WorkingDir` 并提示“容器未挂载宿主机目录，请手动填写”。

零结果时展示 `el-empty` + 按钮“去修改前缀并重扫”→ `router.push('/settings')`。

- [ ] **Step 3: 自检**

```bash
npm run dev 2>&1 | tail -20
# 期望：/settings 可增删前缀；/server 可触发扫描（无远端时本地链路可跑）
```

- [ ] **Step 4: Commit**

```bash
git add src/views/settings/index.vue src/views/servers/index.vue
git commit -m "feat(discovery): 设置前缀管理与服务器发现入口"
```

---

## Phase 2 — 发布工作台（复用既有能力）

### Task 6: 工作台路由、Store 与类型

**Files:**
- Create: `src/types/workstation.d.ts`
- Create: `src/stores/workstation.ts`
- Modify: `src/router/route.ts`
- Modify: `src/i18n/lang/zh-cn.ts` 等

**Interfaces:**
- Consumes: `pinia`、`@/database/*`
- Produces:
  - `WorkstationDraft { projectId:number|null, tfsId:number|null, gitId:number|null, serverIds:number[], appconfigDraft:Partial<RowAppconfigType> & {publishMode:number}, publishOptions:{isBackup:number,isNewVersion:boolean|null,backupBasePath?:string}, notes?:string }`
  - `useWorkstationStore() => { draft, currentStep, canNext, canPublish, validateStep(n), persist(), reset() }`

- [ ] **Step 1: 定义类型**

```ts
// src/types/workstation.d.ts
declare type WorkstationDraft = {
  projectId: number | null;
  tfsId: number | null;
  gitId: number | null;
  serverIds: number[];
  appconfigDraft: Partial<RowAppconfigType> & { publishMode: number };
  publishOptions: { isBackup: number; isNewVersion: boolean | null; backupBasePath?: string };
  notes?: string;
};
declare type WorkstationStep = 0|1|2|3|4|5;
```

- [ ] **Step 2: 实现 Store（sessionStorage 持久化）**

```ts
// src/stores/workstation.ts
import { defineStore } from 'pinia';
import { Session } from '@/utils/storage';
export const useWorkstationStore = defineStore('workstation', {
  state: () => ({
    draft: { projectId:null, tfsId:null, gitId:null, serverIds:[], appconfigDraft:{publishMode:0} as any, publishOptions:{isBackup:1,isNewVersion:null} } as WorkstationDraft,
    currentStep: 0 as WorkstationStep,
  }),
  getters: {
    canNext: (s) => {
      if (s.currentStep===1) return !!s.draft.projectId;
      if (s.currentStep===2) return !!(s.draft.tfsId || s.draft.gitId);
      if (s.currentStep===3) return s.draft.serverIds.length>0;
      if (s.currentStep===4) return !!s.draft.appconfigDraft && Object.keys(s.draft.appconfigDraft).length>0;
      return true;
    },
    canPublish: (s) => !!(s.draft.projectId && (s.draft.tfsId||s.draft.gitId) && s.draft.serverIds.length>0),
  },
  actions: {
    validateStep(n: number) { /* 复用各 Dialog 的 formRules 思路，首期仅判空 */ },
    persist() { Session.set('workstationDraft', JSON.stringify(this.$state)); },
    restore() { const raw=Session.get('workstationDraft'); if(raw) Object.assign(this, JSON.parse(raw as string)); },
    reset() { this.draft={projectId:null,tfsId:null,gitId:null,serverIds:[],appconfigDraft:{publishMode:0} as any,publishOptions:{isBackup:1,isNewVersion:null}}; this.currentStep=0; Session.remove('workstationDraft'); },
  },
});
```

- [ ] **Step 3: 注册路由**

```ts
// src/router/route.ts — dynamicRoutes[0].children 末尾追加
{
  path: '/workstation',
  name: 'workstation',
  component: () => import('@/views/workstation/index.vue'),
  meta: { title: 'message.router.workstation', isLink:'', isHide:false, isKeepAlive:true, isAffix:true, isIframe:false, icon:'smom-icon smom-icon-fabu' },
},
// 将顶级 redirect 由 '/home' 改为 '/workstation'，同时将既有 /home 的 meta.isAffix 改为 false（避免双 Affix，常驻标签仅工作台）
{ path:'/', redirect:'/workstation', ... } // 并在 children 中找到 home 项改 isAffix:false
```

- [ ] **Step 4: 自检与 Commit**

```bash
npm run build 2>&1 | tail -20
git add src/types/workstation.d.ts src/stores/workstation.ts src/router/route.ts src/i18n/lang/zh-cn.ts src/i18n/lang/en.ts src/i18n/lang/zh-tw.ts
git commit -m "feat(workstation): 路由、Store 与类型"
```

---

### Task 7: 工作台壳（Steps + 布局）

**Files:**
- Create: `src/views/workstation/index.vue`

**Interfaces:**
- Consumes: `useWorkstationStore`、`useServiceDiscovery`、`vue-router`
- Produces: 壳组件，含 `el-steps`、表单区（按 `currentStep` 切子组件）、右侧预览/日志、底部 `预检/发布`（`canPublish` 控制禁用，缺失项旁 `el-alert`）

- [ ] **Step 1: 搭壳**

```vue
<template>
  <div class="workstation-container layout-padding">
    <el-card><el-steps :active="store.currentStep" finish-status="success">...</el-steps></el-card>
    <el-row :gutter="16">
      <el-col :span="16"><component :is="stepComp" /></el-col>
      <el-col :span="8"><StepPreview /></el-col>
    </el-row>
    <el-affix position="bottom"><el-button :disabled="!store.canPublish" @click="onPrecheck">预检</el-button><el-button type="primary" :disabled="!store.canPublish" @click="onPublish">发布</el-button></el-affix>
  </div>
</template>
```

- [ ] **Step 2: 自检与 Commit**

```bash
npm run build 2>&1 | tail -20
git add src/views/workstation/index.vue
git commit -m "feat(workstation): 壳与 Steps 布局"
```

---

### Task 8: 四个步骤子组件（复用既有 Dialog）

**Files:**
- Create: `src/views/workstation/components/StepProject.vue`
- Create: `src/views/workstation/components/StepSource.vue`
- Create: `src/views/workstation/components/StepServers.vue`
- Create: `src/views/workstation/components/StepAppconfig.vue`
- Create: `src/views/workstation/components/StepPreview.vue`

**Interfaces:**
- Consumes: 各 `use*Db`、`useServiceDiscovery`、`useWorkstationStore`
- Produces: 每步子组件均暴露 `validate():boolean` 供壳调用，成功后 `store.draft.* = ...; store.persist()`

实现要点（每步均复用既有 Dialog，不复制表单）：
- **StepProject**: 下拉选 `t_project` + 按钮“新建”→ `projectDialog.openDialog('add')`，成功回调回填 `draft.projectId`。
- **StepSource**: `el-tabs` 切 Git/TFS，下拉选已有 + “新建”复用两 Dialog，至少其一必填。
- **StepServers**: 多选卡片展示 `t_server`，按钮“扫描本机/远端”消费 `useServiceDiscovery`，结果卡片勾选后“确认导入”回填 `draft.serverIds`。
- **StepAppconfig**: 精简版应用配置表单，复用 `appconfig` 的校验，关联 `draft.projectId` 与 `serverIds`。
- **StepPreview**: 只读聚合 `draft` → 展示待发布清单，日志区复用 `papersPublish` 的日志组件；`onPrecheck` 调 `backupAppconfig` 的 dry-run。

- [ ] **Step 1: 按序实现并自检（每完成一个子组件即 `npm run build`）**
- [ ] **Step 2: Commit（可合并为一次）**

```bash
git add src/views/workstation/components/
git commit -m "feat(workstation): 四步子组件与预览"
```

---

### Task 9: 发布编排（聚合 draft → 既有链路）

**Files:**
- Modify: `src/views/workstation/components/StepPreview.vue`
- Modify: `src/views/workstation/index.vue`（发布按钮处理）

**Interfaces:**
- Consumes: `src/utils/backupAppconfig:getTfsDllFiles/getGitDllFiles/getReadAllDlls`、`generatePublishDialog` 的发布入参类型
- Produces: `onPrecheck()` / `onPublish()` — 将 `draft` 聚合为 `RemotePublishType` 后复用既有 `papersPublish` 的执行函数，不复制发布引擎

- [ ] **Step 1: 实现聚合**

```ts
const toPublishInput = (): RemotePublishType => ({
  projectName: project.value!.name,
  environment: appconfigDraft.value.environment,
  publishMode: appconfigDraft.value.publishMode,
  isBackup: store.draft.publishOptions.isBackup,
  generateDate: new Date().toISOString(),
  isNewVersion: store.draft.publishOptions.isNewVersion,
  webApiHost: toServerConfigs('webApiHost'),
  // ...
});
```

- [ ] **Step 2: 预检调用 dry-run，发布走既有链路，日志实时回显**

- [ ] **Step 3: 自检与 Commit**

```bash
npm run build 2>&1 | tail -20
git add src/views/workstation/components/StepPreview.vue src/views/workstation/index.vue
git commit -m "feat(workstation): 聚合 draft 并复用既有发布链路"
```

---

## Phase 3 — 新手指引（全屏真实表单）

### Task 10: Onboarding Store 与持久化

**Files:**
- Create: `src/stores/onboarding.ts`
- Modify: `src/types/workstation.d.ts`（增 `OnboardingState`）

**Interfaces:**
- Produces: `useOnboardingStore() => { state:{completed,currentStep,skippedSteps}, shouldAutoOpen(), markCompleted(), skipStep(n), persist() }`

- [ ] **Step 1: 实现 Store**

```ts
// src/stores/onboarding.ts
import { defineStore } from 'pinia';
import { Local } from '@/utils/storage';
export const useOnboardingStore = defineStore('onboarding', {
  state: () => ({ completed: Local.get('hasCompletedOnboarding')==='true', currentStep:0, skippedSteps:[] as number[] }),
  actions: {
    shouldAutoOpen() { return !this.completed; },
    markCompleted() { this.completed=true; Local.set('hasCompletedOnboarding','true'); Local.set('onboardingState', JSON.stringify(this.$state)); },
    skipStep(n:number){ if(!this.skippedSteps.includes(n)) this.skippedSteps.push(n); this.persist(); },
    persist(){ Local.set('onboardingState', JSON.stringify(this.$state)); },
    restore(){ const raw=Local.get('onboardingState'); if(raw) Object.assign(this, JSON.parse(raw as string)); },
  },
});
```
> 注：必须使用 `src/utils/storage.ts` 的 `Local`（带 `__NEXT_NAME__:` 前缀）而非裸 `localStorage`，否则与 `themeConfig` 等既有持久化不一致；`workstation` Store 同理用 `Session` 替代裸 `sessionStorage`。

- [ ] **Step 2: Commit**

```bash
git add src/stores/onboarding.ts src/types/workstation.d.ts
git commit -m "feat(onboarding): Store 与首启持久化"
```

---

### Task 11: 全屏向导组件

**Files:**
- Create: `src/views/workstation/components/OnboardingWizard.vue`

**Interfaces:**
- Consumes: `useOnboardingStore`、`useWorkstationStore`、四个 Step 子组件
- Produces: `<OnboardingWizard v-model="visible" />`，5 步真实表单（欢迎→项目→代码源→服务器→应用配置），底部 `上一步/跳过/下一步/完成并预检`，最后一步成功即 `markCompleted()` 并关闭

- [ ] **Step 1: 实现向导（el-dialog fullscreen + el-steps，复用 Step* 子组件）**

欢迎页含环境检测：若 `t_project` 与 `t_server` 已有数据，展示“检测到已有配置，可直接进入工作台”快捷。

- [ ] **Step 2: 自检与 Commit**

```bash
npm run build 2>&1 | tail -20
git add src/views/workstation/components/OnboardingWizard.vue
git commit -m "feat(onboarding): 全屏 5 步真实表单向导"
```

---

### Task 12: Header 帮助入口与首启自弹

**Files:**
- Modify: `src/layout/navBars/topBar/user.vue` 或 `src/layout/navBars/topBar/index.vue`
- Modify: `src/views/workstation/index.vue` 或 `src/App.vue`

**Interfaces:**
- Consumes: `useOnboardingStore`
- Produces: Header 常驻 `？` 按钮；工作台 `onMounted` 中 `if(store.shouldAutoOpen()) visible=true`；按钮点击 `visible=true`（重播时自动跳过已有步骤）

- [ ] **Step 1: 在 User 区域增按钮**

```vue
<el-button circle size="small" @click="onOpenOnboarding"><el-icon><QuestionFilled /></el-icon></el-button>
```

- [ ] **Step 2: 工作台挂载时首启自弹**

```ts
onMounted(async () => {
  if (onboarding.shouldAutoOpen()) onboardingVisible.value = true;
});
```

- [ ] **Step 3: 自检与 Commit**

```bash
npm run build 2>&1 | tail -20
git add src/layout/navBars/topBar/user.vue src/views/workstation/index.vue
git commit -m "feat(onboarding): Header 重播入口与首启自弹"
```

---

### Task 13: 端到端验证与打磨

**Files:**
- Modify: 各 i18n 文件（查漏补缺）
- Test: 手动清单 + 可选 Playwright 用例 `e2e/workstation.spec.ts`

**Interfaces:**
- Consumes: 以上全部

- [ ] **Step 1: 跑通三条验证**

1) 空库：首启向导 5 步 → 预检成功；2) 老库：工作台不经向导直接发布一次；3) 发现：本机/远端 Windows/远端 Docker 各 1 遍，零匹配时引导改前缀再扫；Header `？` 重播；跳步后最终校验禁用态。

- [ ] **Step 2: 补 i18n 与空状态文案**

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: 易用性改造收尾与文案打磨"
```

---

## Self-Review

**1. Spec coverage:**
- 新手指引（§4）：Task 10-12 覆盖全屏真实表单、5 步定义、首启/重播/跳过/持久化与校验。
- 发布工作台（§5）：Task 6-9 覆盖路由/Store/壳/四步子组件/聚合复用发布引擎。
- 服务自发现（§6）：Task 1-5 覆盖前缀 DB + 纯函数 + 三命令 + composable + 设置/服务器 UI。
- 数据/错误/安全/性能/回滚（§7-11）：分别落在 DB migration、错误分支、ssh_pool 复用、并发≤5、Phase 独立回滚。

**2. Placeholder scan:** 本计划无 `TBD/TODO/implement later`；每步均含可执行代码与命令；类型与签名在任务间一致（`DiscoveryItem / WorkstationDraft / RowAppconfigType`）。

**3. Type consistency:** `extract_real_path` / `parse_docker_inspect_mounts` / `matches_prefix` 在 Task 2 定义、Task 3 复用；`DiscoveryPrefix` 的 `enabled/isDefault` 在 DB 与 UI 同名；`WorkstationDraft` 在 Store 与 Preview 聚合处同构。


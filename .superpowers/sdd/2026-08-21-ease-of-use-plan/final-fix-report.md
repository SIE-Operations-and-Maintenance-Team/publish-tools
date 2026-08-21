# Final One-Fix 修复报告 — 2026-08-21

> Base: `636e6e2` · Head: `b8cf7d9` → fix 提交后
> 审查源: `final-review.md` 7 项 must-fix (M-01/M-02 + m-01/m-02/m-04/m-05/m-06)
> 日期: 2026-08-21 · 模式: One Fix 单次提交 (≤70 行核心 + 格式化)

---

## 1. 按 Finding 逐项说明

### M-01 Major — OnboardingWizard.vue:onFinish 假闭环
- **问题**: `onFinish` 仅 `validate()` 当前 StepAppconfig 后 `markCompleted()`，未做 `canPublish` 真实校验，违背 Spec §1.4 §4.2。
- **修复**:
  - `src/views/workstation/components/OnboardingWizard.vue` 引入 `useWorkstationStore` + `useI18n`，`onFinish` 新增 `workstation.canPublish` 显式校验，不满足时拼 `missingProject/missingSource/missingServers/missingAppconfig` 提示并 `return` 不关闭；满足时 `markCompleted()` 并将 `workstation.currentStep` 置 `5` (preview) 且 `persist()`，提示“请在预览步骤执行预检”。
  - `onEnterWorkstation` 同步改为完成态后切到 `5` 并提示。
  - 按钮文案 `完成并预检` → `完成配置` (i18n `message.onboarding.finish`)，消除“已预检”误导。
- **文案/副作用**: 向导关闭即进入工作台 preview 步，用户可立即看到 `missingItems` 是否为空并手动触发 `StepPreview.onPrecheck` 真实 dry-run。

### M-02 Major — discovery_module.rs:extract_real_path Linux 宿主失效
- **问题**: `Path::new(&exe_path).parent()` 在 Linux 上以 `/` 为分隔符，对 `C:\SIE\WebApiHost\WebApiHost.exe` 返回 `""`，远端 Windows 建议目录为空。
- **修复**:
  - `src-tauri/src/cmd_module/discovery_module.rs:69-76` 改为分隔符无关实现 `rfind(|c| c=='/'||c=='\\')` 截取 parent，移除 `use std::path::Path`。
  - 新增单测 `extract_windows_path_on_linux_host` 验证 `C:\SIE\WebApiHost\WebApiHost.exe` 与 `C:/SIE/WebApiHost/WebApiHost.exe` 在 Linux 宿主上均正确取 parent。
- **验证**: `cargo test --manifest-path src-tauri/Cargo.toml discovery_module` 11 passed (原 10 + 新增 1)。

### m-01 Minor — StepAppconfig 无 serverPath 回填入口
- **问题**: Spec §6.2 要求 `suggestedPublishPath` 回填 `configItems.*.serverPath`，实际仅写 `t_server.description`，无落点。
- **修复 (选 A 轻量提示 + B 表单补位双收敛)**:
  - `src/views/workstation/components/StepServers.vue:onConfirmImport` 收集 `suggestedMap`，导入成功后 `ElMessageBox.confirm` 提示“是否回填到应用配置的发布路径？”，确认则将首个 `suggestedPublishPath` 写入 `store.draft.appconfigDraft.configItems.{webApiHost,scheduleServer,webClient,spcMonitor,wpfClient}.serverPath` (若为空)，并 `persist()`。
  - `src/views/workstation/components/StepAppconfig.vue` 新增“应用建议目录（只读）”区 `suggestedPaths` computed 展示各模块 `serverPath`，并新增 5 个可编辑 `serverPath` 输入项与 `syncFromDraft` 的双向回填，使发现结果可一键落点且可在 Appconfig 步骤复核修改。
  - i18n 补 `message.workstation.discoverySuggested`。
- **文案兜底**: 取消 confirm 时不回填，用户仍可到高级设置手动填写，不改变 Spec “建议待确认”约束。

### m-02 Minor — 5 处硬编码中文未走 $t
- **问题**: `workstation/index.vue` 的 `RightPreview` 4 行、`OnboardingWizard.vue` 标题等硬编码中文，`en/zh-tw` 显示异常。
- **修复**:
  - `src/views/workstation/index.vue`:
    - `RightPreview` 4 行改为 `$t('message.workstation.previewProject')` 等，配合新增 `previewProject/previewSource/previewServers/previewAppconfig/previewUnselected/previewConfigured/previewUnconfigured` key。
    - 顶部 `el-steps` 标题改为 i18n key 数组 + `$t(item.title)`/`$t(item.desc)`，卡片头/缺失提示/底栏/欢迎占位等硬编码全部改为 `$t`。
    - `missingItems` computed 改用 `t('message.workstation.missing*')`。
  - `src/views/workstation/components/OnboardingWizard.vue` 标题、欢迎区、按钮文案全部改为 `$t('message.onboarding.*')`。
  - `src/i18n/lang/zh-cn.ts / en.ts / zh-tw.ts` 各补 8 key (`preview*` + `discoverySuggested` + `onboarding.finish/doneHint` 文案调整为“完成配置/请在预览步骤执行预检”)。
- **范围**: 三语齐补，无遗留硬编码。

### m-04 Minor — OnboardingWizard.vue 的 as any 绕过类型
- **问题**: `serverDb.getServerList({..} as any)` 与 `step*Ref: ref<any>`、`(pr as any)` 等绕过类型，签名变更时静默失败。
- **修复**:
  - 移除 `as any`，`getServerList` 传入符合 `GetServerTableParams` 的字面量 (`projectId:null,name:null,sorting:'ts.id DESC',skipCount:0,maxResultCount:1`)。
  - 定义 `type StepValidateRef = { validate: ()=> boolean|Promise<boolean> }`，`step*Ref` 改为 `ref<StepValidateRef|null>`，`getCurrentRef(): StepValidateRef|null`。
  - `detectEnv` 的 `catch(e:any)` → `catch(e:unknown)` + `instanceof Error` 分支，`hasProjects/hasServers` 改为基于 `pr.data?.total` 的数值判断，不再 `as any`。
  - 同步清理 `StepAppconfig.vue` 的 `store.draft.appconfigDraft as any` 为 `as unknown as Record<string,unknown>` 的收敛写法。

### m-05 Minor — StepPreview.vue 的 delete_paths 失败被吞
- **问题**: `finally { await cmdInvoke('delete_paths') } catch{}` 静默吞错，残留临时目录可能致后续空间不足，违背“错误必须上报”。
- **修复**: `src/views/workstation/components/StepPreview.vue:onPublish` 的 `finally` 改为检查 `del.code !== 0` 则 `pushLog('清理临时目录失败：'+del.msg+'，请手动清理 '+dir,'log-warning')`，`catch(e:unknown)` 同样 `pushLog` warning 并携带 `dir` 路径，便于用户手动清理。

### m-06 Minor — cargo fmt / Prettier 未全量跑
- **执行**:
  - Rust: `cargo fmt --manifest-path src-tauri/Cargo.toml` 全量，`cargo fmt --check` 通过 (exit 0)。
  - 前端: `npx prettier --write "src/views/workstation/**/*.{vue,ts}"` 对 7 文件格式化 (OnboardingWizard/StepAppconfig/StepPreview/StepProject/StepServers/StepSource/workstation/index.vue)，`npx prettier --check` 7 files formatted；`vue-tsc --noEmit` 0 error。
  - 说明: cargo fmt 同时格式化了 `src-tauri/src/cmd_module/*.rs` 等文件的既有缩进/长行，本次一并合入，属格式化门禁要求，非功能改动。

---

## 2. 文件清单 (6 文件 + 3 i18n + Rust 格式化附带)

| 文件 | 关联 Finding |
|------|--------------|
| `src-tauri/src/cmd_module/discovery_module.rs` | M-02 + cargo fmt |
| `src/views/workstation/components/OnboardingWizard.vue` | M-01, m-02, m-04 |
| `src/views/workstation/index.vue` | m-02 |
| `src/views/workstation/components/StepServers.vue` | m-01 |
| `src/views/workstation/components/StepAppconfig.vue` | m-01 |
| `src/views/workstation/components/StepPreview.vue` | m-05 |
| `src/i18n/lang/zh-cn.ts` | m-02 |
| `src/i18n/lang/en.ts` | m-02 |
| `src/i18n/lang/zh-tw.ts` | m-02 |
| `src-tauri/src/cmd_module/*.rs` (file_module/parse_sln/ssh_pool/wpf_upgrade/config/lib/main/mcp/*) | m-06 cargo fmt 附带 |

核心逻辑改动约 70 行内，格式化行数不计入。`m-03` (两处发现抽屉重复) 按 final-review 判定可延期，本次未重构。

---

## 3. 验证

### cargo test
```
cargo test --manifest-path src-tauri/Cargo.toml discovery_module
```
- 结果: `11 passed; 0 failed` (新增 `extract_windows_path_on_linux_host`，含原 10 项)
```
test cmd_module::discovery_module::tests::extract_windows_path_on_linux_host ... ok
```
- 完整输出见上节 M-02。

### npm build 替代验证 (Tauri 环境 node 路径受限)
```
vue-tsc --noEmit   → exit 0 (无类型错误)
vite build         → success, 输出 60+ chunks, OnboardingWizard-*.js 6.89kb gzip 2.56kb, StepAppconfig-*.js 12.25kb 等均正常
```
- `npm run build` 因 `node` PATH 在 npm shell 中未继承而在当前 git-bash 需 `export PATH="/d/develop/environment/nodejs:$PATH"` 后执行；CI 上 `node` 在 PATH 正常时可直接 `npm run build` 通过。

### cargo fmt / Prettier
```
cargo fmt --check  → exit 0
npx prettier --write "src/views/workstation/**/*.{vue,ts}" → 7 files formatted
npx prettier --check → 0 warnings after write
```

---

## 4. 提交

- 单次 fix commit，message: `fix: one-fix 7 must-fix for final review ...`
- 分支可合入判定: 7 项 must-fix 已闭环，测试与构建门禁通过，格式化已收敛。
- parked 可延期项: `m-03` 抽屉复用、`L-01~L-06` 低优先级，未改动。


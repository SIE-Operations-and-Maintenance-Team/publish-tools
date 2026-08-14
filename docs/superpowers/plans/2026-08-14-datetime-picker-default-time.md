# 日期范围选择器默认时间统一 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让所有日期范围选择的结束日期点选后默认 `23:59:59`、开始日期默认 `00:00:00`（覆盖 12 处 `el-date-picker type="datetime"`）。

**Architecture:** 在 `src/utils/formatTime.ts` 定义 2 个共享常量（`DEFAULT_DATE_TIME_START` / `DEFAULT_DATE_TIME_END`），5 个弹窗组件统一引用并通过 `default-time` 属性绑定到各自的开始/结束日期选择器。appconfigDialog 现有的 `DLL_MODE_DEFAULT_TIME`（datetimerange 用）改为复用共享常量，行为不变。

**Tech Stack:** Vue 3.3 (Composition API, `<script setup>`) + TypeScript + Element Plus 2.7

**规格文档:** [2026-08-14-datetime-picker-default-time-design.md](../specs/2026-08-14-datetime-picker-default-time-design.md)

## Global Constraints

- 代码风格：Vue 遵循 Prettier 风格；注释用简体中文
- 只做与目标直接相关的最小改动，不重构、不改格式
- 不修改 `scheduledPublishDialog.vue`（定时发布单点时刻）、`backupAppconfig.ts`（无日期选择 UI）
- 不改变编辑回显行为：已保存时间保持不变；不禁止用户手动展开时间面板调时间
- 本项目无单元测试框架，验证方式为 `npm run build`（vue-tsc 类型检查 + 生产构建），须以 Exit 0 通过
- 提交信息遵循项目惯例（中文，conventional commit 前缀，如 `feat: ...`）

---

### Task 1: 共享常量 — `src/utils/formatTime.ts`

**Files:**
- Modify: `src/utils/formatTime.ts`（文件末尾追加）

**Interfaces:**
- Produces: `DEFAULT_DATE_TIME_START: Date`（2000-01-01 00:00:00）、`DEFAULT_DATE_TIME_END: Date`（2000-01-01 23:59:59）——Task 2-4 全部引用

- [ ] **Step 1: 在文件末尾追加共享常量**

在 `src/utils/formatTime.ts` 末尾（`formatGitDate` 函数之后）追加：

```typescript
/**
 * 日期范围选择器默认时间：开始 00:00:00，结束 23:59:59（结束覆盖全天）
 */
export const DEFAULT_DATE_TIME_START = new Date(2000, 0, 1, 0, 0, 0);
export const DEFAULT_DATE_TIME_END = new Date(2000, 0, 1, 23, 59, 59);
```

- [ ] **Step 2: 类型检查验证**

Run: `npm run build`
Expected: Exit 0，无类型错误（`export const ... Date` 是合法顶层声明）

- [ ] **Step 3: 提交**

```bash
git add src/utils/formatTime.ts
git commit -m "feat: 新增日期范围选择器默认时间共享常量"
```

---

### Task 2: 应用配置弹窗 — `appconfigDialog.vue`

**Files:**
- Modify: `src/views/appconfig/components/appconfigDialog.vue`
  - import 行（当前 516 行）
  - 本地 `DLL_MODE_DEFAULT_TIME` 定义（当前 539-543 行）
  - TFS 开始 picker（当前 94-96 行）、TFS 结束 picker（当前 106-108 行）
  - Git 开始 picker（当前 124-126 行）、Git 结束 picker（当前 136-138 行）

**Interfaces:**
- Consumes: `DEFAULT_DATE_TIME_START` / `DEFAULT_DATE_TIME_END`（Task 1）
- Produces: 无（弹窗行为变化，无对外签名变更）

- [ ] **Step 1: 扩展 import**

当前（516 行）：
```typescript
import { formatDate } from "@/utils/formatTime";
```
改为：
```typescript
import { formatDate, DEFAULT_DATE_TIME_START, DEFAULT_DATE_TIME_END } from "@/utils/formatTime";
```

- [ ] **Step 2: 本地常量改为复用共享常量**

删除当前 539-543 行的定义：
```typescript
// 日期范围选择器默认时间：起始日 00:00:00，截止日 23:59:59（覆盖截止日全天）
const DLL_MODE_DEFAULT_TIME: [Date, Date] = [
  new Date(2000, 0, 1, 0, 0, 0),
  new Date(2000, 0, 1, 23, 59, 59),
];
```
替换为：
```typescript
// 日期范围选择器默认时间：起始日 00:00:00，截止日 23:59:59（覆盖截止日全天）
const DLL_MODE_DEFAULT_TIME: [Date, Date] = [DEFAULT_DATE_TIME_START, DEFAULT_DATE_TIME_END];
```
（第 59 行 datetimerange 的 `:default-time="DLL_MODE_DEFAULT_TIME"` 不动，行为不变）

- [ ] **Step 3: TFS 开始/结束 picker 加 default-time**

TFS 开始 picker（当前 94-96 行）：
```html
<el-date-picker class="w100" v-if="selectTfsItem.selectModel === '日期'"
  v-model="selectTfsItem.selectValue[0].value" type="datetime"
  :default-time="DEFAULT_DATE_TIME_START"
  :placeholder="selectTfsItem.selectValue[0].placeholder" />
```

TFS 结束 picker（当前 106-108 行）：
```html
<el-date-picker class="w100" v-if="selectTfsItem.selectModel === '日期'"
  v-model="selectTfsItem.selectValue[1].value" type="datetime"
  :default-time="DEFAULT_DATE_TIME_END"
  :placeholder="selectTfsItem.selectValue[1].placeholder" />
```

- [ ] **Step 4: Git 开始/结束 picker 加 default-time**

Git 开始 picker（当前 124-126 行）：
```html
<el-date-picker class="w100" v-if="selectGitItem.selectModel === '日期'"
  v-model="selectGitItem.selectValue[0].value" type="datetime"
  :default-time="DEFAULT_DATE_TIME_START"
  :placeholder="selectGitItem.selectValue[0].placeholder" />
```

Git 结束 picker（当前 136-138 行）：
```html
<el-date-picker class="w100" v-if="selectGitItem.selectModel === '日期'"
  v-model="selectGitItem.selectValue[1].value" type="datetime"
  :default-time="DEFAULT_DATE_TIME_END"
  :placeholder="selectGitItem.selectValue[1].placeholder" />
```

- [ ] **Step 5: 类型检查验证**

Run: `npm run build`
Expected: Exit 0（script setup 顶层常量可直接在 template 引用，Element Plus `default-time` 接受 `Date`；若 vue-tsc 报 `default-time` 类型不匹配，检查确认属性绑定写法）

- [ ] **Step 6: 提交**

```bash
git add src/views/appconfig/components/appconfigDialog.vue
git commit -m "feat: 应用配置 TFS/Git 日期选择默认 00:00:00~23:59:59"
```

---

### Task 3: TFS 查询记录 / 生成日志弹窗

**Files:**
- Modify: `src/views/teamFoundationServer/components/tfsLogDialog.vue`（import 行 110 行；开始 picker 38-40 行；结束 picker 50-52 行）
- Modify: `src/views/teamFoundationServer/components/historyDialog.vue`（import 行 83 行；开始 picker 38-40 行；结束 picker 50-52 行）

**Interfaces:**
- Consumes: `DEFAULT_DATE_TIME_START` / `DEFAULT_DATE_TIME_END`（Task 1）
- Produces: 无

两个文件的结构完全相同，按同样步骤各改一遍（以下以 tfsLogDialog.vue 为例，historyDialog.vue 同位置同写法）：

- [ ] **Step 1: 扩展 import（tfsLogDialog.vue）**

当前（110 行）：
```typescript
import { formatDate } from "@/utils/formatTime";
```
改为：
```typescript
import { formatDate, DEFAULT_DATE_TIME_START, DEFAULT_DATE_TIME_END } from "@/utils/formatTime";
```

- [ ] **Step 2: 开始/结束 picker 加 default-time（tfsLogDialog.vue）**

开始 picker（当前 38-40 行）：
```html
<el-date-picker class="w100" v-if="historyParams.historyModel === '日期'"
  v-model="historyParams.historyValue[0].value" type="datetime"
  :default-time="DEFAULT_DATE_TIME_START"
  :placeholder="historyParams.historyValue[0].placeholder" />
```

结束 picker（当前 50-52 行）：
```html
<el-date-picker v-if="historyParams.historyModel === '日期'" class="w100"
  v-model="historyParams.historyValue[1].value" type="datetime"
  :default-time="DEFAULT_DATE_TIME_END"
  :placeholder="historyParams.historyValue[1].placeholder" />
```

- [ ] **Step 3: 扩展 import（historyDialog.vue）**

当前（83 行）：
```typescript
import { formatDate } from "@/utils/formatTime";
```
改为：
```typescript
import { formatDate, DEFAULT_DATE_TIME_START, DEFAULT_DATE_TIME_END } from "@/utils/formatTime";
```

- [ ] **Step 4: 开始/结束 picker 加 default-time（historyDialog.vue）**

开始 picker（当前 38-40 行）：
```html
<el-date-picker class="w100" v-if="historyParams.historyModel === '日期'"
  v-model="historyParams.historyValue[0].value" type="datetime"
  :default-time="DEFAULT_DATE_TIME_START"
  :placeholder="historyParams.historyValue[0].placeholder" />
```

结束 picker（当前 50-52 行）：
```html
<el-date-picker class="w100" v-if="historyParams.historyModel === '日期'"
  v-model="historyParams.historyValue[1].value" type="datetime"
  :default-time="DEFAULT_DATE_TIME_END"
  :placeholder="historyParams.historyValue[1].placeholder" />
```

- [ ] **Step 5: 类型检查验证**

Run: `npm run build`
Expected: Exit 0

- [ ] **Step 6: 提交**

```bash
git add src/views/teamFoundationServer/components/tfsLogDialog.vue src/views/teamFoundationServer/components/historyDialog.vue
git commit -m "feat: TFS 查询记录/生成日志日期选择默认 00:00:00~23:59:59"
```

---

### Task 4: Git 查询记录 / 生成日志弹窗

**Files:**
- Modify: `src/views/git/components/gitLogDialog.vue`（import 行 114 行；开始 picker 40-42 行；结束 picker 52-54 行）
- Modify: `src/views/git/components/historyDialog.vue`（import 行 93 行；开始 picker 40-42 行；结束 picker 52-54 行）

**Interfaces:**
- Consumes: `DEFAULT_DATE_TIME_START` / `DEFAULT_DATE_TIME_END`（Task 1）
- Produces: 无

两个文件的结构完全相同，按同样步骤各改一遍（以下以 gitLogDialog.vue 为例，historyDialog.vue 同位置同写法）：

- [ ] **Step 1: 扩展 import（gitLogDialog.vue）**

当前（114 行）：
```typescript
import { formatDate } from "@/utils/formatTime";
```
改为：
```typescript
import { formatDate, DEFAULT_DATE_TIME_START, DEFAULT_DATE_TIME_END } from "@/utils/formatTime";
```

- [ ] **Step 2: 开始/结束 picker 加 default-time（gitLogDialog.vue）**

开始 picker（当前 40-42 行）：
```html
<el-date-picker class="w100" v-if="historyParams.historyModel === '日期'"
  v-model="historyParams.historyValue[0].value" type="datetime"
  :default-time="DEFAULT_DATE_TIME_START"
  :placeholder="historyParams.historyValue[0].placeholder" />
```

结束 picker（当前 52-54 行）：
```html
<el-date-picker class="w100" v-if="historyParams.historyModel === '日期'"
  v-model="historyParams.historyValue[1].value" type="datetime"
  :default-time="DEFAULT_DATE_TIME_END"
  :placeholder="historyParams.historyValue[1].placeholder" />
```

- [ ] **Step 3: 扩展 import（historyDialog.vue）**

当前（93 行）：
```typescript
import { formatDate } from "@/utils/formatTime";
```
改为：
```typescript
import { formatDate, DEFAULT_DATE_TIME_START, DEFAULT_DATE_TIME_END } from "@/utils/formatTime";
```

- [ ] **Step 4: 开始/结束 picker 加 default-time（historyDialog.vue）**

开始 picker（当前 40-42 行）：
```html
<el-date-picker class="w100" v-if="historyParams.historyModel === '日期'"
  v-model="historyParams.historyValue[0].value" type="datetime"
  :default-time="DEFAULT_DATE_TIME_START"
  :placeholder="historyParams.historyValue[0].placeholder" />
```

结束 picker（当前 52-54 行）：
```html
<el-date-picker class="w100" v-if="historyParams.historyModel === '日期'"
  v-model="historyParams.historyValue[1].value" type="datetime"
  :default-time="DEFAULT_DATE_TIME_END"
  :placeholder="historyParams.historyValue[1].placeholder" />
```

- [ ] **Step 5: 类型检查验证**

Run: `npm run build`
Expected: Exit 0

- [ ] **Step 6: 提交**

```bash
git add src/views/git/components/gitLogDialog.vue src/views/git/components/historyDialog.vue
git commit -m "feat: Git 查询记录/生成日志日期选择默认 00:00:00~23:59:59"
```

---

## 手动验证清单（全部任务完成后，可选）

`npm run dev` 启动后逐项确认：

1. 应用配置弹窗 → 获取dll方式选 **TFS** → 选 TFS 配置 → 点选开始/结束日期 → 显示 `00:00:00` / `23:59:59`
2. 获取dll方式选 **Git** → 同上
3. 应用配置弹窗 → 获取dll方式选 **日期范围** → 行为与改动前一致（`00:00:00` / `23:59:59`）
4. TFS 页面 → 查询记录、生成日志弹窗 → 点选开始/结束日期 → 显示 `00:00:00` / `23:59:59`
5. Git 页面 → 查询记录、生成日志弹窗 → 同上
6. 编辑已有配置回显：已保存的结束时间（非 23:59:59 的历史值）保持不变

# 日期范围选择器结束日期默认时间统一设计

**日期**: 2026-08-14  
**状态**: 已确认  
**涉及文件**: `src/utils/formatTime.ts`、`src/views/appconfig/components/appconfigDialog.vue`、`src/views/teamFoundationServer/components/{tfsLogDialog,historyDialog}.vue`、`src/views/git/components/{gitLogDialog,historyDialog}.vue`

---

## 背景与目标

获取DLL方式为 **TFS**（及结构相同的 **Git**）时，日期选择控件（`el-date-picker type="datetime"`）在用户点选日期后，时间部分默认填为**当前时刻**（如 `2026-08-14 15:30:42`），导致结束日期未覆盖当天全天。

目标：所有日期范围选择的**结束日期**，点选后默认时间统一为 `23:59:59`；同时**开始日期**统一为 `00:00:00`（与"日期范围"模式 `datetimerange` 行为一致）。

## 非目标

- 不修改 `scheduledPublishDialog.vue`（定时发布为单点精确时刻，非日期范围）
- 不修改 `backupAppconfig.ts`（无日期选择 UI，仅数据流转）
- 不改变编辑回显行为：已保存配置中的结束时间保持不变，`default-time` 仅在用户重新点选日期时生效
- 不禁用用户手动展开时间面板调整时间（以手动选择为准）

---

## 关键决策

| 决策点 | 结论 | 理由 |
|---|---|---|
| 常量位置 | 抽到 `src/utils/formatTime.ts` 共享 | 5 个弹窗需要完全一致的两个值，单一来源；该文件是项目现有日期工具文件 |
| 开始日期是否统一 | 也默认 `00:00:00` | 用户确认；与"日期范围"模式行为一致 |
| 结束日期默认值 | `23:59:59` | 覆盖结束日当天全天 |
| 已有 `DLL_MODE_DEFAULT_TIME` | 保留变量名，值改为引用共享常量 | datetimerange（第 59 行）行为不变，最小改动 |

---

## 实现方案

### 1. 共享常量 — `src/utils/formatTime.ts` 末尾新增

```typescript
// 日期范围选择器默认时间：开始 00:00:00，结束 23:59:59（结束覆盖全天）
export const DEFAULT_DATE_TIME_START = new Date(2000, 0, 1, 0, 0, 0);
export const DEFAULT_DATE_TIME_END = new Date(2000, 0, 1, 23, 59, 59);
```

### 2. `src/views/appconfig/components/appconfigDialog.vue`（应用配置弹窗）

- 删除本地 `DLL_MODE_DEFAULT_TIME` 定义，改为：
  ```typescript
  const DLL_MODE_DEFAULT_TIME: [Date, Date] = [DEFAULT_DATE_TIME_START, DEFAULT_DATE_TIME_END];
  ```
- TFS 开始日期（94 行）、Git 开始日期（124 行）加 `:default-time="DEFAULT_DATE_TIME_START"`
- TFS 结束日期（106 行）、Git 结束日期（136 行）加 `:default-time="DEFAULT_DATE_TIME_END"`
- 第 59 行 datetimerange 不动（复用 `DLL_MODE_DEFAULT_TIME`，行为不变）

### 3. 查询/日志弹窗（各 2 处，开始 `DEFAULT_DATE_TIME_START`，结束 `DEFAULT_DATE_TIME_END`）

| 文件 | 开始日期行号 | 结束日期行号 |
|---|---|---|
| `src/views/teamFoundationServer/components/tfsLogDialog.vue` | 38 | 50 |
| `src/views/teamFoundationServer/components/historyDialog.vue` | 38 | 50 |
| `src/views/git/components/gitLogDialog.vue` | 40 | 52 |
| `src/views/git/components/historyDialog.vue` | 40 | 52 |

各文件导入常量后给对应 picker 加 `:default-time` 属性。

---

## 行为说明

- `default-time` 仅影响用户通过日历面板**点选日期**时的时间部分
- 已有值（本周初始默认值 `getWeekStartEnd()`、编辑回显的已保存值）不受影响
- 用户展开时间面板手动改时间后，以手动选择为准

---

## 验证方式

1. `npm run build`（vue-tsc 类型检查 + 生产构建）确认无类型错误
2. 手动验证（`npm run dev`）：
   - 应用配置弹窗：获取dll方式选 TFS / Git，点选开始/结束日期，确认显示 `00:00:00` / `23:59:59`
   - TFS/Git 查询记录、生成日志弹窗：同样点选确认
   - 编辑已有配置回显：已保存时间保持不变

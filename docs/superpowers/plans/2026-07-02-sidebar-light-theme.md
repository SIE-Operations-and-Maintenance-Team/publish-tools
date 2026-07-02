# 左侧导航栏亮色配色优化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将左侧导航栏从暗绿灰配色改为纯白亮色，提升视觉效果。

**Architecture:** 仅修改 `src/stores/themeConfig.ts` 中 3 个默认值（`menuBar` / `menuBarColor` / `menuBarActiveColor`）。CSS 变量链路（store → setings.vue → `--next-bg-*` → app.scss/element.scss）和深色模式覆盖（dark.scss）无需改动，自动适配。

**Tech Stack:** TypeScript (Pinia store)

## Global Constraints

- 只改默认值，不动 CSS 变量、样式文件、深色模式
- 不改动分栏菜单（`columnsMenuBar` / `columnsMenuBarColor`）配色
- 改动后视觉自检：侧栏白色背景、深灰文字、浅蓝高亮

---

### Task 1: 修改侧栏默认配色为亮色

**Files:**
- Modify: `src/stores/themeConfig.ts:34-38`

**Interfaces:**
- Consumes: 无
- Produces: `ThemeConfigState.themeConfig.menuBar` / `menuBarColor` / `menuBarActiveColor` 新默认值

- [ ] **Step 1: 修改 menuBar 背景色为白色**

```typescript
// 第 34 行
// 改前：menuBar: '#545c64',
// 改后：
menuBar: '#ffffff',
```

- [ ] **Step 2: 修改 menuBarColor 字体色为深灰**

```typescript
// 第 36 行
// 改前：menuBarColor: '#eaeaea',
// 改后：
menuBarColor: '#303133',
```

- [ ] **Step 3: 修改 menuBarActiveColor 高亮背景为浅蓝**

```typescript
// 第 38 行
// 改前：menuBarActiveColor: 'rgba(0, 0, 0, 0.2)',
// 改后：
menuBarActiveColor: '#ecf5ff',
```

- [ ] **Step 4: 启动应用验证视觉效果**

```bash
npm run dev
```

确认：左侧导航栏白色背景、菜单项深灰文字、选中项浅蓝背景高亮。侧栏与内容区之间有分隔线（`aside.vue` 自动检测白色背景添加的 `layout-el-aside-br-color` 类）。

- [ ] **Step 5: Commit**

```bash
git add src/stores/themeConfig.ts
git commit -m "style: 左侧导航栏改为亮色配色（白底/深灰文字/浅蓝高亮）"
```

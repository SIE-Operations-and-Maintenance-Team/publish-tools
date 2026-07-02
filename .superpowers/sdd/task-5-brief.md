### Task 5: 发布信息卡片 — 备份路径输入框 + 持久化

**Files:**
- Modify: `src/views/papersPublish/index.vue`

**Interfaces:**
- Consumes: `useProjectDb` (existing DAO), `publishConfig.backupBasePath` (from Task 1)
- Produces: template 中输入框 + script 中 `watch` 持久化逻辑

- [ ] **Step 1: 新增 `import`**

在第 179 行（`utils/other` import 之后）加：

```ts
import { useProjectDb } from "@/database/project/index";
```

- [ ] **Step 2: 新增 `watch` 导入**

第 169 行已有 `ref, reactive, onBeforeMount, defineAsyncComponent, nextTick`，追加 `watch`：

```ts
import { ref, reactive, onBeforeMount, defineAsyncComponent, nextTick, watch } from "vue";
```

- [ ] **Step 3: 在 template 中「发布信息」行前新增备份路径输入框**

第 85 行 `<tr v-show="publishConfig.notes">` 之前插入：

```html
<tr>
  <th>备份路径</th>
  <td colspan="3">
    <el-input
      v-model="publishConfig.backupBasePath"
      placeholder="选填，配置后备份到指定路径；不填则使用默认路径"
      :disabled="publishItem.loading"
      clearable
    />
  </td>
</tr>
```

- [ ] **Step 4: 新增持久化逻辑**

在第 198 行 `publishItem` 定义之后插入完整的持久化代码块：

```ts
// 备份路径持久化
const projectDbForBackup = useProjectDb();
const isLoadingBackupPath = ref(false);
let saveBackupPathTimer: ReturnType<typeof setTimeout>;

// 回填：解析 .smom 后，从数据库加载备份路径
const loadBackupBasePath = async () => {
  if (!publishConfig.projectName) return;
  isLoadingBackupPath.value = true;
  try {
    const result = await projectDbForBackup.getProjectList({
      code: null, name: publishConfig.projectName, sorting: null,
      skipCount: 0, maxResultCount: 1000,
    });
    if (result.code === 0) {
      // getProjectList 的 name 是 LIKE 模糊匹配，前端精确过滤
      const project = result.data.data.find(p => p.name === publishConfig.projectName);
      if (project) publishConfig.backupBasePath = project.backupBasePath ?? '';
    }
  } catch (e) {
    console.error('加载备份路径失败:', e);
  } finally {
    isLoadingBackupPath.value = false;
  }
};

// 用户修改时自动持久化（debounce 800ms）
watch(
  () => publishConfig.backupBasePath,
  (newVal) => {
    if (isLoadingBackupPath.value || !publishConfig.projectName) return;
    clearTimeout(saveBackupPathTimer);
    saveBackupPathTimer = setTimeout(async () => {
      try {
        const result = await projectDbForBackup.getProjectList({
          code: null, name: publishConfig.projectName, sorting: null,
          skipCount: 0, maxResultCount: 1000,
        });
        if (result.code !== 0) return;
        const project = result.data.data.find(p => p.name === publishConfig.projectName);
        if (!project) return;
        project.backupBasePath = newVal || null;
        await projectDbForBackup.updateProject(project);
      } catch (e) {
        console.error('持久化备份路径失败:', e);
      }
    }, 800);
  }
);
```

- [ ] **Step 5: 在 `onSelectPublishFile` 解析完成后调用回填**

第 274 行 `ElMessage.success("解析[SMOM发布文件]成功！");` 之后，`publishItem.value.loading = false;` 之前插入：

```ts
  await loadBackupBasePath();
```

- [ ] **Step 6: 运行类型检查**

```bash
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/views/papersPublish/index.vue
git commit -m "feat: 发布信息卡片新增备份路径输入框及持久化逻辑"
```

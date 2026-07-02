### Task 4: 项目弹窗 — 备份基础路径输入框

**Files:**
- Modify: `src/views/project/components/projectDialog.vue`

**Interfaces:**
- Consumes: `RowProjectType.backupBasePath` (from Task 1)
- Produces: 项目新增/编辑弹窗中可输入 `backupBasePath`

- [ ] **Step 1: 在 `state.ruleForm` 初始值中加 `backupBasePath`**

第 110-117 行，在 `assemblyOutPath: null,` 之后加：

```ts
const state = reactive<FormDialogType<RowProjectType>>({
  ruleForm: {
    id: null,
    code: null,
    name: null,
    description: null,
    isDefault: 0,
    assemblyOutPath: null,
    backupBasePath: null,
  },
  // ...
});
```

- [ ] **Step 2: 在 template 中「描述」字段之前新增输入框**

在第 62 行 `</el-col>`（程序集输出路径结束）之后、第 63 行 `<el-col :span="24">`（描述）之前，插入：

```html
<el-col :span="24" class="mb20">
  <el-form-item label="备份基础路径" prop="backupBasePath">
    <el-input
      v-model="state.ruleForm.backupBasePath"
      placeholder="选填，如 /home/backups/smom"
      maxlength="450"
      clearable
    ></el-input>
  </el-form-item>
</el-col>
```

- [ ] **Step 3: 运行类型检查**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/views/project/components/projectDialog.vue
git commit -m "feat: 项目弹窗新增备份基础路径输入框"
```

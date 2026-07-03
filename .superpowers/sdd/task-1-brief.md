### Task 1: 类型定义

**Files:**
- Modify: `src/types/project.d.ts`
- Modify: `src/types/manuallyPublish.d.ts`

**Interfaces:**
- Produces: `RowProjectType.backupBasePath: string | null`, `CommonPapersPublishType.backupBasePath?: string`

- [ ] **Step 1: 给 `RowProjectType` 新增 `backupBasePath` 字段**

打开 `src/types/project.d.ts`，在 `RowProjectType` 末尾（`assemblyOutPath` 之后）加：

```ts
// project
declare type RowProjectType = {
	id: number | null;
	code: string | null;
	name: string | null;
	description: string | null;
	isDefault: number | null;
	assemblyOutPath: string | null;
	backupBasePath: string | null;
};
```

- [ ] **Step 2: 给 `CommonPapersPublishType` 新增可选字段**

打开 `src/types/manuallyPublish.d.ts`，在 `CommonPapersPublishType` 中加：

```ts
declare type CommonPapersPublishType = {
	projectName: string;
	environment: number;
	publishMode: number;
	isBackup: number;
	generateDate: string;
	notes?: string;
	isNewVersion: boolean | null;
	backupBasePath?: string;  // 服务端备份基础路径，从数据库按项目回填
};
```

- [ ] **Step 3: 验证类型编译**

```bash
npm run build
```

期望：无类型错误。

- [ ] **Step 4: Commit**

```bash
git add src/types/project.d.ts src/types/manuallyPublish.d.ts
git commit -m "feat: 类型定义新增 backupBasePath 字段"
```

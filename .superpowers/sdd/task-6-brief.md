### Task 6: getBackupPath 签名变更

**Files:**
- Modify: `src/views/papersPublish/index.vue`

**Interfaces:**
- Consumes: `publishConfig.backupBasePath` (from Task 5)
- Produces: `getBackupPath(path, currentDate, backupBasePath?)` — 新签名，14 处调用点 + 4 方法签名 + 10 调用方传参全部更新

---

#### Step 1: 修改 `getBackupPath` 函数体

替换第 2297-2302 行（原 `getBackupPath`，注意 Task 5 加了约 64 行后行号可能偏移，实际函数签名约在 `getBackupPath(path: string, currentDate: string)` 附近）：

```ts
// 获取备份路径
const getBackupPath = (path: string, currentDate: string, backupBasePath?: string | null) => {
  const bkPath = removeSlash(path);
  const bkLastIndex = bkPath.lastIndexOf("/");
  const folderName = currentDate.replace(/-/g, "").replace(/:/g, "").replace(/\s+/g, "");
  const fileName = bkPath.substring(bkLastIndex + 1);

  // 有自定义基础路径 → 使用自定义路径作为前缀
  if (backupBasePath) {
    return `${removeSlash(backupBasePath)}/${folderName}/${fileName}`;
  }

  // 无自定义路径 → 保持现有逻辑
  const backupPrefixPath = bkPath.substring(0, bkLastIndex);
  return `${backupPrefixPath}/Backups/${folderName}/${fileName}`;
};
```

---

#### Step 2: 更新 `localPublishBeforeBackup` 内 5 处 `getBackupPath` 调用（A 组）

每处 `getBackupPath(xxx, currentDate)` 尾部加第 3 参 `, publishConfig.backupBasePath`：

```
第 770 行附近: getBackupPath(bLocalPublishConfig.webApiHost.serverConfigs[j].publishPath, currentDate)
  → getBackupPath(..., currentDate, publishConfig.backupBasePath)

第 794 行附近: 同上（ScheduleServer）
第 818 行附近: 同上（WebClient）  
第 842 行附近: 同上（SpcMonitor）
第 866 行附近: getBackupPath(bLocalPublishConfig.wpfClient.publishPath, currentDate)
  → getBackupPath(..., currentDate, publishConfig.backupBasePath)
```

> 提示：用 `grep "getBackupPath" src/views/papersPublish/index.vue` 定位精确行号，逐一修改。

---

#### Step 3: 更新 `remotePublishBeforeBackup` 内 5 处 `getBackupPath` 调用（A 组）

同上，每处 `getBackupPath(xxx, currentDate)` 尾部加 `, publishConfig.backupBasePath`：

```
行号 grep 定位: WebApiHost / ScheduleServer / WebClient / SpcMonitor / WpfClient
```

---

#### Step 4: 修改 `localPublishServerBackup` 签名 + 内部调用（B 组）

**签名** — 在原 `serverName` 参数后加 `backupBasePath?: string | null`：

```ts
const localPublishServerBackup = async (
  publishServer: PublishServerType,
  currentDate: string,
  serverName: string,
  backupBasePath?: string | null,
) => {
```

**内部调用** — `getBackupPath(serverConfig.publishPath, currentDate)` → `getBackupPath(serverConfig.publishPath, currentDate, backupBasePath)`

---

#### Step 5: 修改 `localPublishWpfBackup` 签名 + 内部调用（B 组）

**签名** — 在 `isNewVersion` 参数后加 `backupBasePath?: string | null`：

```ts
const localPublishWpfBackup = async (
  publishServer: PublishWpfType,
  currentDate: string,
  serverName: string,
  isNewVersion: boolean | null = false,
  backupBasePath?: string | null,
) => {
```

**内部调用** — `getBackupPath(publishServer.publishPath, currentDate)` → `getBackupPath(publishServer.publishPath, currentDate, backupBasePath)`

---

#### Step 6: 修改 `remotePublishServerBackup` 签名 + 内部调用（B 组）

**签名** — 在 `serverName` 参数后加 `backupBasePath?: string | null`：

```ts
const remotePublishServerBackup = async (
  publishServers: PublishServerType[],
  currentDate: string,
  serverName: string,
  backupBasePath?: string | null,
) => {
```

**内部调用** — `getBackupPath(serverConfig.publishPath, currentDate)` → `getBackupPath(serverConfig.publishPath, currentDate, backupBasePath)`

---

#### Step 7: 修改 `remotePublishWpfBackup` 签名 + 内部调用（B 组）

**签名** — 在 `isNewVersion` 参数后加 `backupBasePath?: string | null`：

```ts
const remotePublishWpfBackup = async (
  publishServer: PublishWpfType,
  currentDate: string,
  serverName: string,
  isNewVersion: boolean | null = false,
  backupBasePath?: string | null,
) => {
```

**内部调用** — `getBackupPath(publishServer.publishPath, currentDate)` → `getBackupPath(publishServer.publishPath, currentDate, backupBasePath)`

---

#### Step 8: 更新 B 组方法的 10 处调用方传参

在 **`localPublishBeforeBackup`** 中，4 处 `localPublishServerBackup(...)` 和 1 处 `localPublishWpfBackup(...)` 调用末尾加 `, publishConfig.backupBasePath`：

```
localPublishServerBackup(xxx, currentDate, "WebApiHost")
  → localPublishServerBackup(xxx, currentDate, "WebApiHost", publishConfig.backupBasePath)

localPublishServerBackup(xxx, currentDate, "ScheduleServer") → 同样加第 4 参
localPublishServerBackup(xxx, currentDate, "WebClient")    → 同样加第 4 参
localPublishServerBackup(xxx, currentDate, "SpcMonitor")   → 同样加第 4 参

localPublishWpfBackup(xxx, currentDate, "WpfClient", localPublishConfig.value.isNewVersion)
  → localPublishWpfBackup(xxx, currentDate, "WpfClient", localPublishConfig.value.isNewVersion, publishConfig.backupBasePath)
```

在 **`remotePublishBeforeBackup`** 中同理（4 处 `remotePublishServerBackup` + 1 处 `remotePublishWpfBackup`）：

```
remotePublishServerBackup(xxx, currentDate, "WebApiHost")
  → remotePublishServerBackup(xxx, currentDate, "WebApiHost", publishConfig.backupBasePath)

remotePublishServerBackup(xxx, currentDate, "ScheduleServer") → 同样加第 4 参
remotePublishServerBackup(xxx, currentDate, "WebClient")    → 同样加第 4 参
remotePublishServerBackup(xxx, currentDate, "SpcMonitor")   → 同样加第 4 参

remotePublishWpfBackup(xxx, currentDate, "WpfClient", remotePublishConfig.value.isNewVersion)
  → remotePublishWpfBackup(xxx, currentDate, "WpfClient", remotePublishConfig.value.isNewVersion, publishConfig.backupBasePath)
```

---

#### Step 9: 验证

```bash
npm run build
```

预期：零类型错误。遗漏的调用点 TS 编译报错。

#### Step 10: Commit

```bash
git add src/views/papersPublish/index.vue
git commit -m "feat: getBackupPath 支持自定义备份基础路径"
```

<!-- src/views/appconfig/components/uploadTemplateDialog.vue -->
<template>
  <el-dialog
    :title="state.dialog.title"
    v-model="state.dialog.show"
    :close-on-click-modal="false"
    :close-on-press-escape="!state.uploading"
    :show-close="!state.uploading"
    width="1040px"
    destroy-on-close
  >
    <div class="upload-template-content">
      <div class="source-row mb15">
        <span class="source-label">模板来源</span>
        <el-button :disabled="state.uploading" @click="onSelectFiles">
          <el-icon><ele-Document /></el-icon>
          选择模板文件
        </el-button>
        <el-button :disabled="state.uploading" @click="onSelectFolder">
          <el-icon><ele-FolderOpened /></el-icon>
          选择模板文件夹
        </el-button>
        <span class="source-summary" :title="state.sourceDetail">
          {{ state.sourceSummary }}
        </span>
      </div>

      <div class="target-summary mb10">
        上传目标：共 {{ state.targets.length }} 项，可上传
        <span class="text-success">{{ uploadableCount }}</span> 项{{ skippedSummary }}
      </div>

      <el-table :data="state.targets" size="default" max-height="320" stripe>
        <el-table-column type="index" label="序号" width="60" />
        <el-table-column
          prop="appconfigName"
          label="应用配置"
          min-width="150"
          show-overflow-tooltip
        />
        <el-table-column prop="serverName" label="服务器" min-width="110" show-overflow-tooltip />
        <el-table-column prop="identity" label="服务标识" width="120" show-overflow-tooltip />
        <el-table-column prop="remoteDir" label="目标目录" min-width="240" show-overflow-tooltip />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">
              {{ statusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="detail" label="说明" min-width="200" show-overflow-tooltip />
      </el-table>

      <el-progress
        v-if="state.uploading || state.progress > 0"
        class="mt15"
        :percentage="state.progress"
        :status="state.progressStatus"
      />
      <div v-if="state.progressText" class="progress-text">{{ state.progressText }}</div>
    </div>

    <template #footer>
      <el-button v-if="state.uploading" type="warning" size="default" @click="onStop">
        停 止
      </el-button>
      <el-button size="default" :disabled="state.uploading" @click="onClose">关 闭</el-button>
      <el-button
        type="primary"
        size="default"
        :loading="state.uploading"
        :disabled="!canUpload"
        @click="onUpload"
      >
        开始上传
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts" name="uploadTemplateDialog">
import { ref, reactive, computed } from "vue";
import { ElMessage } from "element-plus";
import { open } from "@tauri-apps/plugin-dialog";
import { path } from "@tauri-apps/api";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { cmdInvoke } from "@/utils/command";
import { displayEnvironment, removeSlash } from "@/utils/other";
import { useServerDb } from "@/database/servers/index";

// 模板上传状态
type TemplateTargetStatus =
  | "pending"
  | "uploading"
  | "success"
  | "failed"
  | "skipped"
  | "cancelled";

// 单个上传目标（应用配置 × 服务器 × 发布路径）
interface TemplateTarget {
  appconfigName: string;
  serverName: string;
  identity: string;
  remoteDir: string;
  serverAddress: string;
  username: string;
  password: string;
  status: TemplateTargetStatus;
  detail: string;
}

const STATUS_TEXT: Record<TemplateTargetStatus, string> = {
  pending: "待上传",
  uploading: "上传中",
  success: "成功",
  failed: "失败",
  skipped: "跳过",
  cancelled: "已停止",
};

const STATUS_TAG: Record<
  TemplateTargetStatus,
  "success" | "warning" | "danger" | "info"
> = {
  pending: "info",
  uploading: "warning",
  success: "success",
  failed: "danger",
  skipped: "warning",
  cancelled: "info",
};

// 引入服务器数据库
const serverDb = useServerDb();

const state = reactive({
  dialog: {
    show: false,
    title: "上传模板到服务器",
  },
  // 模板来源：文件夹方式（选了文件夹时有效）
  sourceDir: "",
  // 模板来源：文件方式（选了文件时有效）
  sourceFiles: [] as string[],
  sourceSummary: "未选择模板",
  sourceDetail: "",
  targets: [] as TemplateTarget[],
  uploading: false,
  stopRequested: false,
  progress: 0,
  progressStatus: "" as "" | "success" | "exception",
  progressText: "",
});

// 正在上传的日志标识，用于过滤进度事件
const currentTabId = ref("");

const skippedCount = computed(
  () => state.targets.filter((item) => item.status === "skipped").length
);
// 可上传目标：除跳过项外全部生效（每次点击都重新覆盖上传）
const uploadableCount = computed(
  () => state.targets.filter((item) => item.status !== "skipped").length
);
const canUpload = computed(
  () =>
    !state.uploading &&
    uploadableCount.value > 0 &&
    (!!state.sourceDir || state.sourceFiles.length > 0)
);
// 跳过项汇总文案（无跳过项时不显示）
const skippedSummary = computed(() =>
  skippedCount.value > 0
    ? `，跳过 ${skippedCount.value} 项（原因见“说明”列）`
    : ""
);

const statusText = (status: TemplateTargetStatus) => STATUS_TEXT[status];
const statusTagType = (status: TemplateTargetStatus) => STATUS_TAG[status];

// 提取错误描述（cmdInvoke 失败时 data 为 Rust 返回的字符串或异常对象）
const errorText = (data: any) => {
  if (typeof data === "string") return data;
  if (data?.message) return String(data.message);
  return JSON.stringify(data);
};

// 重置模板来源
const resetSource = () => {
  state.sourceDir = "";
  state.sourceFiles = [];
  state.sourceSummary = "未选择模板";
  state.sourceDetail = "";
};

// 选择模板文件（可多选，全部平铺上传到 Templates 根目录）
const onSelectFiles = async () => {
  if (state.uploading) return;
  const selected = await open({
    multiple: true,
    directory: false,
    title: "选择模板文件",
  });
  const files = (Array.isArray(selected) ? selected : selected ? [selected] : []).map(
    (item) => String(item)
  );
  if (files.length < 1) return;

  // 同名文件会落到同一个远程文件，直接拦截，避免静默覆盖
  const nameSet = new Set<string>();
  const duplicateNames = new Set<string>();
  for (const file of files) {
    const fileName = file.split(/[\\/]/).pop() || "";
    if (nameSet.has(fileName)) duplicateNames.add(fileName);
    nameSet.add(fileName);
  }
  if (duplicateNames.size > 0) {
    ElMessage.error(
      `所选文件存在同名文件：[${[...duplicateNames].join("、")}]，请改名或改用“选择模板文件夹”`
    );
    return;
  }

  state.sourceDir = "";
  state.sourceFiles = files;
  state.sourceSummary = `已选 ${files.length} 个文件`;
  state.sourceDetail = files.join("\n");
};

// 选择模板文件夹（保留子目录结构）
const onSelectFolder = async () => {
  if (state.uploading) return;
  const selected = await open({
    directory: true,
    multiple: false,
    title: "选择模板文件夹",
  });
  if (!selected) return;
  const folderPath = removeSlash(String(selected));
  const folderName = folderPath.split("/").pop() || folderPath;
  state.sourceFiles = [];
  state.sourceDir = folderPath;
  state.sourceSummary = `文件夹：${folderName}（保留子目录结构）`;
  state.sourceDetail = folderPath;
};

/**
 * 解析所有上传目标
 * 目标 = 每个应用配置 × 每台 WebClient 服务器 × 每条发布路径
 * 无法上传的情况保留为「跳过」行，说明原因，便于用户排查
 */
const buildTargets = async (rows: RowAppconfigType[]): Promise<TemplateTarget[]> => {
  const targets: TemplateTarget[] = [];
  // 已出现目标：服务器地址 + 远程目录 → 序号
  const seenTargets = new Map<string, number>();
  // 服务器详情缓存：服务器ID → 服务器信息
  const serverCache = new Map<number, RowServerType | null>();

  const pushSkip = (
    appconfigName: string,
    serverName: string,
    identity: string,
    detail: string
  ) => {
    targets.push({
      appconfigName,
      serverName,
      identity,
      remoteDir: "-",
      serverAddress: "",
      username: "",
      password: "",
      status: "skipped",
      detail,
    });
  };

  for (const row of rows) {
    const appconfigName = `${row.projectName || "-"} - ${displayEnvironment(
      Number(row.environment)
    )}`;
    const serverArr = row.configItems?.webClient?.serverArr || [];
    if (serverArr.length < 1) {
      pushSkip(appconfigName, "-", "-", "未配置 WebClient 应用服务器");
      continue;
    }

    for (const serverItem of serverArr) {
      const serverName = serverItem.name || "-";
      if (!serverItem.id) {
        pushSkip(appconfigName, serverName, "-", "应用服务器未选择或已不存在");
        continue;
      }
      const serverId = Number(serverItem.id);
      if (!serverCache.has(serverId)) {
        const detail = await serverDb.getServerById(serverId);
        // 查不到时 getServerById 仍返回 code 0（data 为空对象），用 id 兜底判断
        serverCache.set(
          serverId,
          detail.code === 0 && detail.data.data?.id ? detail.data.data : null
        );
      }
      const serverInfo = serverCache.get(serverId) || null;
      if (!serverInfo) {
        pushSkip(appconfigName, serverName, "-", `服务器[${serverName}]不存在`);
        continue;
      }

      const serverAddress = `${serverInfo.ip}:${serverInfo.port}`;
      const publishPaths = (serverItem.serverPathArr || []).flatMap(
        (item) => item.value || []
      );
      if (publishPaths.length < 1) {
        pushSkip(appconfigName, serverName, "-", "未配置服务标识/发布路径");
        continue;
      }

      for (const publishPath of publishPaths) {
        const identity = publishPath.identity || "";
        const pathValue = (publishPath.path || "").trim();
        if (!pathValue) {
          pushSkip(appconfigName, serverName, identity, "未填写发布路径");
          continue;
        }
        const remoteDir = `${removeSlash(pathValue)}/wwwroot/Templates`;
        const targetKey = `${serverAddress}|${remoteDir}`;
        const existIndex = seenTargets.get(targetKey);
        if (existIndex) {
          pushSkip(appconfigName, serverName, identity, `与第 ${existIndex} 项目标重复`);
          continue;
        }
        seenTargets.set(targetKey, targets.length + 1);
        targets.push({
          appconfigName,
          serverName,
          identity,
          remoteDir,
          serverAddress,
          username: serverInfo.account,
          password: serverInfo.pwd,
          status: "pending",
          detail: "",
        });
      }
    }
  }

  return targets;
};

// 打开弹窗
const openDialog = async (rows: RowAppconfigType[]) => {
  state.dialog.show = true;
  state.uploading = false;
  state.stopRequested = false;
  state.progress = 0;
  state.progressStatus = "";
  state.progressText = "";
  resetSource();
  state.targets = [];
  state.targets = await buildTargets(rows || []);
};

/**
 * 准备本地上传目录
 * 文件夹方式直接上传所选目录；文件方式先复制到临时目录，统一按目录上传
 */
const prepareLocalSource = async (): Promise<string> => {
  if (state.sourceDir) {
    const existsResult = await cmdInvoke("exists", { path: state.sourceDir });
    if (existsResult.code !== 0) {
      ElMessage.error(`模板文件夹不存在：${state.sourceDir}`);
      return "";
    }
    return state.sourceDir;
  }

  const appDataDir = removeSlash(String(await path.appDataDir()));
  const stagingDir = `${appDataDir}/tempUploadTemplates/${Date.now()}`;
  const createResult = await cmdInvoke("create_dir", { path: stagingDir });
  if (createResult.code !== 0) {
    ElMessage.error(`创建模板暂存目录失败：${errorText(createResult.data)}`);
    return "";
  }
  for (const file of state.sourceFiles) {
    const fileName = file.split(/[\\/]/).pop() || "";
    const copyResult = await cmdInvoke("copy_path", {
      source: file,
      destination: `${stagingDir}/${fileName}`,
    });
    if (copyResult.code !== 0) {
      ElMessage.error(`暂存模板文件失败：${errorText(copyResult.data)}`);
      await cmdInvoke("delete_paths", { paths: [stagingDir] });
      return "";
    }
  }
  return stagingDir;
};

// 标记剩余目标为已停止
const markRemainingCancelled = (targets: TemplateTarget[]) => {
  for (const target of targets) {
    if (target.status !== "pending") continue;
    target.status = "cancelled";
    target.detail = "已停止";
  }
};

// 停止上传
const onStop = async () => {
  if (!state.uploading) return;
  state.stopRequested = true;
  state.progressText = "正在停止上传...";
  await cmdInvoke("cancel_sync_upload");
};

// 开始上传
const onUpload = async () => {
  if (state.uploading) return;
  if (!state.sourceDir && state.sourceFiles.length < 1) {
    ElMessage.warning("请先选择模板文件或模板文件夹");
    return;
  }
  // 跳过项（未配置服务器/发布路径、重复目标）不参与上传
  const uploadTargets = state.targets.filter((item) => item.status !== "skipped");
  if (uploadTargets.length < 1) {
    ElMessage.warning("没有可上传的目标，请检查所选应用配置的 WebClient 发布路径");
    return;
  }
  // 每次上传都从「待上传」开始（含上次失败/成功的目标，便于改完模板后重传）
  for (const target of uploadTargets) target.status = "pending";

  state.uploading = true;
  state.stopRequested = false;
  state.progress = 0;
  state.progressStatus = "";
  state.progressText = "";

  let unlisten: UnlistenFn | null = null;
  let stagingDir = "";
  try {
    state.progressText = "正在准备模板文件...";
    const localDir = await prepareLocalSource();
    if (!localDir) return;
    // 文件方式使用临时目录，结束后清理
    if (state.sourceFiles.length > 0) stagingDir = localDir;

    // 进度事件：publish://upload-progress（Rust 端 100ms 节流）
    unlisten = await listen<UploadProgressPayloadType>(
      "publish://upload-progress",
      (event) => {
        if (!currentTabId.value || event.payload.tabId !== currentTabId.value) return;
        const { current, total, fileName } = event.payload;
        state.progress = total > 0 ? Math.round((current / total) * 100) : 0;
        state.progressText = `${fileName}（${current}/${total}）`;
      }
    );

    let successCount = 0;
    for (let i = 0; i < uploadTargets.length; i++) {
      if (state.stopRequested) {
        markRemainingCancelled(uploadTargets.slice(i));
        break;
      }
      const target = uploadTargets[i];
      target.status = "uploading";
      target.detail = "";
      currentTabId.value = `template-upload-${Date.now()}-${i}`;
      state.progress = 0;
      state.progressText = `第 ${i + 1}/${
        uploadTargets.length
      } 项：${target.serverName} → ${target.remoteDir}`;

      const uploadResult = await cmdInvoke<UploadSyncResultType>("sync_dir_to_server", {
        localDir,
        remoteDir: target.remoteDir,
        username: target.username,
        password: target.password,
        server: target.serverAddress,
        tabId: currentTabId.value,
        // 按确认结果：不做差量判断，全部强制覆盖
        force: true,
      });

      if (uploadResult.code === 0) {
        const uploadData = uploadResult.data;
        target.status = "success";
        target.detail = `已上传 ${uploadData?.uploaded ?? 0} 个文件（共 ${
          uploadData?.total ?? 0
        } 个）`;
        successCount++;
      } else if (state.stopRequested) {
        target.status = "cancelled";
        target.detail = "已停止";
        markRemainingCancelled(uploadTargets.slice(i + 1));
        break;
      } else {
        target.status = "failed";
        target.detail = errorText(uploadResult.data);
      }
    }
    currentTabId.value = "";

    const failedCount = uploadTargets.filter((item) => item.status === "failed").length;
    const cancelledCount = uploadTargets.filter(
      (item) => item.status === "cancelled"
    ).length;
    state.progressStatus = failedCount > 0 ? "exception" : "success";
    if (failedCount > 0) {
      ElMessage.warning(
        `上传完成：成功 ${successCount} 项，失败 ${failedCount} 项` +
          (cancelledCount > 0 ? `，停止 ${cancelledCount} 项` : "")
      );
    } else if (cancelledCount > 0) {
      ElMessage.warning(`已停止上传：成功 ${successCount} 项，停止 ${cancelledCount} 项`);
    } else {
      state.progress = 100;
      ElMessage.success(`上传完成：成功 ${successCount} 项`);
    }
  } catch (err) {
    console.error("上传模板失败:", err);
    ElMessage.error("上传模板失败：" + (err as Error).message);
  } finally {
    if (unlisten) unlisten();
    if (stagingDir) {
      await cmdInvoke("delete_paths", { paths: [stagingDir] });
    }
    state.uploading = false;
    state.stopRequested = false;
    state.progressText = "";
  }
};

// 关闭弹窗
const onClose = () => {
  if (state.uploading) return;
  state.dialog.show = false;
};

defineExpose({
  openDialog,
});
</script>

<style scoped lang="scss">
.upload-template-content {
  .source-row {
    display: flex;
    align-items: center;
    gap: 12px;

    .source-label {
      flex: none;
      color: var(--el-text-color-regular);
    }
    .source-summary {
      flex: 1;
      min-width: 0;
      color: var(--el-text-color-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
  .target-summary {
    color: var(--el-text-color-regular);
  }
  .text-success {
    color: var(--el-color-success);
    font-weight: bold;
  }
  .progress-text {
    margin-top: 6px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>

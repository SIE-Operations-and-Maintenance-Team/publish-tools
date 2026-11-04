<template>
  <el-dialog v-model="dialog.visible" title="发布前预检" width="820px" append-to-body destroy-on-close
    class="preflight-dialog">
    <div v-loading="dialog.loading" element-loading-text="正在检查...">
      <div class="preflight-toolbar">
        <div class="preflight-summary">
          <el-tag type="danger" effect="dark" round>错误 {{ report.errorCount }}</el-tag>
          <el-tag type="warning" effect="dark" round>警告 {{ report.warnCount }}</el-tag>
          <span class="preflight-duration">耗时 {{ report.durationMs }}ms</span>
        </div>
        <div class="preflight-actions">
          <el-checkbox v-model="dialog.checkRemoteService" @change="onRefresh">检查远端服务是否存在</el-checkbox>
          <el-button size="small" :disabled="dialog.loading" @click="onRefresh">重新检查</el-button>
        </div>
      </div>
      <el-table :data="report.items" size="small" max-height="430" border>
        <el-table-column label="级别" width="90" align="center">
          <template #default="scope">
            <el-tag :type="levelTagType(scope.row.level)" effect="dark" size="small">
              {{ levelText(scope.row.level) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="检查项" min-width="220" show-overflow-tooltip />
        <el-table-column prop="detail" label="结果" min-width="320" show-overflow-tooltip />
      </el-table>
    </div>
    <template #footer>
      <el-button @click="onClose">关闭</el-button>
      <el-button v-if="dialog.showPublish" type="primary" :disabled="!report.passed || dialog.loading"
        @click="onConfirm">继续发布</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts" name="preflightDialog">
import { reactive, ref } from "vue";
import { useServerDb } from "@/database/servers/index";
import { runPreflight } from "@/utils/preflight";
import type { PreflightLevel, PreflightReport } from "@/utils/preflight";

const serverDb = useServerDb();
const emit = defineEmits<{ (e: "confirm"): void }>();

const dialog = reactive<{
  visible: boolean;
  loading: boolean;
  showPublish: boolean;
  checkRemoteService: boolean;
  appconfig: RowAppconfigType | null;
}>({
  visible: false,
  loading: false,
  showPublish: false,
  checkRemoteService: true,
  appconfig: null,
});

const report = ref<PreflightReport>({
  items: [],
  errorCount: 0,
  warnCount: 0,
  passed: true,
  durationMs: 0,
});

// 按服务器ID解析服务器信息
const resolveServer = async (serverId: number): Promise<RowServerType | null> => {
  const result = await serverDb.getServerById(serverId);
  if (result.code !== 0 || !result.data.data?.id) return null;
  return result.data.data;
};

// 执行预检
const runChecks = async () => {
  if (!dialog.appconfig) return;
  dialog.loading = true;
  try {
    report.value = await runPreflight({
      appconfig: dialog.appconfig,
      resolveServer,
      checkRemoteService: dialog.checkRemoteService,
    });
  } finally {
    dialog.loading = false;
  }
};

// 重新检查
const onRefresh = async () => {
  await runChecks();
};

// 打开弹窗
const openDialog = async (appconfig: RowAppconfigType, showPublish = false) => {
  dialog.appconfig = appconfig;
  dialog.showPublish = showPublish;
  dialog.visible = true;
  await runChecks();
};

// 关闭弹窗
const onClose = () => {
  dialog.visible = false;
};

// 预检通过后继续发布
const onConfirm = () => {
  dialog.visible = false;
  emit("confirm");
};

// 级别对应的标签颜色
const levelTagType = (level: PreflightLevel): "success" | "warning" | "danger" => {
  if (level === "ok") return "success";
  if (level === "warn") return "warning";
  return "danger";
};

// 级别对应的文案
const levelText = (level: PreflightLevel): string => {
  if (level === "ok") return "通过";
  if (level === "warn") return "警告";
  return "错误";
};

defineExpose({ openDialog, runChecks });
</script>

<style scoped lang="scss">
.preflight-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 10px;
  flex-wrap: wrap;

  .preflight-summary {
    display: flex;
    align-items: center;
    gap: 8px;

    .preflight-duration {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .preflight-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
}
</style>

<!-- src/views/appconfig/components/importPreviewDialog.vue -->
<template>
  <el-dialog
    :title="state.dialog.title"
    v-model="state.dialog.show"
    :close-on-click-modal="false"
    width="650px"
    destroy-on-close
  >
    <div class="import-preview-content">
      <el-descriptions :column="2" border size="small" class="mb15">
        <el-descriptions-item label="文件">
          {{ state.fileName }}
        </el-descriptions-item>
        <el-descriptions-item label="导出时间">
          {{ state.exportTime }}
        </el-descriptions-item>
        <el-descriptions-item label="配置数量">
          {{ state.previewItems.length }}
        </el-descriptions-item>
        <el-descriptions-item label="冲突数量">
          <span :class="conflictCount > 0 ? 'text-warning' : 'text-success'">
            {{ conflictCount }}
          </span>
        </el-descriptions-item>
      </el-descriptions>

      <el-table :data="state.previewItems" size="small" max-height="300" stripe>
        <el-table-column type="index" label="序号" width="60" />
        <el-table-column prop="projectCode" label="项目编码" width="140" />
        <el-table-column prop="projectName" label="项目名称" min-width="120" />
        <el-table-column label="环境" width="80">
          <template #default="{ row }">
            {{ displayEnvironment(row.environment) }}
          </template>
        </el-table-column>
        <el-table-column prop="serverCount" label="关联服务器数" width="110" align="center" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.conflict" type="warning" size="small">将被替换</el-tag>
            <el-tag v-else type="success" size="small">新增</el-tag>
          </template>
        </el-table-column>
      </el-table>

      <el-alert
        v-if="conflictCount > 0"
        class="mt15"
        type="warning"
        :closable="false"
        show-icon
      >
        <template #title>
          以下项目编码已存在，导入后将替换其所有关联数据：
          <span class="conflict-codes">{{ conflictCodes }}</span>
        </template>
      </el-alert>

      <el-progress
        v-if="state.importing"
        class="mt15"
        :percentage="state.progress"
        :status="state.progressStatus"
      />
    </div>

    <template #footer>
      <el-button
        @click="onCancel"
        size="default"
        :disabled="state.importing"
      >取 消</el-button>
      <el-button
        type="primary"
        @click="onConfirm"
        size="default"
        :loading="state.importing"
      >确认导入</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts" name="importPreviewDialog">
import { reactive, computed } from "vue";
import { displayEnvironment } from "@/utils/other";

const emit = defineEmits<{
  confirm: [items: ImportPreviewItem[]];
}>();

const state = reactive({
  dialog: {
    show: false,
    title: "导入应用配置预览",
  },
  fileName: "",
  exportTime: "",
  previewItems: [] as ImportPreviewItem[],
  importing: false,
  progress: 0,
  progressStatus: "" as "" | "success" | "exception",
});

const conflictCount = computed(() =>
  state.previewItems.filter((it) => it.conflict).length
);

const conflictCodes = computed(() =>
  state.previewItems
    .filter((it) => it.conflict)
    .map((it) => it.projectCode)
    .join("、")
);

const openDialog = (
  fileName: string,
  exportTime: string,
  previewItems: ImportPreviewItem[]
) => {
  state.dialog.show = true;
  state.fileName = fileName;
  state.exportTime = exportTime;
  state.previewItems = previewItems;
  state.importing = false;
  state.progress = 0;
  state.progressStatus = "";
};

const onCancel = () => {
  state.dialog.show = false;
};

const onConfirm = () => {
  emit("confirm", state.previewItems);
};

const setImporting = (val: boolean) => {
  state.importing = val;
};

const setProgress = (pct: number, status: "" | "success" | "exception" = "") => {
  state.progress = pct;
  state.progressStatus = status;
};

const closeDialog = () => {
  state.dialog.show = false;
};

defineExpose({
  openDialog,
  setImporting,
  setProgress,
  closeDialog,
});
</script>

<style scoped lang="scss">
.import-preview-content {
  .text-warning {
    color: var(--el-color-warning);
    font-weight: bold;
  }
  .text-success {
    color: var(--el-color-success);
  }
  .conflict-codes {
    font-weight: bold;
  }
}
</style>

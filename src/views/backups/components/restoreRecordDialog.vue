<template>
  <div class="record-container">
    <el-dialog
      :title="state.dialog.title"
      v-model="state.dialog.show"
      :close-on-click-modal="false"
      :show-close="false"
      modal-class="record-dialog"
      draggable
      width="900px"
    >
      <el-table
        :data="tableData.data"
        v-loading="tableData.loading"
        style="width: 100%"
        height="400px"
      >
        <el-table-column fixed type="index" label="序号" width="60" />
        <el-table-column prop="restoreDate" label="还原时间" width="180" />
        <el-table-column prop="result" label="结果" width="90">
          <template #default="scope">
            <el-tag type="success" v-if="scope.row.result === 1">成功</el-tag>
            <el-tag type="danger" v-else>失败</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="logContent" label="日志信息" min-width="300">
          <template #default="scope">
            <div class="log-cell">
              <span class="log-preview">{{ truncateText(scope.row.logContent, 80) }}</span>
              <el-button v-if="scope.row.logContent" size="small" text type="primary"
                @click="onViewLog(scope.row)">查看详情</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        @size-change="onHandleSizeChange"
        @current-change="onHandleCurrentChange"
        class="mt15"
        v-model:current-page="tableData.currentPage"
        background
        v-model:page-size="tableData.param.maxResultCount"
        layout="total, sizes, prev, pager, next, jumper"
        :total="tableData.total"
      >
      </el-pagination>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="onCancel" size="default">返 回</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 日志详情弹窗 -->
    <el-dialog title="日志详情" v-model="logDialog.show" :close-on-click-modal="false" destroy-on-close draggable
      width="700px">
      <div class="log-content-wrapper">
        <pre v-if="logDialog.content" class="log-content">{{ logDialog.content }}</pre>
        <span v-else class="log-empty">暂无日志信息</span>
      </div>
      <template #footer>
        <el-button @click="logDialog.show = false" size="default">关 闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="recordDialog">
import { nextTick, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import _ from "lodash";
import { useRestoreDb } from "@/database/restore/index";
import { getDefaultSubObject } from "@/utils/other";

// 定义子组件向父组件传值/事件
const emit = defineEmits(["refresh"]);

// 引入项目管理数据库
const restoreDb = useRestoreDb();

// 日志详情弹窗状态
const logDialog = reactive({
  show: false,
  content: "",
});

// 定义变量内容
const tableData = ref({
  data: [] as RowRestoreType[],
  total: 0,
  loading: false,
  currentPage: 1,
  param: {
    backupId: 0,
    sorting: "id DESC",
    skipCount: 0,
    maxResultCount: 100,
  },
});

const state = reactive<FormDialogType>({
  ruleForm: {},
  dialog: {
    show: false,
    type: "edit",
    editId: null,
    title: "还原记录",
    submitTxt: "还 原",
  },
});

// 截断文本
const truncateText = (text: string | null, maxLen: number): string => {
  if (!text) return "-";
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen) + "...";
};

// 尝试格式化 JSON，失败则返回原始文本
const formatLogContent = (raw: string | null): string => {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
};

// 查看日志详情
const onViewLog = (row: RowRestoreType) => {
  logDialog.content = formatLogContent(row.logContent);
  logDialog.show = true;
};

// 打开弹窗
const openDialog = (row: RowBackupType) => {
  /* Start: 重置表单内容 */
  state.ruleForm = getDefaultSubObject(state.ruleForm);
  state.dialog.editId = null;
  /* End: 重置表单内容 */
  tableData.value.param.backupId = Number(row.id);
  getTableData();
  nextTick(() => {
    state.dialog.show = true;
  });
};

// 关闭弹窗
const closeDialog = () => {
  state.dialog.show = false;
};

// 取消
const onCancel = () => {
  closeDialog();
};

// 初始化表格数据
const getTableData = async () => {
  tableData.value.loading = true;
  tableData.value.param.skipCount =
    (tableData.value.currentPage - 1) * tableData.value.param.maxResultCount;

  let dataResult = await restoreDb.getRestoreList(tableData.value.param);
  if (dataResult.code !== 0) {
    ElMessage.error(dataResult.msg);
    return;
  }
  tableData.value.data = dataResult.data.data;
  tableData.value.total = dataResult.data.total;
  tableData.value.loading = false;
};

// 分页改变时触发
const onHandleSizeChange = (val: number) => {
  tableData.value.param.maxResultCount = val;
  getTableData();
};

// 分页改变时触发
const onHandleCurrentChange = (val: number) => {
  tableData.value.currentPage = val;
  tableData.value.param.skipCount =
    (tableData.value.currentPage - 1) * tableData.value.param.maxResultCount;
  getTableData();
};

// 暴露变量
defineExpose({
  openDialog,
});
</script>
<style lang="scss">
.el-overlay .el-overlay-dialog .el-dialog .el-dialog__body {
  padding: 0px !important;
}
</style>

<style scoped lang="scss">
.log-cell {
  display: flex;
  align-items: center;
  gap: 4px;
}

.log-preview {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.log-content-wrapper {
  max-height: 500px;
  overflow: auto;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
}

.log-content {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: "Courier New", Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #303133;
}

.log-empty {
  color: #909399;
  font-size: 14px;
}
</style>

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
        <el-table-column prop="logContent" label="日志信息" show-overflow-tooltip />
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

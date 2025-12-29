<template>
  <div class="backup-container layout-padding">
    <el-card shadow="hover" class="mb15">
      <div class="backup-search">
        <el-row :gutter="15">
          <el-col :span="6">
            <el-input
              size="default"
              v-model="state.tableData.param.projectName"
              placeholder="请输入项目名称"
              clearable
            >
            </el-input>
          </el-col>
          <el-col :span="6">
            <el-select
              v-model="state.tableData.param.environment"
              placeholder="请选择环境"
              size="default"
            >
              <el-option label="Dev" :value="1" />
              <el-option label="Uat" :value="2" />
              <el-option label="Pro" :value="3" />
              <el-option label="Other" :value="4" />
            </el-select>
          </el-col>
          <el-col :span="8">
            <el-button size="default" type="primary" class="ml10" @click="onSearch">
              <el-icon>
                <ele-Search />
              </el-icon>
              查询
            </el-button>
            <el-button size="default" class="ml10" @click="onReset">
              <el-icon>
                <ele-RefreshLeft />
              </el-icon>
              重置
            </el-button>
          </el-col>
        </el-row>
      </div>
    </el-card>
    <el-card shadow="hover" class="layout-padding-auto">
      <el-table
        :data="state.tableData.data"
        v-loading="state.tableData.loading"
        style="width: 100%"
      >
        <el-table-column fixed type="index" label="序号" width="60" />
        <el-table-column prop="projectName" label="项目名称" width="200" />
        <el-table-column prop="environment" label="项目环境" width="90">
          <template #default="scope">
            {{ displayEnvironment(scope.row.environment) }}
          </template>
        </el-table-column>
        <el-table-column prop="backupDate" label="备份时间" width="175" />
        <el-table-column
          prop="remark"
          label="备注"
          min-width="200"
          show-overflow-tooltip
        />
        <el-table-column label="操作" width="190" fixed="right">
          <template #default="scope">
            <el-button
              size="small"
              text
              type="info"
              @click="onOpenViewerBackup(scope.row)"
              :disabled="!scope.row.projectId"
              >查看</el-button
            >
            <el-button size="small" text type="primary" @click="onRestore(scope.row)"
              >还原</el-button
            >
            <el-button size="small" text type="warning" @click="onRecord(scope.row)"
              >还原记录</el-button
            >
            <el-button size="small" text type="danger" @click="onRowDel(scope.row)"
              >删除</el-button
            >
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        @size-change="onHandleSizeChange"
        @current-change="onHandleCurrentChange"
        class="mt15"
        v-model:current-page="state.tableData.currentPage"
        background
        v-model:page-size="state.tableData.param.maxResultCount"
        layout="total, sizes, prev, pager, next, jumper"
        :total="state.tableData.total"
      >
      </el-pagination>
    </el-card>
    <backup-dialog ref="backupDialogRef" @refresh="getTableData()" />
    <restore-dialog ref="restoreDialogRef" @refresh="getTableData()" />
    <restore-remote-dialog ref="restoreRemoteDialogRef" @refresh="getTableData()" />
    <restore-local-dialog ref="restoreLocalDialogRef" @refresh="getTableData()" />
    <restore-record-dialog ref="restoreRecordDialogRef" />
  </div>
</template>

<script setup lang="ts" name="backups">
import { ref, reactive, onBeforeMount, defineAsyncComponent } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import _ from "lodash";
import { useBackupDb } from "@/database/backups/index";
import { displayEnvironment } from "@/utils/other";

// 引入备份管理数据库
const backupDb = useBackupDb();

// 引入组件
const backupDialogRef = ref();
const restoreDialogRef = ref();
const restoreRemoteDialogRef = ref();
const restoreLocalDialogRef = ref();
const restoreRecordDialogRef = ref();
const BackupDialog = defineAsyncComponent(
  () => import("@/views/backups/components/backupDialog.vue")
);
const RestoreDialog = defineAsyncComponent(
  () => import("@/views/backups/components/restoreDialog.vue")
);
const RestoreRemoteDialog = defineAsyncComponent(
  () => import("@/views/backups/components/restoreRemoteDialog.vue")
);
const RestoreLocalDialog = defineAsyncComponent(
  () => import("@/views/backups/components/restoreLocalDialog.vue")
);
const RestoreRecordDialog = defineAsyncComponent(
  () => import("@/views/backups/components/restoreRecordDialog.vue")
);

// 备份管理状态
const state = reactive<BackupState>({
  tableData: {
    data: [],
    total: 0,
    loading: false,
    currentPage: 1,
    param: {
      projectName: null,
      environment: null,
      sorting: "backup_date desc",
      skipCount: 0,
      maxResultCount: 10,
    },
  },
});

// 搜索
const onSearch = () => {
  state.tableData.currentPage = 1;
  getTableData();
};

// 重置
const onReset = () => {
  state.tableData.param.projectName = null;
  state.tableData.param.environment = null;
};

// 初始化表格数据
const getTableData = async () => {
  state.tableData.loading = true;
  state.tableData.param.skipCount =
    (state.tableData.currentPage - 1) * state.tableData.param.maxResultCount;

  let dataResult = await backupDb.getBackupList(state.tableData.param);
  if (dataResult.code !== 0) {
    ElMessage.error(dataResult.msg);
    return;
  }
  state.tableData.data = dataResult.data.data;
  state.tableData.total = dataResult.data.total;
  state.tableData.loading = false;
};

// 分页改变时触发
const onHandleSizeChange = (val: number) => {
  state.tableData.param.maxResultCount = val;
  getTableData();
};

// 分页改变时触发
const onHandleCurrentChange = (val: number) => {
  state.tableData.currentPage = val;
  state.tableData.param.skipCount =
    (state.tableData.currentPage - 1) * state.tableData.param.maxResultCount;
  getTableData();
};

// 打开预览改备份弹窗
const onOpenViewerBackup = (row: RowBackupType) => {
  backupDialogRef.value.openDialog("viewer", row);
};

// 还原备份
const onRestore = async (row: RowBackupType) => {
  if (!row.projectId && row.remark == "PAPERS_REMOTE_PUBLISH") {
    restoreRemoteDialogRef.value.openDialog(row.id, JSON.parse(row.backupItemsJson));
  } else if (!row.projectId && row.remark == "PAPERS_LOCAL_PUBLISH") {
    restoreLocalDialogRef.value.openDialog(row.id, JSON.parse(row.backupItemsJson));
  } else {
    restoreDialogRef.value.openDialog(row);
  }
};

// 还原记录
const onRecord = async (row: RowBackupType) => {
  restoreRecordDialogRef.value.openDialog(row);
};

// 删除备份
const onRowDel = (row: RowBackupType) => {
  ElMessageBox.confirm("您确认删除该备份记录吗？", "提示", {
    confirmButtonText: "确认",
    cancelButtonText: "取消",
    type: "warning",
  }).then(async () => {
    const dataResult = await backupDb.deleteBackup(Number(row.id));
    if (dataResult.code !== 0) {
      ElMessage.error(dataResult.msg);
      return;
    }
    await getTableData();
    ElMessage.success("删除成功");
  });
};

onBeforeMount(async () => {
  await getTableData();
});
</script>

<style scoped lang="scss">
.backup-container {
  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: auto;
    .el-table {
      flex: 1;
    }
  }
}
</style>

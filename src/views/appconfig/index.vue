<template>
  <div class="appconfig-container layout-padding">
    <el-card shadow="hover" class="mb15">
      <div class="appconfig-search">
        <el-row :gutter="15">
          <el-col :span="6">
            <el-select
              filterable
              placeholder="请选择项目管理"
              size="default"
              v-model="state.tableData.param.projectId"
            >
              <el-option
                v-for="project in projectList"
                :key="project.id"
                :label="project.name"
                :value="project.id"
              />
            </el-select>
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
      <template #header>
        <el-button size="default" type="success" @click="onOpenAppconfigDialog('add')">
          <el-icon>
            <ele-Plus />
          </el-icon>
          新增
        </el-button>
      </template>
      <el-table
        :data="state.tableData.data"
        v-loading="state.tableData.loading"
        style="width: 100%"
      >
        <el-table-column fixed type="index" label="序号" width="60" />
        <el-table-column prop="projectName" label="项目名称" width="200" />
        <el-table-column prop="environment" label="环境" width="90">
          <template #default="scope">
            {{ displayEnvironment(scope.row.environment) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="dllMode"
          label="获取dll方式"
          min-width="100"
          show-overflow-tooltip
        />
        <el-table-column
          prop="buildMode"
          label="获取模式"
          width="100"
          show-overflow-tooltip
        />
        <el-table-column
          prop="msBuildPath"
          label="MsBuild路径"
          min-width="240"
          show-overflow-tooltip
        />
        <el-table-column label="操作" width="190" fixed="right">
          <template #default="scope">
            <el-button
              size="small"
              text
              type="success"
              @click="onCopyAppconfig(scope.row)"
              >复制新增</el-button
            >
            <el-button
              size="small"
              text
              type="info"
              @click="onOpenAppconfigDialog('viewer', scope.row)"
              >查看</el-button
            >
            <!--
            <el-button size="small" text type="primary" @click="onBackup(scope.row)"
              >备份</el-button
            >
            -->
            <el-button
              size="small"
              text
              type="warning"
              @click="onOpenAppconfigDialog('edit', scope.row)"
              >修改</el-button
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
    <appconfig-dialog ref="appconfigDialogRef" @refresh="getTableData()" />
    <backup-dialog ref="backupDialogRef" />
  </div>
</template>

<script setup lang="ts" name="smomAppconfig">
import { ref, reactive, onBeforeMount, onMounted, defineAsyncComponent } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import _ from "lodash";
import { useProjectDb } from "@/database/project/index";
import { useAppconfigDb } from "@/database/appconfig/index";
import { displayEnvironment } from "@/utils/other";
// import { loadBackupItems } from "@/utils/backupAppconfig";

// 引入应用配置数据库
const appconfigDb = useAppconfigDb();
const projectDb = useProjectDb();

// 引入组件
const appconfigDialogRef = ref();
const AppconfigDialog = defineAsyncComponent(
  () => import("@/views/appconfig/components/appconfigDialog.vue")
);
const backupDialogRef = ref();
const BackupDialog = defineAsyncComponent(
  () => import("@/views/backups/components/backupDialog.vue")
);

// 项目信息
const projectList = ref<RowProjectType[]>();
// 应用配置状态
const state = reactive<AppconfigState>({
  tableData: {
    data: [],
    total: 0,
    loading: false,
    currentPage: 1,
    param: {
      projectId: null,
      environment: null,
      sorting: "ta.id DESC",
      skipCount: 0,
      maxResultCount: 10,
    },
  },
});

// 查询项目信息
const getProjectList = async () => {
  let dataResult = await projectDb.getProjectList({
    code: null,
    name: null,
    sorting: "id DESC",
    skipCount: 0,
    maxResultCount: 1000,
  });
  if (dataResult.code !== 0) {
    ElMessage.error(dataResult.msg);
    return;
  }
  projectList.value = dataResult.data.data;
};

// 搜索
const onSearch = async () => {
  state.tableData.currentPage = 1;
  await getTableData();
};

// 重置
const onReset = async () => {
  state.tableData.param.projectId = null;
  state.tableData.param.environment = null;
  await getProjectList();
};

// 初始化表格数据
const getTableData = async () => {
  state.tableData.loading = true;
  state.tableData.param.skipCount =
    (state.tableData.currentPage - 1) * state.tableData.param.maxResultCount;

  let dataResult = await appconfigDb.getAppconfigList(state.tableData.param);
  if (dataResult.code !== 0) {
    ElMessage.error(dataResult.msg);
    return;
  }
  state.tableData.data = dataResult.data.data;
  state.tableData.total = dataResult.data.total;
  state.tableData.loading = false;
};

// 分页改变时触发
const onHandleSizeChange = async (val: number) => {
  state.tableData.param.maxResultCount = val;
  await getTableData();
};

// 分页改变时触发
const onHandleCurrentChange = async (val: number) => {
  state.tableData.currentPage = val;
  state.tableData.param.skipCount =
    (state.tableData.currentPage - 1) * state.tableData.param.maxResultCount;
  await getTableData();
};

// 打开应用配置弹窗
const onOpenAppconfigDialog = (type: string, row: any = null) => {
  appconfigDialogRef.value.openDialog(type, row);
};

// 复制新增
const onCopyAppconfig = async (row: RowAppconfigType) => {
  const newRow = _.cloneDeep(row);
  newRow.projectId = null;
  let insertResult = await appconfigDb.insertAppconfig(newRow);
  if (insertResult.code === 0) {
    ElMessage.success("复制成功！");
    await getTableData();
  } else {
    ElMessage.error(insertResult.msg);
  }
};

// 备份
// const onBackup = async (row: RowAppconfigType) => {
//   if (!row.id) return;
//   var backupData = await loadBackupItems(row.id);
//   backupDialogRef.value.openDialog("add", backupData);
// };

// 删除项目
const onRowDel = (row: RowAppconfigType) => {
  ElMessageBox.confirm(
    `此操作将永久删除应用配置：“${row.projectName}-${displayEnvironment(
      Number(row.environment)
    )}”，是否确认?`,
    "提示",
    {
      confirmButtonText: "确认",
      cancelButtonText: "取消",
      type: "warning",
    }
  ).then(async () => {
    let dataResult = await appconfigDb.deleteAppconfig(Number(row.id));
    if (dataResult.code !== 0) {
      ElMessage.error(dataResult.msg);
      return;
    }
    await getTableData();
    ElMessage.success("删除成功");
  });
};

onBeforeMount(async () => {
  await getProjectList();
});

onMounted(async () => {
  await getTableData();
});
</script>

<style scoped lang="scss">
.appconfig-container {
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

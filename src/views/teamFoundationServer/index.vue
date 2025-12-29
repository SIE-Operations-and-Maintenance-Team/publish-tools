<template>
  <div class="tfs-container layout-padding">
    <el-card shadow="hover" class="mb15">
      <div class="tfs-search">
        <el-row :gutter="15">
          <el-col :span="6">
            <el-input size="default" v-model="state.tableData.param.tfsName" placeholder="请输入TFS名称" clearable>
            </el-input>
          </el-col>
          <el-col :span="6">
            <el-input size="default" v-model="state.tableData.param.tfsSourcePath" placeholder="请输入源位置" clearable>
            </el-input>
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
        <el-button size="default" type="success" @click="onOpenTfs('add', null)">
          <el-icon>
            <ele-Plus />
          </el-icon>
          新增
        </el-button>
      </template>
      <el-table :data="state.tableData.data" v-loading="state.tableData.loading" style="width: 100%">
        <el-table-column fixed type="index" label="序号" width="60" />
        <el-table-column prop="tfsName" label="TFS名称" width="180" />
        <el-table-column prop="tfsServerUrl" label="服务地址" show-overflow-tooltip width="300" />
        <el-table-column prop="tfsSourcePath" label="源位置" show-overflow-tooltip width="240" />
        <el-table-column prop="tfvcPath" label="TFVC工具" show-overflow-tooltip width="350" />
        <el-table-column prop="remark" min-width="240" label="备注" show-overflow-tooltip />
        <el-table-column label="操作" width="275" fixed="right">
          <template #default="scope">
            <el-button size="small" text type="success" @click="onCopyTfs(scope.row)">复制新增</el-button>
            <el-button size="small" text type="primary" @click="onOpenTfsHistory('viewer', scope.row)">查询记录</el-button>
            <el-button size="small" text type="info" @click="onOpenTfsLog('viewer', scope.row)">生成日志</el-button>
            <el-button size="small" text type="warning" @click="onOpenTfs('edit', scope.row)">修改</el-button>
            <el-button size="small" text type="danger" @click="onRowDel(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination @size-change="onHandleSizeChange" @current-change="onHandleCurrentChange" class="mt15"
        v-model:current-page="state.tableData.currentPage" background
        v-model:page-size="state.tableData.param.maxResultCount" layout="total, sizes, prev, pager, next, jumper"
        :total="state.tableData.total">
      </el-pagination>
    </el-card>
    <el-dialog v-model="showTfsTip.show" title="提示" width="500" center>
      <span>
        TFS(Team Foundation Server)依赖于 Visual Studio，请确保在Visual Studio
        2013或更高版本中安装了TFS并且处于登录状态。</span>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="notShowTfsTip()">不在提示</el-button>
          <el-button type="primary" @click="showTfsTip.show = false">知道了</el-button>
        </div>
      </template>
    </el-dialog>
    <tfs-dialog ref="tfsDialogRef" @refresh="getTableData()" />
    <history-dialog ref="historyDialogRef" />
    <tfs-log-dialog ref="tfsLogDialogRef" />
  </div>
</template>

<script setup lang="ts" name="teamFoundationServer">
import { ref, reactive, onBeforeMount, defineAsyncComponent, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import _ from "lodash";
import { useTfsDb } from "@/database/teamFoundationServer/index";
import { Local } from "@/utils/storage";

// 引入TFS数据库
const tfsDb = useTfsDb();

// 引入组件
const tfsDialogRef = ref();
const historyDialogRef = ref();
const tfsLogDialogRef = ref();
const showTfsTip = ref({
  show: false,
  key: "NOT_SHOW_TFS_TIP",
});
const TfsDialog = defineAsyncComponent(
  () => import("@/views/teamFoundationServer/components/tfsDialog.vue")
);
const HistoryDialog = defineAsyncComponent(
  () => import("@/views/teamFoundationServer/components/historyDialog.vue")
);
const TfsLogDialog = defineAsyncComponent(
  () => import("@/views/teamFoundationServer/components/tfsLogDialog.vue")
);

// TFS状态
const state = reactive<TfsState>({
  tableData: {
    data: [],
    total: 0,
    loading: false,
    currentPage: 1,
    param: {
      tfsName: null,
      tfsSourcePath: null,
      sorting: "id DESC",
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
  state.tableData.param.tfsName = null;
  state.tableData.param.tfsSourcePath = null;
};

// 初始化表格数据
const getTableData = async () => {
  state.tableData.loading = true;
  state.tableData.param.skipCount =
    (state.tableData.currentPage - 1) * state.tableData.param.maxResultCount;

  let dataResult = await tfsDb.getTfsList(state.tableData.param);
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

// 复制TFS新增或编辑弹窗
const onCopyTfs = async (row: any) => {
  const newRow = _.cloneDeep(row);
  newRow.tfsName = `${newRow.tfsName}-复制`;
  let insertResult = await tfsDb.insertTfs(newRow);
  if (insertResult.code === 0) {
    ElMessage.success("添加成功！");
    await getTableData();
  } else {
    ElMessage.error(insertResult.msg);
  }
};

// 打开TFS查询记录弹窗
const onOpenTfsHistory = (type: string, row: any) => {
  historyDialogRef.value.openDialog(type, row);
};

// 打开TFS查询记录弹窗
const onOpenTfsLog = (type: string, row: any) => {
  tfsLogDialogRef.value.openDialog(type, row);
};

// 打开TFS操作弹窗
const onOpenTfs = (type: string, row: any) => {
  tfsDialogRef.value.openDialog(type, row);
};

// 删除备份
const onRowDel = (row: RowTfsType) => {
  ElMessageBox.confirm("您确认删除该备份记录吗？", "提示", {
    confirmButtonText: "确认",
    cancelButtonText: "取消",
    type: "warning",
  }).then(async () => {
    const dataResult = await tfsDb.deleteTfs(Number(row.id));
    if (dataResult.code !== 0) {
      ElMessage.error(dataResult.msg);
      return;
    }
    await getTableData();
    ElMessage.success("删除成功");
  });
};

// 不在提示
const notShowTfsTip = () => {
  showTfsTip.value.show = false;
  Local.set(showTfsTip.value.key, true);
};

onBeforeMount(async () => {
  await getTableData();
});

onMounted(() => {
  const isShowTfsTip = Local.get(showTfsTip.value.key);
  if (!isShowTfsTip) {
    showTfsTip.value.show = true;
  }
});
</script>

<style scoped lang="scss">
.tfs-container {
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

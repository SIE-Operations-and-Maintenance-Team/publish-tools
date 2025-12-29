<template>
  <div class="git-container layout-padding">
    <el-card shadow="hover" class="mb15">
      <div class="git-search">
        <el-row :gutter="15">
          <el-col :span="6">
            <el-input size="default" v-model="state.tableData.param.gitName" placeholder="请输入Git名称" clearable>
            </el-input>
          </el-col>
          <el-col :span="6">
            <el-input size="default" v-model="state.tableData.param.gitRepository" placeholder="请输入本地.git目录" clearable>
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
        <el-button size="default" type="success" @click="onOpenGit('add', null)">
          <el-icon>
            <ele-Plus />
          </el-icon>
          新增
        </el-button>
      </template>
      <el-table :data="state.tableData.data" v-loading="state.tableData.loading" style="width: 100%">
        <el-table-column fixed type="index" label="序号" width="60" />
        <el-table-column prop="gitName" label="Git名称" width="150" />
        <el-table-column prop="gitRepository" label=".git目录" show-overflow-tooltip width="300" />
        <el-table-column prop="gitPath" label="Git工具" show-overflow-tooltip width="300" />
        <el-table-column prop="remark" min-width="200" label="备注" show-overflow-tooltip />
        <el-table-column label="操作" width="310" fixed="right">
          <template #default="scope">
            <el-button size="small" text type="success" @click="onCopyGit(scope.row)">复制新增</el-button>
            <el-button size="small" text type="primary" @click="onOpenGitHistory('viewer', scope.row)">查询记录</el-button>
            <el-button size="small" text type="info" @click="onOpenGitLog('viewer', scope.row)">生成日志</el-button>
            <el-button size="small" text type="warning" @click="onOpenGit('edit', scope.row)">修改</el-button>
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
    <git-dialog ref="gitDialogRef" @refresh="getTableData()" />
    <history-dialog ref="historyDialogRef" />
    <git-log-dialog ref="gitLogDialogRef" />
  </div>
</template>

<script setup lang="ts" name="git">
import { ref, reactive, onBeforeMount, defineAsyncComponent } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import _ from "lodash";
import { useGitDb } from "@/database/git/index";

// 引入Git数据库
const gitDb = useGitDb();

// 引入组件
const gitDialogRef = ref();
const historyDialogRef = ref();
const gitLogDialogRef = ref();
const GitDialog = defineAsyncComponent(
  () => import("@/views/git/components/gitDialog.vue")
);
const HistoryDialog = defineAsyncComponent(
  () => import("@/views/git/components/historyDialog.vue")
);
const GitLogDialog = defineAsyncComponent(
  () => import("@/views/git/components/gitLogDialog.vue")
);

// Git状态
const state = reactive<GitState>({
  tableData: {
    data: [],
    total: 0,
    loading: false,
    currentPage: 1,
    param: {
      gitName: null,
      gitRepository: null,
      maxResultCount: 20,
      skipCount: 0,
    },
  },
});

// 初始化表格数据
const getTableData = async () => {
  state.tableData.loading = true;
  state.tableData.param.skipCount = (state.tableData.currentPage - 1) * state.tableData.param.maxResultCount;

  try {
    const result = await gitDb.getGit(state.tableData.param);
    if (result.code === 0) {
      state.tableData.data = result.data.data;
      state.tableData.total = result.data.total;
    } else {
      ElMessage.error(result.msg);
    }
  } catch (error) {
    console.error('获取Git数据失败:', error);
    ElMessage.error('获取Git数据失败: ' + (error as Error).message);
  } finally {
    state.tableData.loading = false;
  }
};

// 分页
const onHandleSizeChange = (val: number) => {
  state.tableData.param.maxResultCount = val;
  getTableData();
};

const onHandleCurrentChange = (val: number) => {
  state.tableData.currentPage = val;
  getTableData();
};

// 查询
const onSearch = () => {
  state.tableData.currentPage = 1;
  getTableData();
};

// 重置
const onReset = () => {
  state.tableData.param.gitName = null;
  state.tableData.param.gitRepository = null;
  state.tableData.currentPage = 1;
  getTableData();
};


// 打开Git历史对话框
const onOpenGitHistory = (type: string, row: RowGitType) => {
  historyDialogRef.value.openDialog(type, row);
};

// 打开Git日志对话框
const onOpenGitLog = (type: string, row: RowGitType) => {
  gitLogDialogRef.value.openDialog(type, row);
};

// 复制Git新增
const onCopyGit = async (row: any) => {
  const newRow = _.cloneDeep(row);
  newRow.id = void 0;
  newRow.gitName = `${newRow.gitName}-复制`;
  let insertResult = await gitDb.insertGit(newRow);
  if (insertResult.code === 0) {
    ElMessage.success("复制成功！");
    await getTableData();
  } else {
    ElMessage.error(insertResult.msg);
  }
};

// 打开Git操作弹窗
const onOpenGit = (type: string, row: any) => {
  gitDialogRef.value.openDialog(type, row);
};

// 删除Git
const onRowDel = (row: RowGitType) => {
  ElMessageBox.confirm(`此操作将永久删除Git "${row.gitName}"，是否继续？`, '提示', {
    confirmButtonText: '确认',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(async () => {
      try {
        const result = await gitDb.deleteGit(row.id!);
        if (result.code === 0) {
          ElMessage.success('删除成功');
          getTableData();
        } else {
          ElMessage.error(result.msg);
        }
      } catch (error) {
        console.error('删除Git失败:', error);
        ElMessage.error('删除Git失败: ' + (error as Error).message);
      }
    })
    .catch(() => { });
};

// 页面加载时获取数据
onBeforeMount(() => {
  getTableData();
});

// 定义类型
interface GitState {
  tableData: {
    data: RowGitType[];
    total: number;
    loading: boolean;
    currentPage: number;
    param: {
      gitName: string | null;
      gitRepository: string | null;
      maxResultCount: number;
      skipCount: number;
    };
  };
}

interface RowGitType {
  id: number | null;
  gitName: string | null;
  gitRepository: string | null;
  gitPath: string | null;
  branchName: string | null;
  remark: string | null;
}
</script>

<style scoped lang="scss">
.git-container {
  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: auto;
    .el-table {
      flex: 1;
    }
  }
  .layout-padding {
    padding: 15px;
  }
}
</style>
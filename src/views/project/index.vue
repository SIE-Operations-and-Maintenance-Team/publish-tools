<template>
  <div class="project-container layout-padding">
    <el-card shadow="hover" class="mb15">
      <div class="project-search">
        <el-row :gutter="15">
          <el-col :span="6">
            <el-input
              size="default"
              v-model="state.tableData.param.code"
              placeholder="请输入项目编码"
              clearable
            >
            </el-input>
          </el-col>
          <el-col :span="6">
            <el-input
              size="default"
              v-model="state.tableData.param.name"
              placeholder="请输入项目名称"
              clearable
            >
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
        <el-button size="default" type="success" @click="onOpenAddProject('add')">
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
        <el-table-column prop="code" label="项目编码" width="100" />
        <el-table-column prop="name" label="项目名称" width="200" />
        <el-table-column
          prop="isDefault"
          label="是否默认"
          show-overflow-tooltip
          width="100"
        >
          <template #default="scope">
            <el-switch
              v-model="scope.row.isDefault"
              :active-value="1"
              :inactive-value="0"
              inline-prompt
              active-text="是"
              inactive-text="否"
              size="default"
              @change="onIsDefault($event, scope.row)"
            />
          </template>
        </el-table-column>
        <el-table-column
          prop="assemblyOutPath"
          label="程序集输出路径"
          min-width="300"
          show-overflow-tooltip
        />
        <el-table-column
          prop="description"
          label="描述"
          min-width="200"
          show-overflow-tooltip
        />
        <el-table-column label="操作" width="155" fixed="right">
          <template #default="scope">
            <el-button size="small" text type="success" @click="onCopyProject(scope.row)"
              >复制新增</el-button
            >
            <el-button
              size="small"
              text
              type="warning"
              @click="onOpenEditProject('edit', scope.row)"
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
    <project-dialog ref="projectDialogRef" @refresh="getTableData()" />
  </div>
</template>

<script setup lang="ts" name="smomProject">
import { ref, reactive, onBeforeMount, defineAsyncComponent } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import _ from "lodash";
import { useProjectDb } from "@/database/project/index";

// 引入项目管理数据库
const projectDb = useProjectDb();

// 引入组件
const projectDialogRef = ref();
const ProjectDialog = defineAsyncComponent(
  () => import("@/views/project/components/projectDialog.vue")
);

// 项目管理状态
const state = reactive<ProjectState>({
  tableData: {
    data: [],
    total: 0,
    loading: false,
    currentPage: 1,
    param: {
      code: null,
      name: null,
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
  state.tableData.param.code = null;
  state.tableData.param.name = null;
};

// 初始化表格数据
const getTableData = async () => {
  state.tableData.loading = true;
  state.tableData.param.skipCount =
    (state.tableData.currentPage - 1) * state.tableData.param.maxResultCount;

  let dataResult = await projectDb.getProjectList(state.tableData.param);
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

// 打开新增项目弹窗
const onOpenAddProject = (type: string) => {
  projectDialogRef.value.openDialog(type);
};

// 打开修改项目弹窗
const onOpenEditProject = (type: string, row: RowProjectType) => {
  projectDialogRef.value.openDialog(type, row);
};

// 复制新增项目
const onCopyProject = async (row: RowProjectType) => {
  const newRow = _.cloneDeep(row);
  newRow.code = `${newRow.code}-复制`;
  newRow.name = `${newRow.name}-复制`;
  let insertResult = await projectDb.insertProject(newRow);
  if (insertResult.code === 0) {
    ElMessage.success("复制成功！");
    await getTableData();
  } else {
    ElMessage.error(insertResult.msg);
  }
};

// 删除项目
const onRowDel = (row: RowProjectType) => {
  ElMessageBox.confirm(`此操作将永久删除项目名称：“${row.name}”，是否确认?`, "提示", {
    confirmButtonText: "确认",
    cancelButtonText: "取消",
    type: "warning",
  }).then(async () => {
    const dataResult = await projectDb.deleteProject(Number(row.id));
    if (dataResult.code !== 0) {
      ElMessage.error(dataResult.msg);
      return;
    }
    await getTableData();
    ElMessage.success("删除成功");
  });
};

// 修改是否默认
const onIsDefault = async (val: number, project: RowProjectType) => {
  let updateIsDefaultResult = await projectDb.updateProjectIsDefault(
    Number(project.id),
    val
  );
  if (updateIsDefaultResult.code !== 0) {
    ElMessage.error(updateIsDefaultResult.msg);
    project.isDefault = val == 1 ? 0 : 1;
    return;
  }
  onSearch();
};

onBeforeMount(async () => {
  await getTableData();
});
</script>

<style scoped lang="scss">
.project-container {
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

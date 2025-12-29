<template>
  <div class="server-container layout-padding">
    <el-card shadow="hover" class="mb15">
      <div class="server-search">
        <el-row :gutter="15">
          <el-col :span="6">
            <el-input
              size="default"
              v-model="state.tableData.param.name"
              placeholder="请输入服务器名称"
              clearable
            >
            </el-input>
          </el-col>
          <el-col :span="6">
            <el-select
              filterable
              placeholder="请选择所属项目"
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
        <el-button size="default" type="success" @click="onOpenAddServer('add')">
          <el-icon>
            <ele-Plus />
          </el-icon>
          新增
        </el-button>
        <el-button size="default" @click="onOpenSSH()">
          SSH安装&nbsp;&nbsp;
          <el-icon>
            <QuestionFilled />
          </el-icon>
        </el-button>
      </template>
      <el-table
        :data="state.tableData.data"
        v-loading="state.tableData.loading"
        style="width: 100%"
      >
        <el-table-column fixed type="index" label="序号" width="60" />
        <el-table-column prop="name" label="服务器名称" width="200" />
        <el-table-column prop="os" label="服务环境" width="100">
          <template #default="scope">
            {{ displayOs(scope.row.os) }}
          </template>
        </el-table-column>
        <el-table-column prop="ip" label="IP地址" width="150" />
        <el-table-column prop="port" label="SSH端口" width="120" />
        <el-table-column prop="account" label="登录账户" width="120" />
        <!-- <el-table-column prop="pwd" label="登录密码" width="120" /> -->
        <el-table-column prop="projectName" label="所属项目名称" width="200" />
        <el-table-column
          prop="description"
          label="描述"
          min-width="260"
          show-overflow-tooltip
        />
        <el-table-column label="操作" width="275" fixed="right">
          <template #default="scope">
            <el-button size="small" text type="success" @click="onCopyServer(scope.row)"
              >复制新增</el-button
            >
            <el-button
              size="small"
              text
              type="primary"
              :loading="scope.row.loading === true"
              @click="onTestConnect(scope.row)"
              >{{ !scope.row.loading ? "测试连接" : "连接中" }}</el-button
            >
            <el-button size="small" text type="info" @click="onInvokeCommand(scope.row)"
              >执行命令</el-button
            >
            <el-button
              size="small"
              text
              type="warning"
              @click="onOpenEditServer('edit', scope.row)"
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
    <server-dialog ref="serverDialogRef" @refresh="getTableData()" />
  </div>
</template>

<script setup lang="ts" name="server">
import { ref, reactive, onBeforeMount, onMounted, defineAsyncComponent } from "vue";
import { useRouter } from "vue-router";
import { cmdInvoke } from "@/utils/command";
import { ElMessage, ElMessageBox, ElLoading } from "element-plus";
import { QuestionFilled } from "@element-plus/icons-vue";
import _ from "lodash";
import { useProjectDb } from "@/database/project/index";
import { useServerDb } from "@/database/servers/index";
import { displayOs } from "@/utils/other";

// 引入服务器数据库
const serverDb = useServerDb();
const projectDb = useProjectDb();

// 引入组件
const router = useRouter();
const serverDialogRef = ref();
const ServerDialog = defineAsyncComponent(
  () => import("@/views/servers/components/serverDialog.vue")
);

// 项目信息
const projectList = ref<RowProjectType[]>();
// 服务器状态
const state = reactive<ServerState>({
  tableData: {
    data: [],
    total: 0,
    loading: false,
    currentPage: 1,
    param: {
      projectId: null,
      name: null,
      sorting: "ts.id DESC",
      skipCount: 0,
      maxResultCount: 10,
    },
  },
});

// 测试连接
const onTestConnect = async (row: RowServerType) => {
  // const loading = ElLoading.service({
  //   lock: true,
  //   text: "正在连接，请稍等...",
  //   background: "rgba(0, 0, 0, 0)",
  // });
  row.loading = true;
  const serverConnectionResult = await cmdInvoke("server_connection", {
    username: row.account,
    password: row.pwd,
    server: `${row.ip}:${row.port}`,
  });
  row.loading = false;
  if (serverConnectionResult.code !== 0) {
    ElMessageBox.alert(`【${row.ip}】${serverConnectionResult.data}`, "异常", {
      confirmButtonText: "知道了",
    });
    return false;
  }

  // 验证服务器是否安装zip/tar命令
  const serverOs = displayOs(row.os);
  let validationResult = false;
  if (serverOs === "Windows") {
    validationResult = await validateWinTar(row);
  } else if (serverOs === "Docker") {
    validationResult = await validateLinuxZip(row);
  }
  if (!validationResult) {
    return false;
  }

  ElMessage.success(`【${row.ip}】连接成功！`);
  return true;
};

// 验证Linux服务器是否安装zip命令
const validateLinuxZip = async (server: RowServerType) => {
  const execTarResult = await cmdInvoke("execute_remote_command", {
    username: server.account,
    password: server.pwd,
    server: `${server.ip}:${server.port}`,
    command: `zip --version`,
  });
  if (execTarResult.code !== 0) {
    ElMessageBox.alert(
      "该服务器未检查到zip命令，建议安装(否则会影响备份/还原功能的正常使用)：<a href='https://www.rpmfind.net/linux/rpm2html/search.php?query=zip&submit=Search+...&system=&arch=' target='_blank'>Zip</a> 。",
      "异常",
      {
        confirmButtonText: "知道了",
        dangerouslyUseHTMLString: true,
      }
    );
    return false;
  }
  return true;
};

// 验证Windows服务器是否安装tar命令
const validateWinTar = async (server: RowServerType) => {
  const execTarResult = await cmdInvoke("execute_remote_command", {
    username: server.account,
    password: server.pwd,
    server: `${server.ip}:${server.port}`,
    command: `tar --version`,
  });
  if (execTarResult.code !== 0) {
    ElMessageBox.alert(
      "该服务器未检查到tar命令，建议安装(否则会影响备份/还原功能的正常使用)：<a href='https://cygwin.com/install.html' target='_blank'>Cygwin</a> 。",
      "异常",
      {
        confirmButtonText: "知道了",
        dangerouslyUseHTMLString: true,
      }
    );
    return false;
  }
  return true;
};

// 复制新增服务器
const onCopyServer = async (row: RowServerType) => {
  const newRow = _.cloneDeep(row);
  newRow.name = `${newRow.name}-复制`;
  let insertResult = await serverDb.insertServer(newRow);
  if (insertResult.code === 0) {
    ElMessage.success("添加成功！");
    await getTableData();
  } else {
    ElMessage.error(insertResult.msg);
  }
};

// 执行命令
const onInvokeCommand = (row: RowServerType) => {
  ElMessageBox.prompt("请输入要执行的命令", "远程命令", {
    confirmButtonText: "执行",
    cancelButtonText: "取消",
  })
    .then(async ({ value }) => {
      if (!value) {
        ElMessage.info("未输入要执行的命令，已自动取消！");
        return false;
      }
      const loading = ElLoading.service({
        lock: true,
        text: "正在执行命令，请稍等...",
        background: "rgba(0, 0, 0, 0)",
      });
      const execRemoteCmdResult = await cmdInvoke("execute_remote_command", {
        username: row.account,
        password: row.pwd,
        server: `${row.ip}:${row.port}`,
        command: value,
      });
      loading.close();
      if (execRemoteCmdResult.code === 0) {
        ElMessage.success("执行成功！");
        return;
      }
      ElMessageBox.alert(execRemoteCmdResult.data, "执行异常", {
        confirmButtonText: "知道了",
      });
    })
    .catch(() => {
      console.warn("已取消");
    });
};

// 查询项目信息
const getProjectList = async () => {
  let dataResult = await projectDb.getProjectList({
    code: null,
    name: null,
    sorting: " id DESC ",
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
  state.tableData.param.name = null;
  await getProjectList();
};

// 初始化表格数据
const getTableData = async () => {
  state.tableData.loading = true;
  state.tableData.param.skipCount =
    (state.tableData.currentPage - 1) * state.tableData.param.maxResultCount;

  let dataResult = await serverDb.getServerList(state.tableData.param);
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

// 打开SSH安装
const onOpenSSH = () => {
  router.push({ path: "/sshInstall" });
};

// 打开新增项目弹窗
const onOpenAddServer = (type: string) => {
  serverDialogRef.value.openDialog(type, null);
};

// 打开修改项目弹窗
const onOpenEditServer = (type: string, row: RowServerType) => {
  serverDialogRef.value.openDialog(type, row);
};

// 删除项目
const onRowDel = (row: RowServerType) => {
  ElMessageBox.confirm(`此操作将永久删除服务器：“${row.name}”，是否确认?`, "提示", {
    confirmButtonText: "确认",
    cancelButtonText: "取消",
    type: "warning",
  }).then(async () => {
    let dataResult = await serverDb.deleteServer(Number(row.id));
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
.server-container {
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

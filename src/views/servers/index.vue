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
              clearable
              placeholder="请选择所属项目"
              size="default"
              v-model="state.tableData.param.projectId"
              @clear="onSearch"
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
        <el-button size="default" type="primary" @click="onOpenDiscoveryDialog('local')">
          {{ $t('message.discovery.scanLocal') }}
        </el-button>
        <el-button size="default" type="warning" @click="onOpenDiscoveryDialog('remote')">
          {{ $t('message.discovery.scanRemote') }}
        </el-button>
        <el-button size="default" type="primary" color="#7c4dff" @click="onSyncFromSshMcp">
          从 SSH MCP 同步
        </el-button>
        <el-button size="default" type="danger" :disabled="selectedRows.length === 0" @click="onBatchDel">
          <el-icon>
            <ele-Delete />
          </el-icon>
          批量删除
        </el-button>
      </template>
      <el-table
        :data="state.tableData.data"
        v-loading="state.tableData.loading"
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="50" />
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

    <discovery-import-dialog
      ref="discoveryImportDialogRef"
      @refresh="getTableData()"
    />
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
import { syncServersFromSshMcp, getUnmanagedServerCount, type SshMcpSyncResult } from "@/database/servers/sshMcpSync";
import { loadPublishSettings } from "@/utils/publishSettings";

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

// 服务发现 → 生成应用配置（弹窗内完成项目/环境/服务器选择与扫描）
const discoveryImportDialogRef = ref();
const DiscoveryImportDialog = defineAsyncComponent(
  () => import("@/views/servers/components/discoveryImportDialog.vue")
);

// 打开扫描弹窗：mode=local 本机 / remote 远端，项目默认取列表页当前筛选
const onOpenDiscoveryDialog = (scanMode: "local" | "remote") => {
  discoveryImportDialogRef.value?.openDialog(
    scanMode,
    state.tableData.param.projectId ?? null
  );
};

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

  // Windows 改用 PowerShell 原生 Expand-Archive / Compress-Archive，无需 tar；
  // Docker 仍检测 zip 命令
  const serverOs = displayOs(row.os);
  if (serverOs === "Docker") {
    const validationResult = await validateLinuxZip(row);
    if (!validationResult) {
      return false;
    }
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

// ============ SSH MCP 同步 ============
const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// 组装同步结果弹窗内容（分类计数 + 明细）
const buildSyncResultHtml = (r: SshMcpSyncResult): string => {
  const parts: string[] = [];
  const line = (label: string, names: string[]) =>
    `${label} ${names.length} 台${names.length > 0 ? `：${names.map(escapeHtml).join("、")}` : ""}`;
  parts.push(line("新增", r.added));
  parts.push(line("更新", r.updated));
  if (r.adopted.length > 0) parts.push(line("关联本地同机服务器并纳管", r.adopted));
  if (r.uploaded.length > 0) parts.push(line("已上传到 SSH MCP", r.uploaded));
  if (r.projectsCreated.length > 0) parts.push(`新建本地项目：${r.projectsCreated.map(escapeHtml).join("、")}`);
  const skips = [...r.skipped, ...r.uploadSkipped, ...r.conflicts].map(
    (s) => `${escapeHtml(s.name)}：${escapeHtml(s.reason)}`
  );
  if (skips.length > 0) parts.push(`<b>跳过 ${skips.length} 项：</b><br/>&nbsp;&nbsp;${skips.join("<br/>&nbsp;&nbsp;")}`);
  if (r.orphans.length > 0)
    parts.push(`<b>远端已移除 ${r.orphans.length} 台（本地保留，可手动删除）：</b>${r.orphans.map(escapeHtml).join("、")}`);
  return parts.join("<br/>");
};

// 从 SSH MCP 同步（可选同时上传本地未纳管服务器，用于存量迁移）
const onSyncFromSshMcp = async () => {
  const settings = await loadPublishSettings();
  const baseUrl = settings.sshMcpUrl;
  let uploadUnmanaged = false;
  let unmanagedCount = 0;
  try {
    unmanagedCount = await getUnmanagedServerCount();
  } catch (e) {
    console.warn("统计未纳管服务器失败:", e);
  }

  if (unmanagedCount > 0) {
    try {
      await ElMessageBox.confirm(
        `检测到 <b>${unmanagedCount}</b> 台本地服务器未纳入 SSH MCP 管理，是否在同步时一并上传（首次迁移推荐）？<br/><br/>` +
          `上传位置：SSH MCP 对应项目下的「导入」环境，上传成功后这些服务器改由 SSH MCP 统一管理。<br/><br/>` +
          `同步规则：已纳管服务器将被 SSH MCP 侧配置覆盖（IP/端口/账户/密码/描述）；本地自建且未上传的服务器不受影响；远端已删除的仅在结果中提示，不删本地。`,
        "从 SSH MCP 同步",
        {
          confirmButtonText: "上传并同步",
          cancelButtonText: "仅同步",
          distinguishCancelAndClose: true,
          dangerouslyUseHTMLString: true,
          type: "info",
        }
      );
      uploadUnmanaged = true;
    } catch (action) {
      if (action === "close") return; // 点 X 完全取消；「仅同步」继续走下行
      uploadUnmanaged = false;
    }
  } else {
    try {
      await ElMessageBox.confirm(
        `将从 SSH MCP（${escapeHtml(baseUrl)}）同步服务器配置到本地。<br/>已纳管服务器会被 SSH MCP 侧配置覆盖（IP/端口/账户/密码/描述），本地自建服务器不受影响。`,
        "从 SSH MCP 同步",
        {
          confirmButtonText: "开始同步",
          cancelButtonText: "取消",
          dangerouslyUseHTMLString: true,
          type: "info",
        }
      );
    } catch {
      return;
    }
  }

  const loading = ElLoading.service({
    lock: true,
    text: "正在同步，请稍等...",
    background: "rgba(0, 0, 0, 0)",
  });
  let result: SshMcpSyncResult;
  try {
    result = await syncServersFromSshMcp(baseUrl, { uploadUnmanaged });
  } finally {
    loading.close();
  }

  if (!result.ok) {
    ElMessage.error(result.message);
    return;
  }
  await getTableData();
  await getProjectList(); // 同步可能新建了本地项目
  ElMessageBox.alert(buildSyncResultHtml(result), "同步结果", {
    confirmButtonText: "知道了",
    dangerouslyUseHTMLString: true,
  });
};

// 打开新增项目弹窗
const onOpenAddServer = (type: string) => {
  serverDialogRef.value.openDialog(type, null);
};

// 打开修改项目弹窗
const onOpenEditServer = (type: string, row: RowServerType) => {
  serverDialogRef.value.openDialog(type, row);
};

// 多选
const selectedRows = ref<RowServerType[]>([]);

const handleSelectionChange = (rows: RowServerType[]) => {
  selectedRows.value = rows;
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

// 批量删除
const onBatchDel = () => {
  const names = selectedRows.value.map((r) => r.name).join("、");
  ElMessageBox.confirm(
    `此操作将永久删除以下服务器：【${names}】，是否确认?`,
    "批量删除",
    {
      confirmButtonText: "确认",
      cancelButtonText: "取消",
      type: "warning",
    }
  ).then(async () => {
    const ids = selectedRows.value.map((r) => Number(r.id));
    const failedIds = new Array<number>();
    for (const id of ids) {
      const deleteResult = await serverDb.deleteServer(id);
      if (deleteResult.code !== 0) failedIds.push(id);
    }
    selectedRows.value = [];
    await getTableData();
    if (failedIds.length > 0) {
      ElMessage.error(`批量删除完成，失败 ${failedIds.length} 条（ID：${failedIds.join("、")}）`);
    } else {
      ElMessage.success("批量删除成功");
    }
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

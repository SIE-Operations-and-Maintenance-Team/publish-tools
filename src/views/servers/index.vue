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
        <el-button size="default" type="primary" :loading="discoveryScanning" @click="onScanLocal">
          {{ $t('message.discovery.scanLocal') }}
        </el-button>
        <el-button size="default" type="warning" :loading="discoveryScanning" @click="onScanRemote">
          {{ $t('message.discovery.scanRemote') }}
        </el-button>
        <el-button size="default" type="primary" plain @click="onSyncFromSshMcp">
          从 SSH MCP 同步
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

    <!-- 服务发现结果抽屉 -->
    <el-drawer
      v-model="discoveryDrawerVisible"
      :title="discoveryDrawerTitle"
      direction="rtl"
      size="520px"
      :close-on-click-modal="false"
    >
      <div v-loading="discoveryScanning">
        <el-alert
          v-if="discoveryError"
          :title="discoveryError"
          type="error"
          show-icon
          :closable="false"
          style="margin-bottom: 12px"
        />
        <!-- 远端服务器选择（仅远端模式且有服务器时展示） -->
        <div v-if="currentScanMode === 'remote' && state.tableData.data.length > 0" style="margin-bottom: 12px">
          <el-select
            v-model="selectedRemoteServerId"
            placeholder="请选择要扫描的远端服务器"
            size="small"
            style="width: 100%"
            @change="onScanRemote"
          >
            <el-option
              v-for="srv in state.tableData.data"
              :key="srv.id"
              :label="`${srv.name} (${srv.ip})`"
              :value="srv.id"
            />
          </el-select>
        </div>

        <template v-if="!discoveryScanning && discoveryResults.length === 0">
          <el-empty :description="$t('message.discovery.noResult')" />
          <div style="text-align: center; margin-top: 8px">
            <el-button type="primary" size="small" @click="onGoSettings">
              {{ $t('message.discovery.goSetting') }}
            </el-button>
          </div>
        </template>

        <div v-else class="discovery-cards">
          <el-card
            v-for="(item, idx) in discoveryResults"
            :key="`${item.serviceName}-${idx}`"
            shadow="never"
            style="margin-bottom: 10px"
          >
            <div style="display: flex; align-items: flex-start; gap: 8px">
              <el-checkbox
                :model-value="isDiscoverySelected(idx)"
                @change="(val: boolean) => toggleDiscoverySelected(idx, val)"
              />
              <div style="flex: 1; min-width: 0">
                <div style="font-weight: 600; word-break: break-all">{{ item.serviceName }}</div>
                <div v-if="item.displayName && item.displayName !== item.serviceName" style="font-size: 12px; color: var(--el-text-color-secondary)">{{ item.displayName }}</div>
                <div style="margin-top: 6px; font-size: 12px">
                  <span style="color: var(--el-text-color-secondary)">{{ $t('message.discovery.suggestedPath') }}：</span>
                  <span v-if="item.suggestedPublishPath" style="word-break: break-all">{{ item.suggestedPublishPath }}</span>
                  <span v-else style="word-break: break-all">{{ item.rawPath || '—' }}</span>
                  <el-tag v-if="!item.suggestedPublishPath" type="warning" size="small" style="margin-left: 6px">容器未挂载宿主机目录，请手动填写</el-tag>
                </div>
                <div style="margin-top: 4px">
                  <el-tag size="small" :type="item.source === 'docker' ? 'success' : 'info'">{{ item.source }}</el-tag>
                  <span v-if="item.image" style="margin-left: 6px; font-size: 12px; color: var(--el-text-color-secondary); word-break: break-all">{{ item.image }}</span>
                </div>
              </div>
            </div>
          </el-card>
        </div>
      </div>
      <template #footer>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span style="font-size: 12px; color: var(--el-text-color-secondary)">已选 {{ selectedDiscoveryKeys.length }} 项</span>
          <div>
            <el-button @click="discoveryDrawerVisible = false">关闭</el-button>
            <el-button type="primary" :disabled="selectedDiscoveryKeys.length === 0" :loading="importing" @click="onConfirmImport">
              {{ $t('message.discovery.confirmImport') }}
            </el-button>
          </div>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts" name="server">
import { ref, reactive, onBeforeMount, onMounted, defineAsyncComponent, computed } from "vue";
import { useRouter } from "vue-router";
import { cmdInvoke } from "@/utils/command";
import { ElMessage, ElMessageBox, ElLoading } from "element-plus";
import { QuestionFilled } from "@element-plus/icons-vue";
import _ from "lodash";
import { useProjectDb } from "@/database/project/index";
import { useServerDb } from "@/database/servers/index";
import { displayOs } from "@/utils/other";
import { useServiceDiscovery } from "@/composables/useServiceDiscovery";
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

// 服务发现
const {
  scanning: discoveryScanning,
  results: discoveryResults,
  error: discoveryError,
  loadPrefixes: loadDiscoveryPrefixes,
  scanLocal: doScanLocal,
  scanRemote: doScanRemote,
} = useServiceDiscovery();
const currentScanMode = ref<'local' | 'remote'>('local');
const discoveryDrawerVisible = ref(false);
const discoveryDrawerTitle = computed(() => (currentScanMode.value === 'remote' ? '远端发现结果' : '本机发现结果'));
const selectedDiscoveryKeys = ref<number[]>([]);
const selectedRemoteServerId = ref<number | null>(null);
const importing = ref(false);

const isDiscoverySelected = (idx: number) => selectedDiscoveryKeys.value.includes(idx);
const toggleDiscoverySelected = (idx: number, val: boolean) => {
  if (val) {
    if (!selectedDiscoveryKeys.value.includes(idx)) selectedDiscoveryKeys.value.push(idx);
  } else {
    selectedDiscoveryKeys.value = selectedDiscoveryKeys.value.filter((v) => v !== idx);
  }
};

const onGoSettings = () => {
  discoveryDrawerVisible.value = false;
  router.push({ path: "/settings" });
};

const onScanLocal = async () => {
  currentScanMode.value = 'local';
  selectedDiscoveryKeys.value = [];
  discoveryDrawerVisible.value = true;
  await loadDiscoveryPrefixes();
  await doScanLocal();
};

const onScanRemote = async () => {
  currentScanMode.value = 'remote';
  // 若已在抽屉内切换服务器，仅重扫
  if (selectedRemoteServerId.value == null && state.tableData.data.length === 1) {
    selectedRemoteServerId.value = state.tableData.data[0].id as number;
  }
  if (state.tableData.data.length === 0) {
    ElMessage.warning("暂无服务器，请先新增服务器");
    return;
  }
  let target: RowServerType | undefined;
  if (selectedRemoteServerId.value != null) {
    target = state.tableData.data.find((s) => s.id === selectedRemoteServerId.value);
  }
  if (!target) {
    // 首次点击且多台服务器时：打开抽屉让用户选择
    selectedDiscoveryKeys.value = [];
    discoveryResults.value = [];
    discoveryError.value = null;
    discoveryDrawerVisible.value = true;
    await loadDiscoveryPrefixes();
    return;
  }
  selectedDiscoveryKeys.value = [];
  discoveryDrawerVisible.value = true;
  await loadDiscoveryPrefixes();
  await doScanRemote({ ip: `${target.ip}:${target.port}`, account: target.account, pwd: target.pwd });
};

const onConfirmImport = async () => {
  if (selectedDiscoveryKeys.value.length === 0) {
    ElMessage.warning("请先勾选要导入的服务");
    return;
  }
  importing.value = true;
  let success = 0;
  const failedItems: string[] = [];
  const failMessages: string[] = [];
  for (const idx of selectedDiscoveryKeys.value) {
    const item = discoveryResults.value[idx];
    if (!item) continue;
    // description 附 suggestedPublishPath，真实发布路径由工作台写入 t_app_config.config_items_json
    const desc = item.suggestedPublishPath ? `建议发布目录: ${item.suggestedPublishPath}` : `WorkingDir: ${item.rawPath || ''}（容器未挂载宿主机目录，请手动填写）`;
    const row: RowServerType = {
      id: null,
      projectId: state.tableData.param.projectId ?? projectList.value?.[0]?.id ?? null,
      projectName: null,
      name: item.serviceName,
      os: item.source === 'docker' ? 2 : 1,
      ip: "",
      port: 22,
      account: "",
      pwd: "",
      description: desc,
    } as RowServerType;
    const r = await serverDb.insertServer(row);
    if (r.code === 0) success++;
    else {
      failedItems.push(item.serviceName);
      failMessages.push(r.msg || "导入失败");
    }
  }
  importing.value = false;
  const distinctMsgs = [...new Set(failMessages)];
  const failSummary = distinctMsgs.join("；");
  if (success > 0 && failedItems.length === 0) {
    ElMessage.success(`已导入 ${success} 条`);
    discoveryDrawerVisible.value = false;
    selectedDiscoveryKeys.value = [];
    await getTableData();
    try {
      await ElMessageBox.confirm(
        `已导入 ${success} 条服务器，IP/账号/端口为空，暂不可连接。请在列表中编辑补录连接信息后再测试连接。`,
        "导入完成",
        { confirmButtonText: "知道了", cancelButtonText: "关闭", type: "warning", distinguishCancelAndClose: true }
      );
    } catch {
      // 用户关闭弹窗，无需处理
    }
  } else if (success > 0 && failedItems.length > 0) {
    ElMessage.warning(`已导入 ${success} 条，失败 ${failedItems.length} 条：${failedItems.join("、")}（${failSummary}）`);
    discoveryDrawerVisible.value = false;
    selectedDiscoveryKeys.value = [];
    await getTableData();
    try {
      await ElMessageBox.confirm(
        `已导入 ${success} 条，另有 ${failedItems.length} 条失败（${failedItems.join("、")}）。成功导入的服务器 IP/账号仍为空，请编辑补录后再测试连接。`,
        "部分导入成功",
        { confirmButtonText: "知道了", cancelButtonText: "关闭", type: "warning", distinguishCancelAndClose: true }
      );
    } catch {
      // 用户关闭弹窗，无需处理
    }
  } else if (failedItems.length > 0) {
    ElMessage.error(`导入失败 ${failedItems.length} 条：${failedItems.join("、")}（${failSummary}）`);
  }
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

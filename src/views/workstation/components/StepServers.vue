<template>
  <div class="step-servers">
    <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap">
      <el-button
        size="small"
        type="primary"
        :loading="scanning"
        @click="onScanLocal"
        >扫描本机</el-button
      >
      <el-button
        size="small"
        type="warning"
        :loading="scanning"
        @click="onScanRemote"
        >扫描远端</el-button
      >
      <el-button size="small" plain @click="onOpenNew">新增服务器</el-button>
      <el-button size="small" @click="loadServers">刷新</el-button>
      <span
        style="
          margin-left: auto;
          font-size: 12px;
          color: var(--el-text-color-secondary);
          align-self: center;
        "
        >已选 {{ selectedIds.length }} / {{ serverList.length }}</span
      >
    </div>

    <el-empty
      v-if="serverList.length === 0"
      description="暂无服务器 — 点击“新增服务器”创建，或使用“扫描本机/远端”自动发现"
      :image-size="56"
    />
    <div v-else class="server-cards">
      <el-card
        v-for="srv in serverList"
        :key="srv.id"
        shadow="hover"
        :class="['server-card', selectedIds.includes(srv.id as number) ? 'is-selected' : '']"
        @click="toggleSelected(srv.id as number)"
      >
        <div style="display: flex; gap: 8px; align-items: flex-start">
          <el-checkbox
            :model-value="selectedIds.includes(srv.id as number)"
            @change="() => toggleSelected(srv.id as number)"
            @click.stop
          />
          <div style="flex: 1; min-width: 0">
            <div style="font-weight: 600; word-break: break-all">
              {{ srv.name }}
            </div>
            <div
              style="
                font-size: 12px;
                color: var(--el-text-color-secondary);
                margin-top: 2px;
              "
            >
              <el-tag
                size="small"
                :type="srv.os === 2 ? 'success' : 'info'"
                style="margin-right: 6px"
                >{{ srv.os === 2 ? "Docker" : "Windows" }}</el-tag
              >
              {{ srv.ip }}:{{ srv.port }} · {{ srv.account || "—" }}
            </div>
            <div
              v-if="srv.description"
              style="
                font-size: 12px;
                color: var(--el-text-color-secondary);
                margin-top: 4px;
                word-break: break-all;
              "
            >
              {{ srv.description }}
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 远端扫描目标选择 -->
    <el-dialog
      v-model="remotePickerVisible"
      title="选择远端服务器"
      width="420px"
      :close-on-click-modal="false"
    >
      <el-select
        v-model="remoteTargetId"
        placeholder="请选择要扫描的远端服务器"
        style="width: 100%"
      >
        <el-option
          v-for="s in serverList"
          :key="s.id"
          :label="`${s.name} (${s.ip}:${s.port})`"
          :value="s.id"
        />
      </el-select>
      <template #footer>
        <el-button @click="remotePickerVisible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="!remoteTargetId"
          @click="doScanRemoteWithTarget"
          >开始扫描</el-button
        >
      </template>
    </el-dialog>

    <!-- 发现结果抽屉 -->
    <el-drawer
      v-model="drawerVisible"
      :title="drawerTitle"
      direction="rtl"
      size="520px"
      :close-on-click-modal="false"
    >
      <div v-loading="scanning">
        <el-alert
          v-if="discoveryError"
          :title="discoveryError"
          type="error"
          show-icon
          :closable="false"
          style="margin-bottom: 12px"
        />
        <template v-if="!scanning && discoveryResults.length === 0">
          <el-empty
            description="未发现匹配的服务 — 尝试修改前缀后重扫，或检查服务是否已安装"
          />
          <div style="text-align: center; margin-top: 8px">
            <el-button type="primary" size="small" @click="onGoSettings"
              >去设置前缀并重扫</el-button
            >
          </div>
        </template>
        <div v-else class="discovery-cards">
          <el-card
            v-for="(item, idx) in discoveryResults"
            :key="`${item.serviceName}-${idx}`"
            shadow="never"
            style="margin-bottom: 10px"
          >
            <div style="display: flex; gap: 8px; align-items: flex-start">
              <el-checkbox
                :model-value="selectedDiscoveryIdx.includes(idx)"
                @change="(v: boolean) => toggleDiscovery(idx, v)"
              />
              <div style="flex: 1; min-width: 0">
                <div style="font-weight: 600; word-break: break-all">
                  {{ item.serviceName }}
                </div>
                <div
                  v-if="
                    item.displayName && item.displayName !== item.serviceName
                  "
                  style="font-size: 12px; color: var(--el-text-color-secondary)"
                >
                  {{ item.displayName }}
                </div>
                <div style="margin-top: 6px; font-size: 12px">
                  <span style="color: var(--el-text-color-secondary)"
                    >建议发布目录：</span
                  >
                  <span
                    v-if="item.suggestedPublishPath"
                    style="word-break: break-all"
                    >{{ item.suggestedPublishPath }}</span
                  >
                  <span v-else style="word-break: break-all">{{
                    item.rawPath || "—"
                  }}</span>
                  <el-tag
                    v-if="!item.suggestedPublishPath"
                    type="warning"
                    size="small"
                    style="margin-left: 6px"
                    >容器未挂载宿主机目录</el-tag
                  >
                </div>
                <div style="margin-top: 4px">
                  <el-tag
                    size="small"
                    :type="item.source === 'docker' ? 'success' : 'info'"
                    >{{ item.source }}</el-tag
                  >
                  <span
                    v-if="item.image"
                    style="
                      margin-left: 6px;
                      font-size: 12px;
                      color: var(--el-text-color-secondary);
                      word-break: break-all;
                    "
                    >{{ item.image }}</span
                  >
                </div>
              </div>
            </div>
          </el-card>
        </div>
      </div>
      <template #footer>
        <div
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
          "
        >
          <span style="font-size: 12px; color: var(--el-text-color-secondary)"
            >已选 {{ selectedDiscoveryIdx.length }} 项</span
          >
          <div>
            <el-button @click="drawerVisible = false">关闭</el-button>
            <el-button
              type="primary"
              :disabled="selectedDiscoveryIdx.length === 0"
              :loading="importing"
              @click="onConfirmImport"
              >确认导入</el-button
            >
          </div>
        </div>
      </template>
    </el-drawer>

    <component
      :is="ServerDialogComp"
      ref="serverDialogRef"
      @refresh="loadServers"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, defineAsyncComponent, watch } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { useServerDb } from "@/database/servers/index";
import { useWorkstationStore } from "@/stores/workstation";
import { useServiceDiscovery } from "@/composables/useServiceDiscovery";

const store = useWorkstationStore();
const serverDb = useServerDb();
const router = useRouter();

const ServerDialogComp = defineAsyncComponent(
  () => import("@/views/servers/components/serverDialog.vue")
);

const serverDialogRef = ref<any>(null);
const serverList = ref<RowServerType[]>([]);
const selectedIds = ref<number[]>([...(store.draft.serverIds || [])]);

const {
  scanning,
  results: discoveryResults,
  error: discoveryError,
  loadPrefixes,
  scanLocal,
  scanRemote,
} = useServiceDiscovery();

const drawerVisible = ref(false);
const drawerTitle = ref("发现结果");
const selectedDiscoveryIdx = ref<number[]>([]);
const importing = ref(false);
const remotePickerVisible = ref(false);
const remoteTargetId = ref<number | null>(null);

const loadServers = async () => {
  // 按当前项目过滤，若无项目则拉全量
  const projectId = store.draft.projectId as number | null;
  const r = await serverDb.getServerList({
    projectId: projectId ?? null,
    name: null,
    sorting: "ts.id DESC",
    skipCount: 0,
    maxResultCount: 1000,
  });
  if (r.code === 0) serverList.value = r.data.data;
};

const toggleSelected = (id: number) => {
  const idx = selectedIds.value.indexOf(id);
  if (idx > -1) selectedIds.value.splice(idx, 1);
  else selectedIds.value.push(id);
  // 实时同步到 draft，便于预览区即时展示
  store.draft.serverIds = [...selectedIds.value];
  store.persist();
};

const onOpenNew = () => serverDialogRef.value?.openDialog("add", null);

const onScanLocal = async () => {
  drawerTitle.value = "本机发现结果";
  selectedDiscoveryIdx.value = [];
  drawerVisible.value = true;
  await loadPrefixes();
  await scanLocal();
};

const onScanRemote = async () => {
  if (serverList.value.length === 0) {
    ElMessage.warning("暂无服务器，请先新增服务器后再扫描远端");
    return;
  }
  if (serverList.value.length === 1) {
    remoteTargetId.value = serverList.value[0].id as number;
    await doScanRemoteWithTarget();
    return;
  }
  remotePickerVisible.value = true;
};

const doScanRemoteWithTarget = async () => {
  const target = serverList.value.find((s) => s.id === remoteTargetId.value);
  if (!target) {
    ElMessage.warning("请选择要扫描的远端服务器");
    return;
  }
  remotePickerVisible.value = false;
  drawerTitle.value = "远端发现结果";
  selectedDiscoveryIdx.value = [];
  drawerVisible.value = true;
  await loadPrefixes();
  await scanRemote({
    ip: `${target.ip}:${target.port}`,
    account: target.account,
    pwd: target.pwd,
  });
};

const toggleDiscovery = (idx: number, val: boolean) => {
  if (val) {
    if (!selectedDiscoveryIdx.value.includes(idx))
      selectedDiscoveryIdx.value.push(idx);
  } else {
    selectedDiscoveryIdx.value = selectedDiscoveryIdx.value.filter(
      (v) => v !== idx
    );
  }
};

const onGoSettings = () => {
  drawerVisible.value = false;
  router.push({ path: "/settings" });
};

const onConfirmImport = async () => {
  if (selectedDiscoveryIdx.value.length === 0) {
    ElMessage.warning("请先勾选要导入的服务");
    return;
  }
  importing.value = true;
  let success = 0;
  const newIds: number[] = [];
  const failed: string[] = [];
  // 收集建议目录，用于回填应用配置
  const suggestedMap: Record<string, string> = {};
  for (const idx of selectedDiscoveryIdx.value) {
    const item = discoveryResults.value[idx];
    if (!item) continue;
    const row: RowServerType = {
      id: null,
      projectId: store.draft.projectId ?? null,
      projectName: null,
      name: item.serviceName,
      os: item.source === "docker" ? 2 : 1,
      ip: "",
      port: 22,
      account: "",
      pwd: "",
      description: item.suggestedPublishPath
        ? `建议发布目录: ${item.suggestedPublishPath}`
        : `WorkingDir: ${item.rawPath || ""}`,
    } as RowServerType;
    const r = await serverDb.insertServer(row);
    if (r.code === 0) {
      success++;
      if (r.data) newIds.push(r.data as number);
      if (item.suggestedPublishPath)
        suggestedMap[item.serviceName] = item.suggestedPublishPath;
    } else {
      failed.push(item.serviceName);
    }
  }
  importing.value = false;
  if (success > 0) {
    ElMessage.success(`已导入 ${success} 条，IP/账号待补录`);
    drawerVisible.value = false;
    selectedDiscoveryIdx.value = [];
    await loadServers();
    // 回填 draft.serverIds：新增的自动选中
    for (const id of newIds)
      if (!selectedIds.value.includes(id)) selectedIds.value.push(id);
    store.draft.serverIds = [...selectedIds.value];
    store.persist();
    // m-01: 若有建议目录，提示是否回填到应用配置
    const hasSuggested = Object.keys(suggestedMap).length > 0;
    if (hasSuggested) {
      const firstSuggested = Object.values(suggestedMap)[0];
      try {
        await ElMessageBox.confirm(
          `发现 ${
            Object.keys(suggestedMap).length
          } 项含建议发布目录（例：${firstSuggested}），是否回填到应用配置的发布路径？`,
          "发现建议目录",
          {
            confirmButtonText: "回填",
            cancelButtonText: "稍后手动填写",
            type: "info",
          }
        );
        // 回填到 appconfigDraft.configItems 的 serverPath（若为空）
        const draft: Record<string, unknown> =
          (store.draft.appconfigDraft as unknown as Record<string, unknown>) ||
          {};
        if (!draft["configItems"])
          (draft as Record<string, unknown>)["configItems"] = {};
        const ci = draft["configItems"] as Record<string, unknown>;
        const modules = [
          "webApiHost",
          "scheduleServer",
          "webClient",
          "spcMonitor",
          "wpfClient",
        ];
        for (const m of modules) {
          if (!ci[m])
            ci[m] = {
              clientPath: "",
              serverPath: "",
              serverIds: [],
              serverArr: [],
            };
          const mod = ci[m] as Record<string, unknown>;
          if (!mod["serverPath"]) mod["serverPath"] = firstSuggested;
        }
        store.draft.appconfigDraft =
          draft as unknown as typeof store.draft.appconfigDraft;
        store.persist();
        ElMessage.success(
          "已回填建议目录到应用配置，可在“应用配置”步骤查看或修改"
        );
      } catch {
        // 用户取消，不回填
      }
    }
  }
  if (failed.length > 0) ElMessage.error(`导入失败：${failed.join("、")}`);
};

const validate = (): boolean => {
  if (selectedIds.value.length === 0) {
    ElMessage.warning("请至少选择一台服务器");
    return false;
  }
  store.draft.serverIds = [...selectedIds.value];
  store.persist();
  return true;
};

watch(
  () => store.draft.serverIds,
  (v) => {
    const sorted = [...(v || [])].sort((a, b) => a - b);
    const curr = [...selectedIds.value].sort((a, b) => a - b);
    if (JSON.stringify(sorted) !== JSON.stringify(curr))
      selectedIds.value = [...(v || [])];
  }
);

watch(
  () => store.draft.projectId,
  () => loadServers()
);

onMounted(async () => {
  await loadServers();
  await loadPrefixes();
});

defineExpose({ validate });
</script>

<style scoped>
.step-servers {
  padding: 4px 0;
}
.server-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}
.server-card {
  cursor: pointer;
  border: 1px solid var(--el-border-color-lighter);
}
.server-card.is-selected {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
</style>

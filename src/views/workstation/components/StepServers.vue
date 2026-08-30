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
                :disabled="!matchModule(item.serviceName)"
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
                  <el-tag
                    v-if="matchModule(item.serviceName)"
                    size="small"
                    type="primary"
                    style="margin-left: 6px"
                    >导入到应用配置:{{ matchModule(item.serviceName)?.label }}
                  </el-tag>
                  <el-tag v-else size="small" type="warning" style="margin-left: 6px"
                    >未识别所属模块，跳过导入</el-tag
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
              >导入到应用配置</el-button
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
import { ElMessage } from "element-plus";
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
// 本次扫描的目标服务器:远端=被扫描的服务器记录;本机=null(导入时复用/自动创建"本机"记录)
const scanTarget = ref<RowServerType | null>(null);

// 服务名 → 应用配置模块映射(按关键字包含匹配,顺序即优先级)
const SERVICE_MODULE_RULES = [
  { key: "webApiHost", label: "WebApiHost", match: "webapihost" },
  { key: "scheduleServer", label: "调度(ScheduleServer)", match: "scheduleserver" },
  { key: "webClient", label: "WebClient", match: "webclient" },
  { key: "wpfClient", label: "WpfClient", match: "wpfclient" },
  { key: "spcMonitor", label: "SpcMonitor", match: "spcmonitor" },
] as const;

type ServiceModuleKey = (typeof SERVICE_MODULE_RULES)[number]["key"];

const matchModule = (
  serviceName: string
): { key: ServiceModuleKey; label: string } | null => {
  const n = (serviceName || "").toLowerCase();
  return SERVICE_MODULE_RULES.find((r) => n.includes(r.match)) || null;
};

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
  scanTarget.value = null;
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
  scanTarget.value = target;
  drawerVisible.value = true;
  await loadPrefixes();
  await scanRemote({
    ip: `${target.ip}:${target.port}`,
    account: target.account,
    pwd: target.pwd,
  });
};

const toggleDiscovery = (idx: number, val: boolean) => {
  // 未识别所属模块的服务不允许勾选(导入无目标模块)
  if (!matchModule(discoveryResults.value[idx]?.serviceName || "")) return;
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

// 本机扫描的导入目标:复用已有的"本机"记录,不存在则自动创建一条(ip=127.0.0.1)
const ensureLocalServer = async (): Promise<RowServerType | null> => {
  const exist = serverList.value.find(
    (s) => s.ip === "127.0.0.1" || s.name === "本机"
  );
  if (exist) return exist;
  const r = await serverDb.insertServer({
    id: null,
    projectId: store.draft.projectId ?? null,
    projectName: null,
    name: "本机",
    os: 1,
    ip: "127.0.0.1",
    port: 22,
    account: "",
    pwd: "",
    description: "扫描本机时自动创建",
  } as RowServerType);
  if (r.code !== 0) {
    ElMessage.error(r.msg);
    return null;
  }
  await loadServers();
  return serverList.value.find((s) => s.id === r.data) ?? null;
};

// 空白模块默认结构(与 CommonAppconfigType + serverIds/serverArr 对齐)
const emptyModule = () => ({
  clientPath: "",
  serverPath: null,
  serverIds: [] as number[],
  serverArr: [] as SelectServerType[],
});

// 把发现的服务合并进一份 configItems:模块勾选目标服务器 + 该服务器下追加服务条目(服务标识+发布路径)
// 返回实际新增的服务条数;同名服务标识已存在时跳过,不覆盖
const mergeServicesIntoConfigItems = (
  ci: Record<string, any>,
  targetId: number,
  targetName: string,
  picked: { item: DiscoveryItem; module: { key: ServiceModuleKey; label: string } }[]
): number => {
  let added = 0;
  for (const { item, module: m } of picked) {
    if (!ci[m.key]) ci[m.key] = emptyModule();
    const mod = ci[m.key];
    if (!Array.isArray(mod.serverIds)) mod.serverIds = [];
    if (!Array.isArray(mod.serverArr)) mod.serverArr = [];
    if (!mod.serverIds.includes(targetId)) mod.serverIds.push(targetId);
    let arr = mod.serverArr.find(
      (x: SelectServerType) => Number(x.id) === Number(targetId)
    );
    if (!arr) {
      arr = { id: targetId, name: targetName, serverPathArr: [] };
      mod.serverArr.push(arr);
    }
    if (!Array.isArray(arr.serverPathArr)) arr.serverPathArr = [];
    const exists = arr.serverPathArr.some((sp: ServerOptionType) =>
      (sp.value || []).some((v) => v.identity === item.serviceName)
    );
    if (exists) continue;
    arr.serverPathArr.push({
      label: "",
      value: [
        {
          identity: item.serviceName,
          path: item.suggestedPublishPath || item.rawPath || "",
        },
      ],
    });
    added++;
  }
  return added;
};

const onConfirmImport = async () => {
  if (selectedDiscoveryIdx.value.length === 0) {
    ElMessage.warning("请先勾选要导入的服务");
    return;
  }
  const picked = selectedDiscoveryIdx.value
    .map((idx) => discoveryResults.value[idx])
    .filter(Boolean)
    .map((item: DiscoveryItem) => ({ item, module: matchModule(item.serviceName) }))
    .filter((x): x is { item: DiscoveryItem; module: { key: ServiceModuleKey; label: string } } => !!x.module);
  const unmappedCount = selectedDiscoveryIdx.value.length - picked.length;
  if (picked.length === 0) {
    ElMessage.warning("所选服务均未能识别所属模块(WebApiHost/调度/WebClient 等)，未导入");
    return;
  }
  importing.value = true;
  try {
    // 导入目标服务器:远端=被扫描的服务器记录;本机=复用/自动创建"本机"记录
    let target = scanTarget.value;
    if (!target) {
      target = await ensureLocalServer();
      if (!target || target.id == null) return;
    }
    if (target.id == null) return;

    // 1) 合并进已校验的应用配置草稿(为空则初始化骨架,应用配置步骤恢复时可见)
    const draft: any = store.draft as any;
    if (!draft.appconfigDraft || Object.keys(draft.appconfigDraft).length === 0) {
      draft.appconfigDraft = {
        projectId: draft.projectId ?? null,
        environment: null,
        configItems: {},
      };
    }
    const ad = draft.appconfigDraft;
    if (!ad.configItems) ad.configItems = {};
    const added = mergeServicesIntoConfigItems(
      ad.configItems,
      target.id,
      target.name as string,
      picked
    );

    // 2) 同步合并进未校验的表单缓存(仅同项目),防止应用配置步骤恢复缓存时覆盖掉本次导入
    const cache = draft.appconfigFormCache;
    if (cache && cache.projectId === draft.projectId) {
      if (!cache.ruleForm) cache.ruleForm = {};
      if (!cache.ruleForm.configItems) cache.ruleForm.configItems = {};
      mergeServicesIntoConfigItems(
        cache.ruleForm.configItems,
        target.id,
        target.name as string,
        picked
      );
    }

    // 3) 目标服务器加入已选,供预览/发布使用
    if (target.id != null && !selectedIds.value.includes(target.id))
      selectedIds.value.push(target.id);
    store.draft.serverIds = [...selectedIds.value];
    store.persist();

    drawerVisible.value = false;
    selectedDiscoveryIdx.value = [];
    if (added > 0) {
      ElMessage.success(
        `已将 ${added} 项服务导入应用配置（挂到服务器「${target.name}」下），可在“应用配置”步骤查看修改` +
          (unmappedCount > 0 ? `；另有 ${unmappedCount} 项未识别所属模块已跳过` : "")
      );
    } else {
      ElMessage.info("所选服务在应用配置中已存在（同名服务标识），未做修改");
    }
  } finally {
    importing.value = false;
  }
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

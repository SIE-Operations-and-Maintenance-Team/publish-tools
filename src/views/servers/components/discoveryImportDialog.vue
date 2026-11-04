<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="820px"
    :close-on-click-modal="false"
    draggable
  >
    <div class="discovery-import">
      <el-form label-width="96px" size="default">
        <el-form-item label="项目" required>
          <el-select
            v-model="projectId"
            filterable
            placeholder="请选择项目"
            style="width: 100%"
            @change="onProjectChange"
          >
            <el-option
              v-for="p in projectList"
              :key="p.id"
              :label="p.name"
              :value="p.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="环境" required>
          <el-radio-group v-model="environment" @change="onEnvironmentChange">
            <el-radio border :value="1">Dev</el-radio>
            <el-radio border :value="2">Uat</el-radio>
            <el-radio border :value="3">Pro</el-radio>
            <el-radio border :value="4">Other</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="mode === 'remote'" label="目标服务器" required>
          <el-select
            v-model="targetServerIds"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            :disabled="!projectId"
            :placeholder="projectId ? '请选择要扫描的服务器（可多选）' : '请先选择项目'"
            style="width: 100%"
          >
            <el-option
              v-for="s in serverOptions"
              :key="s.id"
              :label="`${s.name} (${s.ip}:${s.port})`"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="服务名前缀">
          <div class="discovery-prefix">
            <div class="discovery-prefix-summary">
              <span>扫描按这些前缀匹配服务名：</span>
              <b>{{ enabledPrefixText }}</b>
              <el-button
                link
                type="primary"
                style="margin-left: 6px"
                @click="prefixEditorVisible = !prefixEditorVisible"
                >{{ prefixEditorVisible ? "收起" : "修改" }}</el-button
              >
            </div>
            <div v-if="prefixEditorVisible" class="discovery-prefix-editor">
              <div class="discovery-prefix-tags">
                <div
                  v-for="item in prefixList"
                  :key="item.id ?? item.prefix"
                  class="discovery-prefix-row"
                >
                  <el-tag
                    :type="item.isDefault === 1 ? 'info' : undefined"
                    :closable="item.isDefault !== 1"
                    size="small"
                    @close="onDeletePrefix(item)"
                  >
                    {{ item.prefix }}
                    <span
                      v-if="item.isDefault === 1"
                      class="discovery-prefix-default"
                      >(默认)</span
                    >
                  </el-tag>
                  <el-switch
                    v-model="item.enabled"
                    :active-value="1"
                    :inactive-value="0"
                    size="small"
                    @change="onTogglePrefix(item)"
                  />
                </div>
                <el-empty
                  v-if="!prefixList.length && !prefixLoading"
                  description="暂无前缀 — 试试输入如 SIE. 后点击新增"
                  :image-size="40"
                />
              </div>
              <div class="discovery-prefix-add">
                <el-input
                  v-model="newPrefix"
                  placeholder="新增前缀，如 SIE."
                  clearable
                  size="small"
                  style="width: 220px"
                  @keyup.enter="onAddPrefix"
                />
                <el-button
                  type="primary"
                  size="small"
                  :loading="prefixAdding"
                  @click="onAddPrefix"
                  >新增</el-button
                >
              </div>
              <div v-if="prefixEdited" class="discovery-prefix-tip">
                前缀已修改，请点击「开始扫描」重新扫描
              </div>
            </div>
          </div>
        </el-form-item>
      </el-form>

      <div class="discovery-scan-bar">
        <el-button
          type="primary"
          :loading="scanning"
          :disabled="!canScan"
          @click="onScan"
          >开始扫描</el-button
        >
        <span class="discovery-scan-hint">
          {{ scanProgress || defaultScanHint }}
        </span>
      </div>

      <div v-if="groups.length > 0" class="discovery-groups">
        <el-card
          v-for="g in groups"
          :key="g.key"
          shadow="never"
          class="discovery-group"
        >
          <template #header>
            <div class="discovery-group-header">
              <span class="discovery-group-name">
                {{ g.serverName }}
                <span class="discovery-group-addr">({{ g.serverAddr }})</span>
              </span>
              <span class="discovery-group-stat">
                <template v-if="g.error">扫描失败</template>
                <template v-else
                  >发现 {{ g.items.length }} 项 / 已选
                  {{ groupSelectedCount(g) }}</template
                >
              </span>
              <el-button
                v-if="g.items.length > 0"
                size="small"
                text
                type="primary"
                @click="toggleGroupAll(g)"
                >{{ isGroupAllSelected(g) ? "取消全选" : "全选" }}</el-button
              >
            </div>
          </template>
          <el-alert
            v-if="g.error"
            :title="g.error"
            type="error"
            show-icon
            :closable="false"
          />
          <el-empty
            v-else-if="g.items.length === 0"
            description="未发现匹配的服务 — 检查「服务名前缀」是否覆盖该机器上的服务名"
            :image-size="48"
          >
            <el-button
              type="primary"
              size="small"
              @click="prefixEditorVisible = true"
              >修改服务名前缀</el-button
            >
          </el-empty>
          <div v-else>
            <div v-for="it in g.items" :key="it.key" class="discovery-item">
              <el-checkbox
                :model-value="selectedKeys.includes(it.key)"
                :disabled="!it.module"
                @change="(val: any) => toggleItem(it.key, !!val)"
              />
              <div class="discovery-item-body">
                <div class="discovery-item-name">{{ it.item.serviceName }}</div>
                <div
                  v-if="
                    it.item.displayName &&
                    it.item.displayName !== it.item.serviceName
                  "
                  class="discovery-item-sub"
                >
                  {{ it.item.displayName }}
                </div>
                <div class="discovery-item-path">
                  <span class="discovery-item-label">发布路径：</span>
                  <span v-if="it.item.suggestedPublishPath">{{
                    it.item.suggestedPublishPath
                  }}</span>
                  <span v-else>{{ it.item.rawPath || "—" }}</span>
                  <el-tag
                    v-if="!it.item.suggestedPublishPath"
                    type="warning"
                    size="small"
                    style="margin-left: 6px"
                    >容器未挂载宿主机目录，生成后需手填</el-tag
                  >
                </div>
                <div class="discovery-item-tags">
                  <el-tag v-if="it.module" size="small" type="primary">{{
                    it.module.label
                  }}</el-tag>
                  <el-tag v-else size="small" type="warning"
                    >未识别所属模块，不可选</el-tag
                  >
                  <el-tag
                    size="small"
                    :type="it.item.source === 'docker' ? 'success' : 'info'"
                    >{{ it.item.source }}</el-tag
                  >
                  <el-tag
                    v-if="it.inferredEnv !== null"
                    size="small"
                    :type="it.inferredEnv === environment ? 'success' : 'info'"
                    >{{ envHintText(it) }}</el-tag
                  >
                  <span v-if="it.item.image" class="discovery-item-image">{{
                    it.item.image
                  }}</span>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </div>
      <el-empty
        v-else-if="scannedOnce && !scanning"
        description="未发现匹配的服务 — 检查「服务名前缀」是否覆盖该机器上的服务名"
        :image-size="56"
      >
        <el-button
          type="primary"
          size="small"
          @click="prefixEditorVisible = true"
          >修改服务名前缀</el-button
        >
      </el-empty>
    </div>
    <template #footer>
      <div class="discovery-footer">
        <span class="discovery-footer-stat">已选 {{ selectedKeys.length }} 项</span>
        <div>
          <el-button @click="visible = false">关闭</el-button>
          <el-button
            type="primary"
            :disabled="selectedKeys.length === 0"
            :loading="generating"
            @click="onGenerate"
            >生成应用配置</el-button
          >
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts" name="discoveryImportDialog">
import { ref, computed } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useProjectDb } from "@/database/project/index";
import { useServerDb } from "@/database/servers/index";
import { useAppconfigDb } from "@/database/appconfig/index";
import { useDiscoveryPrefixDb } from "@/database/discoveryPrefix";
import { useServiceDiscovery } from "@/composables/useServiceDiscovery";
import {
  matchModule,
  mergeServicesIntoConfigItems,
  inferServiceEnvironment,
  createEmptyConfigItems,
  type ServiceModuleKey,
} from "@/utils/serviceModuleMap";
import { displayEnvironment } from "@/utils/other";

const projectDb = useProjectDb();
const serverDb = useServerDb();
const appconfigDb = useAppconfigDb();
const prefixDb = useDiscoveryPrefixDb();
const { loadPrefixes, scanLocal, error: discoveryError, scanRemoteOne } =
  useServiceDiscovery();

const emit = defineEmits<{ (e: "refresh"): void }>();

type ResultItem = {
  key: string;
  item: DiscoveryItem;
  module: { key: ServiceModuleKey; label: string } | null;
  inferredEnv: number | null;
};

type ResultGroup = {
  key: string;
  // 本机扫描在生成时才解析服务器记录，此处为 null
  serverId: number | null;
  serverName: string;
  serverAddr: string;
  items: ResultItem[];
  error: string | null;
};

const visible = ref(false);
const mode = ref<"local" | "remote">("local");
const dialogTitle = computed(() =>
  mode.value === "remote" ? "扫描远端并生成应用配置" : "扫描本机并生成应用配置"
);

const projectList = ref<RowProjectType[]>([]);
const projectId = ref<number | null>(null);
const environment = ref<number | null>(null);
const serverOptions = ref<RowServerType[]>([]);
const targetServerIds = ref<number[]>([]);

const scanning = ref(false);
const scanProgress = ref("");
const scannedOnce = ref(false);
const groups = ref<ResultGroup[]>([]);
const selectedKeys = ref<string[]>([]);
const generating = ref(false);

const defaultScanHint = computed(() =>
  mode.value === "remote"
    ? "选择项目、环境与目标服务器后开始扫描"
    : "选择项目与环境后开始扫描"
);

const canScan = computed(() => {
  if (scanning.value) return false;
  if (!projectId.value || !environment.value) return false;
  if (mode.value === "remote" && targetServerIds.value.length === 0) return false;
  return true;
});

// ============ 服务名前缀（扫描匹配用）============

const prefixList = ref<DiscoveryPrefix[]>([]);
const prefixEditorVisible = ref(false);
const prefixLoading = ref(false);
const prefixAdding = ref(false);
const newPrefix = ref("");
const prefixEdited = ref(false);

const enabledPrefixText = computed(() => {
  const list = prefixList.value
    .filter((p) => p.enabled === 1)
    .map((p) => p.prefix);
  return list.length > 0 ? list.join("、") : "无（当前不会匹配到任何服务）";
});

const loadPrefixList = async () => {
  prefixLoading.value = true;
  try {
    await prefixDb.seedDefaults();
    const r = await prefixDb.getPrefixes();
    if (r.code === 0 && r.data)
      prefixList.value = r.data as DiscoveryPrefix[];
  } catch (e) {
    console.warn("加载服务名前缀失败:", e);
  } finally {
    prefixLoading.value = false;
  }
};

const onTogglePrefix = async (item: DiscoveryPrefix) => {
  const r = await prefixDb.upsertPrefix({ ...item });
  if (r.code !== 0) {
    ElMessage.error(r.msg);
    return;
  }
  prefixEdited.value = true;
};

const onAddPrefix = async () => {
  const value = newPrefix.value.trim();
  if (!value) {
    ElMessage.warning("请输入前缀");
    return;
  }
  if (prefixList.value.some((p) => p.prefix === value)) {
    ElMessage.warning("该前缀已存在");
    return;
  }
  prefixAdding.value = true;
  try {
    const r = await prefixDb.upsertPrefix({
      id: null,
      prefix: value,
      enabled: 1,
      isDefault: 0,
    });
    if (r.code !== 0) {
      ElMessage.error(r.msg);
      return;
    }
    newPrefix.value = "";
    await loadPrefixList();
    prefixEdited.value = true;
  } finally {
    prefixAdding.value = false;
  }
};

const onDeletePrefix = async (item: DiscoveryPrefix) => {
  const r = await prefixDb.deletePrefix(Number(item.id));
  if (r.code !== 0) {
    ElMessage.error(r.msg);
    return;
  }
  await loadPrefixList();
  prefixEdited.value = true;
};

// ============ 数据加载 ============

const getProjectList = async () => {
  const r = await projectDb.getProjectList({
    code: null,
    name: null,
    sorting: "id DESC",
    skipCount: 0,
    maxResultCount: 1000,
  });
  if (r.code !== 0) {
    ElMessage.error(r.msg);
    return;
  }
  projectList.value = r.data.data;
};

const getServerOptions = async () => {
  if (!projectId.value) {
    serverOptions.value = [];
    return;
  }
  const r = await serverDb.getServerList({
    projectId: projectId.value,
    name: null,
    sorting: "ts.id DESC",
    skipCount: 0,
    maxResultCount: 1000,
  });
  if (r.code !== 0) {
    ElMessage.error(r.msg);
    return;
  }
  serverOptions.value = r.data.data;
};

// 本机扫描的服务器记录：优先复用所选项目的「本机」，其次复用任意项目的同一台机器记录，
// 都没有才新建（本机发布需要该记录的 os 区分 Windows/Docker）
const ensureLocalServer = async (): Promise<
  { row: RowServerType; reusedFromOtherProject: boolean } | null
> => {
  // projectId 传 null 拉全量，便于跨项目复用同一台本机记录
  const listResult = await serverDb.getServerList({
    projectId: null,
    name: null,
    sorting: "ts.id DESC",
    skipCount: 0,
    maxResultCount: 1000,
  });
  if (listResult.code !== 0) {
    ElMessage.error(listResult.msg);
    return null;
  }
  const all = (listResult.data.data || []).filter(
    (s) => s.ip === "127.0.0.1" || s.name === "本机"
  );
  const sameProject = all.find(
    (s) => Number(s.projectId) === Number(projectId.value)
  );
  if (sameProject) return { row: sameProject, reusedFromOtherProject: false };
  if (all.length > 0) return { row: all[0], reusedFromOtherProject: true };

  const insertResult = await serverDb.insertServer({
    id: null,
    projectId: projectId.value,
    projectName: null,
    name: "本机",
    os: 1,
    ip: "127.0.0.1",
    port: 22,
    account: "",
    pwd: "",
    description: "扫描本机生成应用配置时自动创建",
  } as RowServerType);
  if (insertResult.code !== 0) {
    ElMessage.error(insertResult.msg);
    return null;
  }
  return {
    row: {
      id: insertResult.data,
      projectId: projectId.value,
      projectName: null,
      name: "本机",
      os: 1,
      ip: "127.0.0.1",
      port: 22,
      account: "",
      pwd: "",
      description: "扫描本机生成应用配置时自动创建",
    } as RowServerType,
    reusedFromOtherProject: false,
  };
};

// ============ 扫描 ============

const buildGroup = (
  key: string,
  serverId: number | null,
  serverName: string,
  serverAddr: string,
  items: DiscoveryItem[],
  error: string | null
): ResultGroup => ({
  key,
  serverId,
  serverName,
  serverAddr,
  error,
  items: items.map((item, idx) => ({
    key: `${key}:${idx}`,
    item,
    module: matchModule(item.serviceName),
    inferredEnv: inferServiceEnvironment(item.serviceName),
  })),
});

// 默认勾选：可识别模块 且（无环境标记 或 环境标记与所选环境一致）
const applyDefaultSelection = () => {
  const keys: string[] = [];
  for (const g of groups.value) {
    for (const it of g.items) {
      if (!it.module) continue;
      if (it.inferredEnv === null || it.inferredEnv === environment.value)
        keys.push(it.key);
    }
  }
  selectedKeys.value = keys;
};

// 已扫描后改环境：按新环境重算默认勾选（手动勾选会被覆盖，与默认规则保持一致）
const onEnvironmentChange = () => {
  if (groups.value.length === 0) return;
  applyDefaultSelection();
};

const doScanLocal = async () => {
  const items = await scanLocal();
  groups.value = [
    buildGroup("local", null, "本机", "127.0.0.1", items, discoveryError.value),
  ];
};

const doScanRemote = async () => {
  const targets = serverOptions.value.filter((s) =>
    targetServerIds.value.includes(Number(s.id))
  );
  const result: ResultGroup[] = [];
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    scanProgress.value = `正在扫描 ${i + 1}/${targets.length}：${target.name}`;
    const r = await scanRemoteOne({
      ip: `${target.ip}:${target.port}`,
      account: target.account,
      pwd: target.pwd,
    });
    result.push(
      buildGroup(
        `server-${target.id}`,
        Number(target.id),
        String(target.name),
        `${target.ip}:${target.port}`,
        r.items,
        r.error
      )
    );
    // 逐台回填，避免多台时长时间无反馈
    groups.value = [...result];
  }
};

const onScan = async () => {
  if (!canScan.value) return;
  scanning.value = true;
  scannedOnce.value = false;
  groups.value = [];
  selectedKeys.value = [];
  scanProgress.value = "正在加载服务名前缀...";
  try {
    await loadPrefixes();
    // 本次扫描用的就是当前前缀（含刚改的），提示作废
    prefixEdited.value = false;
    if (mode.value === "remote") {
      await doScanRemote();
    } else {
      scanProgress.value = "正在扫描本机...";
      await doScanLocal();
    }
    applyDefaultSelection();
    scannedOnce.value = true;
    const failedCount = groups.value.filter((g) => g.error).length;
    if (failedCount > 0 && failedCount === groups.value.length) {
      ElMessage.warning("所有目标服务器扫描失败，请检查连接信息");
    }
  } finally {
    scanning.value = false;
    scanProgress.value = "";
  }
};

// ============ 勾选 ============

const toggleItem = (key: string, val: boolean) => {
  if (val) {
    if (!selectedKeys.value.includes(key)) selectedKeys.value.push(key);
  } else {
    selectedKeys.value = selectedKeys.value.filter((k) => k !== key);
  }
};

const groupSelectedCount = (g: ResultGroup) =>
  g.items.filter((it) => selectedKeys.value.includes(it.key)).length;

// 环境标记提示文案：仅提示，不参与过滤
const envHintText = (it: ResultItem): string => {
  if (it.inferredEnv === null) return "";
  return it.inferredEnv === environment.value
    ? "匹配所选环境"
    : `疑似 ${displayEnvironment(it.inferredEnv)}`;
};

const isGroupAllSelected = (g: ResultGroup) =>
  g.items.length > 0 &&
  g.items.every((it) => !it.module || selectedKeys.value.includes(it.key));

const toggleGroupAll = (g: ResultGroup) => {
  const selectable = g.items.filter((it) => it.module);
  if (isGroupAllSelected(g)) {
    const keys = selectable.map((it) => it.key);
    selectedKeys.value = selectedKeys.value.filter((k) => !keys.includes(k));
    return;
  }
  const keys = selectable
    .map((it) => it.key)
    .filter((k) => !selectedKeys.value.includes(k));
  selectedKeys.value = [...selectedKeys.value, ...keys];
};

// ============ 生成 ============

const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const onGenerate = async () => {
  if (!projectId.value || !environment.value) {
    ElMessage.warning("请先选择项目与环境");
    return;
  }
  const picked = groups.value
    .map((g) => ({
      group: g,
      items: g.items.filter((it) => selectedKeys.value.includes(it.key) && it.module),
    }))
    .filter((x) => x.items.length > 0);
  if (picked.length === 0) {
    ElMessage.warning("请先勾选要纳入应用配置的服务");
    return;
  }

  generating.value = true;
  try {
    // 本机模式在此解析服务器记录（只扫描不生成时不写入服务器表）
    const resolvedGroups: {
      group: ResultGroup;
      serverId: number;
      serverName: string;
    }[] = [];
    let reusedLocalFromOtherProject: RowServerType | null = null;
    for (const { group, items } of picked) {
      let serverId = group.serverId;
      let serverName = group.serverName;
      if (serverId == null) {
        const local = await ensureLocalServer();
        if (!local || local.row.id == null) return;
        if (local.reusedFromOtherProject) reusedLocalFromOtherProject = local.row;
        serverId = Number(local.row.id);
        serverName = String(local.row.name);
      }
      resolvedGroups.push({
        group: { ...group, items },
        serverId,
        serverName,
      });
    }

    const existResult = await appconfigDb.getPublishAppconfigs(
      projectId.value,
      environment.value
    );
    const existing =
      existResult.code === 0 && existResult.data?.data?.id
        ? existResult.data.data
        : null;
    // 以完整骨架为底，再并入已有配置的模块字段：缺字段会让应用配置弹窗打开时报错
    const configItems = createEmptyConfigItems();
    if (existing && existing.configItems) {
      const saved = JSON.parse(JSON.stringify(existing.configItems));
      for (const key of Object.keys(saved)) {
        const value = saved[key];
        configItems[key] =
          value && typeof value === "object" && !Array.isArray(value)
            ? { ...(configItems[key] || {}), ...value }
            : value;
      }
    }

    let added = 0;
    let duplicated = 0;
    for (const { group, serverId, serverName } of resolvedGroups) {
      const pickedItems = group.items
        .filter((it) => it.module)
        .map((it) => ({ item: it.item, module: it.module! }));
      const addedCount = mergeServicesIntoConfigItems(
        configItems,
        serverId,
        serverName,
        pickedItems
      );
      added += addedCount;
      duplicated += pickedItems.length - addedCount;
    }

    const unmappedCount = groups.value.reduce(
      (sum, g) => sum + g.items.filter((it) => !it.module).length,
      0
    );
    const failedServers = groups.value.filter((g) => g.error);

    const configItemsJson = JSON.stringify(configItems);
    const saveResult = existing
      ? await appconfigDb.updateAppconfig({
          ...existing,
          configItemsJson,
          configItems: configItems as ConfigItemsType,
        })
      : await appconfigDb.insertAppconfig({
          id: null,
          projectId: projectId.value,
          projectName: null,
          environment: environment.value,
          msBuildPath: null,
          dllMode: "全部",
          dllModeValue: null,
          buildMode: "Debug",
          configItemsJson,
          configItems: configItems as ConfigItemsType,
        });
    if (saveResult.code !== 0) {
      ElMessage.error(saveResult.msg || "保存应用配置失败");
      return;
    }

    const envLabel = displayEnvironment(environment.value);
    const lines: string[] = [];
    lines.push(
      `已${existing ? "更新" : "创建"}应用配置：<b>${escapeHtml(
        projectList.value?.find((p) => p.id === projectId.value)?.name || ""
      )} - ${envLabel}</b>`
    );
    lines.push(`新增服务 ${added} 项`);
    if (duplicated > 0) lines.push(`跳过 ${duplicated} 项（同名服务标识已存在）`);
    if (unmappedCount > 0)
      lines.push(`未纳入 ${unmappedCount} 项（未识别所属模块）`);
    const noHostPath = resolvedGroups.reduce(
      (sum, { group }) =>
        sum +
        group.items.filter((it) => it.module && !it.item.suggestedPublishPath)
          .length,
      0
    );
    if (noHostPath > 0)
      lines.push(
        `其中 ${noHostPath} 项无宿主机挂载路径，请在应用配置中手动填写发布路径`
      );
    if (failedServers.length > 0)
      lines.push(
        `<b>扫描失败的服务器（未纳入）：</b>${failedServers
          .map((g) => `${escapeHtml(g.serverName)}（${escapeHtml(g.error || "")}）`)
          .join("、")}`
      );
    if (reusedLocalFromOtherProject) {
      const localRow: RowServerType = reusedLocalFromOtherProject;
      const owner =
        projectList.value?.find(
          (p) => p.id === Number(localRow.projectId)
        )?.name || "其他项目";
      lines.push(
        `本机记录「${escapeHtml(
          String(localRow.name)
        )}」属于项目「${escapeHtml(owner)}」，本次配置沿用该记录`
      );
    }

    visible.value = false;
    emit("refresh");
    ElMessageBox.alert(lines.join("<br/>"), "生成结果", {
      confirmButtonText: "知道了",
      dangerouslyUseHTMLString: true,
    });
  } finally {
    generating.value = false;
  }
};

// ============ 入口 ============

const onProjectChange = async () => {
  targetServerIds.value = [];
  groups.value = [];
  selectedKeys.value = [];
  scannedOnce.value = false;
  await getServerOptions();
};

const openDialog = async (
  scanMode: "local" | "remote",
  presetProjectId: number | null = null
) => {
  mode.value = scanMode;
  projectId.value = presetProjectId ?? null;
  environment.value = null;
  targetServerIds.value = [];
  groups.value = [];
  selectedKeys.value = [];
  scannedOnce.value = false;
  scanning.value = false;
  generating.value = false;
  scanProgress.value = "";
  prefixEditorVisible.value = false;
  prefixEdited.value = false;
  newPrefix.value = "";
  await getProjectList();
  await getServerOptions();
  await loadPrefixList();
  visible.value = true;
};

defineExpose({ openDialog });
</script>

<style scoped lang="scss">
.discovery-import {
  .discovery-prefix {
    width: 100%;
  }
  .discovery-prefix-summary {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 4px;
    font-size: 13px;
  }
  .discovery-prefix-editor {
    margin-top: 8px;
    padding: 8px;
    border: 1px dashed var(--el-border-color);
    border-radius: 4px;
  }
  .discovery-prefix-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 14px;
    margin-bottom: 8px;
  }
  .discovery-prefix-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .discovery-prefix-default {
    margin-left: 4px;
    font-size: 11px;
    opacity: 0.7;
  }
  .discovery-prefix-add {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .discovery-prefix-tip {
    margin-top: 6px;
    font-size: 12px;
    color: var(--el-color-warning);
  }
  .discovery-scan-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 4px 0 12px;
  }
  .discovery-scan-hint {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
  .discovery-groups {
    // 多台服务器 / 服务较多时内部滚动，避免弹窗超出视口
    max-height: 46vh;
    overflow-y: auto;
    padding-right: 4px;
  }
  .discovery-group {
    margin-bottom: 10px;
  }
  .discovery-group-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .discovery-group-name {
    font-weight: 600;
    word-break: break-all;
  }
  .discovery-group-addr {
    font-weight: 400;
    color: var(--el-text-color-secondary);
  }
  .discovery-group-stat {
    margin-left: auto;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
  .discovery-item {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    padding: 8px 0;
    border-top: 1px solid var(--el-border-color-lighter);

    &:first-child {
      border-top: none;
    }
  }
  .discovery-item-body {
    flex: 1;
    min-width: 0;
  }
  .discovery-item-name {
    font-weight: 600;
    word-break: break-all;
  }
  .discovery-item-sub {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
  .discovery-item-path {
    margin-top: 4px;
    font-size: 12px;
    word-break: break-all;
  }
  .discovery-item-label {
    color: var(--el-text-color-secondary);
  }
  .discovery-item-tags {
    margin-top: 4px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }
  .discovery-item-image {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    word-break: break-all;
  }
  .discovery-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .discovery-footer-stat {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}
</style>

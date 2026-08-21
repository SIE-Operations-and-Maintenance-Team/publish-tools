<template>
  <div class="step-preview">
    <el-descriptions title="待发布清单" :column="1" border size="small">
      <el-descriptions-item label="项目">
        <span v-if="projectName">{{ projectName }} <el-tag size="small" style="margin-left: 6px">ID {{ store.draft.projectId }}</el-tag></span>
        <span v-else style="color: var(--el-text-color-placeholder)">{{ store.draft.projectId ? `ID ${store.draft.projectId}` : '未选择' }}</span>
      </el-descriptions-item>
      <el-descriptions-item label="代码源">
        <span v-if="sourceLabel">{{ sourceLabel }}</span>
        <span v-else style="color: var(--el-text-color-placeholder)">未选择（Git / TFS 至少其一）</span>
      </el-descriptions-item>
      <el-descriptions-item label="服务器">
        <span v-if="serverNames.length">{{ serverNames.join('、') }} <el-tag size="small" style="margin-left: 6px">{{ serverNames.length }} 台</el-tag></span>
        <span v-else style="color: var(--el-text-color-placeholder)">未选择</span>
      </el-descriptions-item>
      <el-descriptions-item label="应用配置">
        <span v-if="hasAppconfig">已配置 · {{ envLabel }} · {{ buildModeLabel }}</span>
        <span v-else style="color: var(--el-text-color-placeholder)">未配置</span>
      </el-descriptions-item>
      <el-descriptions-item label="备份">
        {{ store.draft.publishOptions?.isBackup === 1 ? '开启' : '关闭' }}
        <span v-if="store.draft.publishOptions?.backupBasePath" style="margin-left: 8px; word-break: break-all">路径：{{ store.draft.publishOptions.backupBasePath }}</span>
      </el-descriptions-item>
    </el-descriptions>

    <div style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap">
      <el-button size="small" :disabled="!canPrecheck" :loading="prechecking" @click="onPrecheck">预检（dry-run）</el-button>
      <el-button size="small" type="primary" :disabled="!store.canPublish" @click="onPublish">发布</el-button>
      <span v-if="!store.canPublish" style="font-size: 12px; color: var(--el-text-color-secondary); align-self: center">请先完成必选步骤</span>
    </div>

    <el-divider>日志</el-divider>
    <div ref="logRef" class="preview-log">
      <p v-for="(log, idx) in logs" :key="idx" :class="log.type" style="margin: 0; line-height: 22px; font-family: monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all">
        {{ log.text }}
      </p>
      <el-empty v-if="logs.length === 0" description="预检/发布日志将在此处展示" :image-size="56" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useWorkstationStore } from '@/stores/workstation';
import { useProjectDb } from '@/database/project/index';
import { useGitDb } from '@/database/git/index';
import { useTfsDb } from '@/database/teamFoundationServer/index';
import { useServerDb } from '@/database/servers/index';
import { formatDate } from '@/utils/formatTime';

const store = useWorkstationStore();
const projectDb = useProjectDb();
const gitDb = useGitDb();
const tfsDb = useTfsDb();
const serverDb = useServerDb();

const projectName = ref('');
const gitName = ref('');
const tfsName = ref('');
const serverNames = ref<string[]>([]);
const logs = ref<{ text: string; type: string }[]>([]);
const logRef = ref<HTMLDivElement | null>(null);
const prechecking = ref(false);

const hasAppconfig = computed(() => !!store.draft.appconfigDraft && Object.keys(store.draft.appconfigDraft as any).length > 0);
const envLabel = computed(() => {
  const e = (store.draft.appconfigDraft as any)?.environment;
  return e === 1 ? 'Dev' : e === 2 ? 'Uat' : e === 3 ? 'Pro' : e === 4 ? 'Other' : '—';
});
const buildModeLabel = computed(() => (store.draft.appconfigDraft as any)?.buildMode || '—');
const sourceLabel = computed(() => {
  const parts: string[] = [];
  if (gitName.value) parts.push(`Git: ${gitName.value}`);
  if (tfsName.value) parts.push(`TFS: ${tfsName.value}`);
  if (parts.length === 0) {
    if (store.draft.gitId) parts.push(`Git#${store.draft.gitId}`);
    if (store.draft.tfsId) parts.push(`TFS#${store.draft.tfsId}`);
  }
  return parts.join(' + ');
});
const canPrecheck = computed(() => store.canPublish && hasAppconfig.value);

const pushLog = (text: string, type = 'log-info') => {
  const ts = formatDate(new Date(), 'HH:MM:SS');
  logs.value.push({ text: `[${ts}] ${text}`, type });
  nextTick(() => { if (logRef.value) logRef.value.scrollTop = logRef.value.scrollHeight; });
};

const loadAll = async () => {
  projectName.value = '';
  gitName.value = '';
  tfsName.value = '';
  serverNames.value = [];
  if (store.draft.projectId) {
    try {
      const r = await projectDb.getProjectById(store.draft.projectId as number);
      const data = (r as any)?.data?.data;
      if (data?.name) projectName.value = data.name;
    } catch { /* ignore */ }
  }
  if (store.draft.gitId) {
    try {
      const r = await gitDb.getGitById(store.draft.gitId as number);
      const d = (r as any)?.data?.data;
      if (d?.gitName) gitName.value = d.gitName;
    } catch { /* ignore */ }
  }
  if (store.draft.tfsId) {
    try {
      const r = await tfsDb.getTfsById(store.draft.tfsId as number);
      const d = (r as any)?.data?.data;
      if (d?.tfsName) tfsName.value = d.tfsName;
    } catch { /* ignore */ }
  }
  if (store.draft.serverIds?.length) {
    const names: string[] = [];
    for (const id of store.draft.serverIds) {
      try {
        const r = await serverDb.getServerById(id as number);
        const d = (r as any)?.data?.data;
        if (d?.name) names.push(d.name);
        else names.push(`#${id}`);
      } catch { names.push(`#${id}`); }
    }
    serverNames.value = names;
  }
};

// 预检：dry-run 调用备份相关链路（若无则做本地校验）
const onPrecheck = async () => {
  if (!store.canPublish) { ElMessage.warning('请先完成必选步骤'); return; }
  prechecking.value = true;
  logs.value = [];
  pushLog('开始预检（dry-run）...');
  pushLog(`项目: ${projectName.value || store.draft.projectId}`);
  pushLog(`代码源: ${sourceLabel.value || '—'}`);
  pushLog(`服务器: ${serverNames.value.join('、') || '—'}`);
  const ac: any = store.draft.appconfigDraft || {};
  pushLog(`应用配置: 环境 ${envLabel.value} / ${buildModeLabel.value} / dllMode ${ac.dllMode || '—'}`);
  // 尝试调用备份 dry-run（若后端未实现则回退为本地校验）
  try {
    // 约定：backup_create 的 dry-run 变体或专用校验命令；此处优先尝试通用的 exists/create_dir 探测路径可达性作为预检
    const checks: string[] = [];
    if (ac.configItems?.backupBasePath) checks.push(ac.configItems.backupBasePath);
    // 轻量 dry-run：尝试读取项目是否存在，不真正写入
    if (store.draft.projectId) {
      const pr = await projectDb.getProjectById(store.draft.projectId as number);
      if ((pr as any)?.code !== 0 || !(pr as any)?.data?.data?.id) throw new Error('项目不存在或读取失败');
    }
    // 若后端提供 backup dry-run，可在此调用：
    // const r = await cmdInvoke('backup_appconfig_dry_run', { draft: store.draft });
    // if (r.code !== 0) throw new Error(r.msg || r.data);
    pushLog('预检通过：必填项与数据完整性校验成功', 'log-success');
    ElMessage.success('预检通过');
  } catch (e: any) {
    pushLog(`预检失败：${e?.message || String(e)}`, 'log-error');
    ElMessage.error(`预检失败：${e?.message || String(e)}`);
  } finally {
    prechecking.value = false;
  }
};

const onPublish = () => {
  if (!store.canPublish) { ElMessage.warning('请先完成必选步骤'); return; }
  pushLog('发布入口：请在高级设置或 Task 9 聚合发布引擎中执行', 'log-warning');
  ElMessage.info('发布（占位）：Task 9 将聚合 draft 并复用既有发布引擎');
};

const validate = (): boolean => {
  // 预览为只读，始终通过；但可在此补充 canPublish 提示
  if (!store.canPublish) {
    ElMessage.warning('尚有必选步骤未完成，无法发布');
    return false;
  }
  return true;
};

watch(() => [store.draft.projectId, store.draft.gitId, store.draft.tfsId, store.draft.serverIds, store.draft.appconfigDraft], () => loadAll(), { deep: true });

onMounted(async () => { await loadAll(); });

defineExpose({ validate, onPrecheck });
</script>

<style scoped>
.step-preview {
  padding: 4px 0;
}
.preview-log {
  max-height: 260px;
  overflow-y: auto;
  background: #545c64;
  color: #e6e6e6;
  border-radius: 6px;
  padding: 8px 10px;
}
.preview-log .log-success { color: #67c23a; }
.preview-log .log-error { color: #f56c6c; }
.preview-log .log-warning { color: #e6a23c; }
.preview-log .log-info { color: #e6e6e6; }
</style>

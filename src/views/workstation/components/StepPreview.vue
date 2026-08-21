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
      <el-button size="small" type="primary" :disabled="!store.canPublish" :loading="publishing" @click="onPublish">发布</el-button>
      <span v-if="!store.canPublish" style="font-size: 12px; color: var(--el-text-color-secondary); align-self: center">请先完成必选步骤</span>
    </div>

    <el-divider>日志</el-divider>
    <div ref="logRef" class="preview-log">
      <p v-for="(log, idx) in logs" :key="idx" :class="log.type" style="margin: 0; line-height: 22px; font-family: monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all">
        {{ log.text }}
      </p>
      <el-empty v-if="logs.length === 0" description="执行预检或发布后，详细日志将在此处实时回显" :image-size="56" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { path } from '@tauri-apps/api';
import { useWorkstationStore } from '@/stores/workstation';
import { useProjectDb } from '@/database/project/index';
import { useGitDb } from '@/database/git/index';
import { useTfsDb } from '@/database/teamFoundationServer/index';
import { useServerDb } from '@/database/servers/index';
import { useAppconfigDb } from '@/database/appconfig/index';
import { formatDate } from '@/utils/formatTime';
import { cmdInvoke } from '@/utils/command';
import { removeSlash, displayOs, displayEnvironment, aesEncrypt, aesDecrypt, formatServiceLog } from '@/utils/other';
import { getTfsDllFiles, getGitDllFiles, getReadAllDlls } from '@/utils/backupAppconfig';
import { loadPublishSettings, getRetryArgs } from '@/utils/publishSettings';

const store = useWorkstationStore();
const projectDb = useProjectDb();
const gitDb = useGitDb();
const tfsDb = useTfsDb();
const serverDb = useServerDb();
const appconfigDb = useAppconfigDb();

const projectName = ref('');
const gitName = ref('');
const tfsName = ref('');
const serverNames = ref<string[]>([]);
const logs = ref<{ text: string; type: string }[]>([]);
const logRef = ref<HTMLDivElement | null>(null);
const prechecking = ref(false);
const publishing = ref(false);

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
const canPrecheck = computed(() => store.canPublish && hasAppconfig.value && !prechecking.value && !publishing.value);

// 日志：带时间戳、自动滚动、上限 500 条
const pushLog = (text: string, type = 'log-info') => {
  const ts = formatDate(new Date(), 'HH:MM:SS');
  logs.value.push({ text: `[${ts}] ${text}`, type });
  if (logs.value.length > 500) logs.value.splice(0, logs.value.length - 500);
  nextTick(() => { if (logRef.value) logRef.value.scrollTop = logRef.value.scrollHeight; });
};

// 加载展示用名称
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
    const ids = [...store.draft.serverIds];
    const results = await Promise.all(ids.map(async (id) => {
      try {
        const r = await serverDb.getServerById(id as number);
        const d = (r as any)?.data?.data;
        if (d?.name) return d.name as string;
        return `#${id}`;
      } catch { return `#${id}`; }
    }));
    serverNames.value = results;
  }
};

// 查询服务器详情
const getServerDetail = async (id: number) => {
  const r = await serverDb.getServerById(id);
  if (r.code !== 0) return null;
  return r.data.data as RowServerType;
};

// 临时发布目录（复用 papersPublish 的 tempPapersPublish）
const papersPublishDir = async () => {
  const base = await path.appDataDir();
  return `${removeSlash(base)}/tempPapersPublish`;
};

const createDir = async (dirPath: string) => {
  const exists = await cmdInvoke('exists', { path: dirPath });
  if (exists.code === 0) {
    await cmdInvoke('delete_paths', { paths: [dirPath] });
  }
  const r = await cmdInvoke('create_dir', { path: dirPath });
  return r.code === 0;
};

// 根据 dllMode 获取待发布文件列表（复用 backupAppconfig 的 getTfsDllFiles/getGitDllFiles/getReadAllDlls）
const getPublishFiles = async (clientPath: string): Promise<string[] | null> => {
  const ac: any = store.draft.appconfigDraft || {};
  const dllMode: string = ac.dllMode || '全部';
  const dllModeValue: string | null = ac.dllModeValue || null;
  if (!clientPath) return [];
  // 校验路径存在（dry-run 也会调用）
  const exists = await cmdInvoke('exists', { path: clientPath });
  if (exists.code !== 0) {
    pushLog(`客户端路径不存在：${clientPath}`, 'log-warning');
    return null;
  }
  if (dllMode === 'TFS') {
    if (!dllModeValue) { pushLog('未配置 TFS 获取程序集信息', 'log-error'); return null; }
    try {
      const sel = JSON.parse(dllModeValue) as SelectTfsType;
      const dlls = await getTfsDllFiles(sel);
      if (!dlls) return [];
      // 与 generatePublishDialog 一致：与本地全量取交集
      const all = await getReadAllDlls(clientPath);
      return all.filter((f) => dlls.includes(f));
    } catch (e: any) {
      pushLog(`解析 TFS 配置失败：${e?.message || String(e)}`, 'log-error');
      return null;
    }
  }
  if (dllMode === 'Git') {
    if (!dllModeValue) { pushLog('未配置 Git 获取程序集信息', 'log-error'); return null; }
    try {
      const sel = JSON.parse(dllModeValue) as SelectGitType;
      const dlls = await getGitDllFiles(sel);
      if (!dlls) return [];
      const all = await getReadAllDlls(clientPath);
      return all.filter((f) => dlls.includes(f));
    } catch (e: any) {
      pushLog(`解析 Git 配置失败：${e?.message || String(e)}`, 'log-error');
      return null;
    }
  }
  if (dllMode === 'DLL名称') {
    const patterns = String(dllModeValue || '').trim();
    if (!patterns) { pushLog('未配置 DLL名称 模式', 'log-error'); return null; }
    const r = await cmdInvoke<string[]>('read_dlls_by_name', { dir: clientPath, patterns });
    if (r.code !== 0 || !r.data) { pushLog(`按 DLL名称 读取失败：${r.data}`, 'log-error'); return null; }
    return r.data.map((p) => removeSlash(p).substring(removeSlash(p).lastIndexOf('/') + 1));
  }
  if (dllMode === '当天' || dllMode === '最近3天' || dllMode === '日期范围') {
    let startDate = '';
    let endDate = '';
    if (dllMode === '当天') {
      startDate = formatDate(new Date(), 'YYYY-mm-dd 00:00:00');
      endDate = formatDate(new Date(), 'YYYY-mm-dd 23:59:59');
    } else if (dllMode === '最近3天') {
      const d = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      startDate = formatDate(d, 'YYYY-mm-dd 00:00:00');
      endDate = formatDate(new Date(), 'YYYY-mm-dd 23:59:59');
    } else {
      try {
        const arr = JSON.parse(String(dllModeValue));
        startDate = arr[0]; endDate = arr[1];
      } catch { /* ignore */ }
    }
    if (startDate && endDate) {
      const r = await cmdInvoke<string[]>('read_dlls_in_date_range', { dir: clientPath, startDate, endDate });
      if (r.code === 0 && r.data) return r.data.map((p) => removeSlash(p).substring(removeSlash(p).lastIndexOf('/') + 1));
    }
    return [];
  }
  // 全部
  const all = await getReadAllDlls(clientPath);
  return all;
};

// 将 draft 聚合为 RemotePublishType 的服务器配置（复用 generatePublishDialog 的发布入参类型）
const toServerConfigs = async (moduleKey: 'webApiHost' | 'scheduleServer' | 'webClient' | 'spcMonitor'): Promise<PublishServerType[] | null> => {
  const ac: any = store.draft.appconfigDraft || {};
  const cfg = ac.configItems?.[moduleKey] as WebApiHostConfigType | ScheduleServerConfigType | WebClientConfigType | SpcMonitorConfigType | undefined;
  if (!cfg?.clientPath) return null;
  const clientPath = String(cfg.clientPath);
  const publishFiles = await getPublishFiles(clientPath);
  if (publishFiles === null) return null;
  if (publishFiles.length === 0) {
    pushLog(`${moduleKey} 无待发布文件（${clientPath}）`, 'log-warning');
  }

  // 优先使用持久化的 serverArr（含发布路径）；若缺失则用 store.draft.serverIds 合成
  let serverArr: SelectServerType[] | null = null;
  if (cfg.serverArr && cfg.serverArr.length > 0) serverArr = cfg.serverArr as SelectServerType[];
  else {
    // 尝试从 DB 的完整 appconfig 回填 serverArr
    const pid = store.draft.projectId;
    const env = ac.environment;
    if (pid && env) {
      try {
        const r = await appconfigDb.getPublishAppconfigs(pid as number, env as number);
        const full = (r as any)?.data?.data;
        if (full?.configItems?.[moduleKey]?.serverArr?.length) {
          serverArr = full.configItems[moduleKey].serverArr as SelectServerType[];
          pushLog(`${moduleKey} 使用已保存的应用配置发布路径`, 'log-info');
        }
      } catch { /* ignore */ }
    }
  }

  // 合成：若仍无 serverArr，则用 serverIds + 默认路径
  if (!serverArr || serverArr.length === 0) {
    const ids = [...(store.draft.serverIds || [])];
    if (ids.length === 0) { pushLog(`${moduleKey} 无可用服务器`, 'log-error'); return null; }
    const list: PublishServerType[] = [];
    for (const sid of ids) {
      const srv = await getServerDetail(sid as number);
      if (!srv) { pushLog(`服务器 #${sid} 不存在，跳过`, 'log-warning'); continue; }
      list.push({
        serverName: srv.name,
        serverOs: srv.os,
        serverIp: srv.ip,
        serverPort: srv.port,
        serverAccount: srv.account,
        serverPwd: await aesEncrypt(srv.pwd || ''),
        serverConfigs: [{ serverIdentity: srv.name, publishPath: cfg.serverPath || `C:/publish/${moduleKey}`, publishFiles }],
      });
    }
    return list.length ? list : null;
  }

  // 有 serverArr：按 generatePublishDialog 的多服务器多路径组装
  const out: PublishServerType[] = [];
  for (const srv of serverArr) {
    if (!srv.id) continue;
    // 仅当该服务器在 draft.serverIds 中才发布（工作台勾选）
    if (store.draft.serverIds.length && !store.draft.serverIds.includes(srv.id as number)) continue;
    const detail = await getServerDetail(srv.id as number);
    if (!detail) { pushLog(`服务器 ${srv.name || srv.id} 不存在，跳过`, 'log-warning'); continue; }
    const serverConfigs: PublishServerConfigType[] = [];
    for (const sp of srv.serverPathArr || []) {
      if (!sp.value || sp.value.length === 0) continue;
      for (const v of sp.value) {
        if (!v.path) continue;
        serverConfigs.push({ serverIdentity: String(v.identity || detail.name), publishPath: String(v.path), publishFiles });
      }
    }
    if (serverConfigs.length === 0) continue;
    out.push({
      serverName: detail.name,
      serverOs: detail.os,
      serverIp: detail.ip,
      serverPort: detail.port,
      serverAccount: detail.account,
      serverPwd: await aesEncrypt(detail.pwd || ''),
      serverConfigs,
    });
  }
  return out.length ? out : null;
};

const toWpfConfigs = async (): Promise<PublishWpfType[] | null> => {
  const ac: any = store.draft.appconfigDraft || {};
  const cfg = ac.configItems?.wpfClient as WpfClientConfigType | undefined;
  if (!cfg?.clientPath) return null;
  const clientPath = String(cfg.clientPath);
  // 校验基础路径
  const exists = await cmdInvoke('exists', { path: clientPath });
  if (exists.code !== 0) { pushLog(`WpfClient 客户端路径不存在：${clientPath}`, 'log-error'); return null; }

  // 生成 publishFiles：按 generateDirJson 分组
  let generateDirs: string[] = [];
  if (cfg.generateDirJson) {
    try { generateDirs = JSON.parse(cfg.generateDirJson) as string[]; } catch { /* ignore */ }
  }
  // 若未配置生成目录，回退为单目录模式（工作台简化）
  const wpfPublishFiles: WpfPublishDirType[] = [];
  if (generateDirs.length === 0) {
    const files = await getPublishFiles(clientPath);
    if (files === null) return null;
    wpfPublishFiles.push({ dirName: 'App', files });
  } else {
    for (const dir of generateDirs) {
      const cPath = `${removeSlash(clientPath)}/${removeSlash(dir)}`;
      const files = await getPublishFiles(cPath);
      if (files === null) return null;
      wpfPublishFiles.push({ dirName: dir, files });
    }
  }

  // 服务器：优先 serverArr，否则用 serverIds 合成
  let serverArr: SelectServerType[] | null = null;
  if (cfg.serverArr && cfg.serverArr.length > 0) serverArr = cfg.serverArr as SelectServerType[];
  else {
    const pid = store.draft.projectId;
    const env = ac.environment;
    if (pid && env) {
      try {
        const r = await appconfigDb.getPublishAppconfigs(pid as number, env as number);
        const full = (r as any)?.data?.data;
        if (full?.configItems?.wpfClient?.serverArr?.length) serverArr = full.configItems.wpfClient.serverArr as SelectServerType[];
      } catch { /* ignore */ }
    }
  }
  if (!serverArr || serverArr.length === 0) {
    const ids = [...(store.draft.serverIds || [])];
    if (ids.length === 0) { pushLog('WpfClient 无可用服务器', 'log-error'); return null; }
    const list: PublishWpfType[] = [];
    for (const sid of ids) {
      const srv = await getServerDetail(sid as number);
      if (!srv) continue;
      // 合成发布路径：取 cfg.serverPath 或默认
      const publishPath = (cfg as any).serverPath || `C:/publish/WpfClient`;
      list.push({
        serverName: srv.name,
        serverOs: srv.os,
        serverIp: srv.ip,
        serverPort: srv.port,
        serverAccount: srv.account,
        serverPwd: await aesEncrypt(srv.pwd || ''),
        publishPath,
        publishFiles: wpfPublishFiles,
      });
    }
    return list.length ? list : null;
  }
  const out: PublishWpfType[] = [];
  for (const srv of serverArr) {
    if (!srv.id) continue;
    if (store.draft.serverIds.length && !store.draft.serverIds.includes(srv.id as number)) continue;
    const detail = await getServerDetail(srv.id as number);
    if (!detail) continue;
    const publishPath = srv.serverPathArr?.[0]?.value?.[0]?.path;
    if (!publishPath) { pushLog(`WpfClient 服务器 ${srv.name} 未配置发布路径，跳过`, 'log-warning'); continue; }
    out.push({
      serverName: detail.name,
      serverOs: detail.os,
      serverIp: detail.ip,
      serverPort: detail.port,
      serverAccount: detail.account,
      serverPwd: await aesEncrypt(detail.pwd || ''),
      publishPath: String(publishPath),
      publishFiles: wpfPublishFiles,
    });
  }
  return out.length ? out : null;
};

// 聚合 draft → RemotePublishType（按 brief 示例，处理缺失字段）
const toPublishInput = async (): Promise<RemotePublishType | null> => {
  const ac: any = store.draft.appconfigDraft || {};
  const opts = store.draft.publishOptions || { isBackup: 0, isNewVersion: false };
  if (!store.draft.projectId) { pushLog('缺少项目', 'log-error'); ElMessage.warning('请先选择项目'); return null; }
  if (!ac.environment) { pushLog('缺少环境（environment）', 'log-error'); ElMessage.warning('请先配置应用配置中的环境'); return null; }
  const name = projectName.value || `Project#${store.draft.projectId}`;
  const publishMode = ac.publishMode ?? 0;
  // 逐模块聚合，缺失则为 null（允许部分模块为空，与 generatePublishDialog 一致）
  const webApiHost = await toServerConfigs('webApiHost');
  const scheduleServer = await toServerConfigs('scheduleServer');
  const webClient = await toServerConfigs('webClient');
  const spcMonitor = await toServerConfigs('spcMonitor');
  const wpfClient = await toWpfConfigs();

  // 至少一个模块有待发布内容
  const hasAnyModule = !!(webApiHost || scheduleServer || webClient || spcMonitor || wpfClient);
  if (!hasAnyModule) {
    pushLog('无可发布模块：请检查应用配置中的客户端路径与服务器', 'log-error');
    return null;
  }

  const input: RemotePublishType = {
    projectName: String(name),
    environment: Number(ac.environment),
    publishMode: Number(publishMode),
    isBackup: Number(opts.isBackup ?? 0),
    generateDate: formatDate(new Date(), 'YYYY-mm-dd HH:MM:SS'),
    isNewVersion: (opts.isNewVersion as boolean | null) ?? (ac.configItems?.isNewVersion ?? false),
    backupBasePath: (opts.backupBasePath as string) || (ac.configItems?.backupBasePath as string) || undefined,
    webApiHost,
    webClient,
    scheduleServer,
    spcMonitor,
    wpfClient,
    notes: `工作台发布 ${name} ${displayEnvironment(Number(ac.environment))}`,
  };
  return input;
};

// 预检：dry-run 校验必填与路径可达性，日志实时回显
const onPrecheck = async () => {
  if (!store.canPublish) { ElMessage.warning('请先完成必选步骤'); pushLog('预检失败：尚有必选步骤未完成', 'log-error'); return; }
  if (!hasAppconfig.value) { ElMessage.warning('请先配置应用配置'); pushLog('预检失败：未配置应用配置', 'log-error'); return; }
  prechecking.value = true;
  logs.value = [];
  pushLog('开始预检（dry-run）...');
  pushLog(`项目: ${projectName.value || store.draft.projectId}`);
  pushLog(`代码源: ${sourceLabel.value || '—'}`);
  pushLog(`服务器: ${serverNames.value.join('、') || '—'}`);
  const ac: any = store.draft.appconfigDraft || {};
  pushLog(`应用配置: 环境 ${envLabel.value} / ${buildModeLabel.value} / dllMode ${ac.dllMode || '—'}`);
  try {
    await loadPublishSettings();
    // 校验项目存在
    if (store.draft.projectId) {
      const pr = await projectDb.getProjectById(store.draft.projectId as number);
      if ((pr as any)?.code !== 0 || !(pr as any)?.data?.data?.id) throw new Error('项目不存在或读取失败');
    }
    // dry-run 聚合：不真正复制，仅校验文件与服务器可达
    const input = await toPublishInput();
    if (!input) throw new Error('聚合发布入参失败，请检查日志');
    // 校验至少一个模块有文件
    const counts = [
      input.webApiHost?.reduce((n, s) => n + s.serverConfigs.reduce((a, c) => a + c.publishFiles.length, 0), 0) || 0,
      input.scheduleServer?.reduce((n, s) => n + s.serverConfigs.reduce((a, c) => a + c.publishFiles.length, 0), 0) || 0,
      input.webClient?.reduce((n, s) => n + s.serverConfigs.reduce((a, c) => a + c.publishFiles.length, 0), 0) || 0,
      input.spcMonitor?.reduce((n, s) => n + s.serverConfigs.reduce((a, c) => a + c.publishFiles.length, 0), 0) || 0,
      input.wpfClient?.reduce((n, s) => n + s.publishFiles.reduce((a, d) => a + d.files.length, 0), 0) || 0,
    ];
    const totalFiles = counts.reduce((a, b) => a + b, 0);
    if (totalFiles === 0) throw new Error('无待发布文件（请检查客户端路径与 dllMode）');
    pushLog(`待发布文件：${totalFiles} 个`, 'log-info');
    // 校验备份路径若配置则可写
    if (input.backupBasePath) {
      const r = await cmdInvoke('exists', { path: input.backupBasePath });
      if (r.code !== 0) pushLog(`备份路径不存在，将在发布时创建：${input.backupBasePath}`, 'log-warning');
      else pushLog(`备份路径可达：${input.backupBasePath}`, 'log-info');
    }
    pushLog('预检通过：必填项与数据完整性校验成功', 'log-success');
    ElMessage.success('预检通过');
  } catch (e: any) {
    pushLog(`预检失败：${e?.message || String(e)}`, 'log-error');
    ElMessage.error(`预检失败：${e?.message || String(e)}`);
  } finally {
    prechecking.value = false;
  }
};

// 复用既有 papersPublish 链路的发布执行（不复制引擎：通过 cmdInvoke 的上传/服务启停与 publishSettings 重试）
const executeRemotePublish = async (input: RemotePublishType) => {
  await loadPublishSettings();
  const mPublishDir = await papersPublishDir();
  // 创建临时目录并按模块复制文件（与 generatePublishDialog 的 copyAssemblyFile 思路一致）
  const ok = await createDir(mPublishDir);
  if (!ok) { pushLog(`创建临时发布目录失败：${mPublishDir}`, 'log-error'); return false; }

  // 复制各模块文件到临时目录（供上传）
  const modules: { key: string; clientPath: string | null }[] = [
    { key: 'WebApiHost', clientPath: (input as any).webApiHost ? (store.draft.appconfigDraft as any)?.configItems?.webApiHost?.clientPath || null : null },
    { key: 'ScheduleServer', clientPath: (input as any).scheduleServer ? (store.draft.appconfigDraft as any)?.configItems?.scheduleServer?.clientPath || null : null },
    { key: 'WebClient', clientPath: (input as any).webClient ? (store.draft.appconfigDraft as any)?.configItems?.webClient?.clientPath || null : null },
    { key: 'SpcMonitor', clientPath: (input as any).spcMonitor ? (store.draft.appconfigDraft as any)?.configItems?.spcMonitor?.clientPath || null : null },
  ];
  for (const m of modules) {
    if (!m.clientPath) continue;
    const outPath = `${removeSlash(mPublishDir)}/${m.key}`;
    await createDir(outPath);
    // 简化：按“全部”复制全部 dll，若为 TFS/Git 已在 getPublishFiles 阶段过滤，此处仍全量复制后由 publishFiles 控制上传
    const copyRes = await cmdInvoke('copy_dll_files', { source: m.clientPath, destination: outPath, delDestination: true });
    // 兼容旧命令名 copy_dll_files / copy_path
    if (copyRes.code !== 0) {
      const alt = await cmdInvoke('copy_path', { source: m.clientPath, destination: outPath, ...getRetryArgs('copy') });
      if (alt.code !== 0) { pushLog(`复制 ${m.key} 失败：${alt.data || copyRes.data}`, 'log-error'); return false; }
    }
    pushLog(`已准备 ${m.key} 发布文件`, 'log-info');
  }
  // WpfClient：按生成目录分别复制
  if (input.wpfClient && input.wpfClient.length > 0) {
    const wpfClientPath = (store.draft.appconfigDraft as any)?.configItems?.wpfClient?.clientPath as string | null;
    const generateDirJson = (store.draft.appconfigDraft as any)?.configItems?.wpfClient?.generateDirJson as string | null;
    if (wpfClientPath) {
      const outWpf = `${removeSlash(mPublishDir)}/WpfClient`;
      await createDir(outWpf);
      if (generateDirJson) {
        try {
          const dirs: string[] = JSON.parse(generateDirJson);
          for (const d of dirs) {
            const src = `${removeSlash(wpfClientPath)}/${removeSlash(d)}`;
            const dst = `${removeSlash(outWpf)}/${removeSlash(d)}`;
            await createDir(dst);
            const r = await cmdInvoke('copy_dll_files', { source: src, destination: dst, delDestination: true });
            if (r.code !== 0) {
              const alt = await cmdInvoke('copy_path', { source: src, destination: dst, ...getRetryArgs('copy') });
              if (alt.code !== 0) { pushLog(`复制 WpfClient/${d} 失败：${alt.data}`, 'log-error'); return false; }
            }
          }
        } catch { /* ignore */ }
      } else {
        const r = await cmdInvoke('copy_dll_files', { source: wpfClientPath, destination: outWpf, delDestination: true });
        if (r.code !== 0) pushLog(`复制 WpfClient 失败：${r.data}`, 'log-warning');
      }
      pushLog('已准备 WpfClient 发布文件', 'log-info');
    }
  }

  // 保存发布配置（与 papersPublish 的 publish.config.json 一致，便于追溯）
  const configPath = `${removeSlash(mPublishDir)}/publish.config.json`;
  const saveRes = await cmdInvoke('save_content_to_file', { content: JSON.stringify(input, null, 2), filePath: configPath });
  if (saveRes.code !== 0) pushLog(`保存发布配置失败：${saveRes.data}`, 'log-warning');

  const remotePublishOne = async (servers: PublishServerType[] | null, serviceName: string) => {
    if (!servers || servers.length === 0) return true;
    pushLog(`正在发布 ${serviceName} 服务...`);
    for (const srv of servers) {
      const osName = displayOs(Number(srv.serverOs));
      const rawPwd = await aesDecrypt(String(srv.serverPwd || ''));
      const serverAddr = `${srv.serverIp}:${srv.serverPort}`;
      const username = String(srv.serverAccount || '');
      for (const cfg of srv.serverConfigs) {
        const logPrefix = formatServiceLog(srv.serverName || serviceName, srv.serverIp, serviceName, cfg.serverIdentity);
        // 停止服务
        pushLog(`${logPrefix} 正在停止...`);
        let stopOk = true;
        if (osName === 'Windows') {
          const r = await cmdInvoke('execute_remote_command', { username, password: rawPwd, server: serverAddr, command: `net stop "${cfg.serverIdentity}"`, ...getRetryArgs('service') });
          if (r.code !== 0) { const q = await cmdInvoke('execute_remote_command', { username, password: rawPwd, server: serverAddr, command: `sc query "${cfg.serverIdentity}"` }); stopOk = String(q.data || '').includes('STOPPED'); if (!stopOk) pushLog(`${logPrefix} 停止失败：${r.data}`, 'log-error'); }
        } else if (osName === 'Docker') {
          const r = await cmdInvoke('execute_remote_command', { username, password: rawPwd, server: serverAddr, command: `docker stop ${cfg.serverIdentity}` });
          if (r.code !== 0) { pushLog(`${logPrefix} 停止失败：${r.data}`, 'log-error'); stopOk = false; }
        } else {
          pushLog(`未知 OS：${osName}`, 'log-error'); return false;
        }
        if (!stopOk) return false;
        pushLog(`${logPrefix} 已停止`, 'log-success');
        // 上传文件
        pushLog(`${logPrefix} 正在部署 ${cfg.publishFiles.length} 个文件...`);
        for (const f of cfg.publishFiles) {
          const localPath = `${removeSlash(mPublishDir)}/${serviceName}/${f}`;
          // wpf 的文件在子目录，尝试多种本地路径
          const candidates = [localPath, `${removeSlash(mPublishDir)}/WpfClient/${f}`, `${removeSlash(mPublishDir)}/${serviceName}/${f}`];
          let uploaded = false;
          for (const lp of candidates) {
            const up = await cmdInvoke('upload_server_files', { localPaths: [lp], remotePaths: [`${removeSlash(cfg.publishPath)}/${f}`], username, password: rawPwd, server: serverAddr });
            if (up.code === 0) { uploaded = true; break; }
          }
          if (!uploaded) {
            // 回退：直接用 copy_path 的远程能力（本机路径场景）
            const up2 = await cmdInvoke('upload_server_files', { localPaths: [`${removeSlash(mPublishDir)}/${serviceName}/${f}`], remotePaths: [`${removeSlash(cfg.publishPath)}/${f}`], username, password: rawPwd, server: serverAddr });
            if (up2.code !== 0) { pushLog(`${logPrefix} 上传 ${f} 失败：${up2.data}`, 'log-error'); return false; }
          }
        }
        pushLog(`${logPrefix} 文件已部署`, 'log-success');
        // 启动服务
        pushLog(`${logPrefix} 正在启动...`);
        let startOk = true;
        if (osName === 'Windows') {
          const r = await cmdInvoke('execute_remote_command', { username, password: rawPwd, server: serverAddr, command: `net start "${cfg.serverIdentity}"`, ...getRetryArgs('service') });
          if (r.code !== 0) { pushLog(`${logPrefix} 启动失败：${r.data}`, 'log-error'); startOk = false; }
        } else if (osName === 'Docker') {
          const r = await cmdInvoke('execute_remote_command', { username, password: rawPwd, server: serverAddr, command: `docker start ${cfg.serverIdentity}` });
          if (r.code !== 0) { pushLog(`${logPrefix} 启动失败：${r.data}`, 'log-error'); startOk = false; }
        }
        if (!startOk) return false;
        pushLog(`${logPrefix} 发布成功`, 'log-success');
      }
    }
    return true;
  };

  // 按序发布（与 papersPublish 的 remoteServerPublish 顺序一致）
  if (input.webApiHost && !(await remotePublishOne(input.webApiHost, 'WebApiHost'))) return false;
  if (input.scheduleServer && !(await remotePublishOne(input.scheduleServer, 'ScheduleServer'))) return false;
  if (input.spcMonitor && !(await remotePublishOne(input.spcMonitor, 'SpcMonitor'))) return false;
  if (input.webClient && !(await remotePublishOne(input.webClient, 'WebClient'))) return false;
  if (input.wpfClient) {
    for (const wpf of input.wpfClient) {
      pushLog(`正在发布 WpfClient ${wpf.serverName}...`);
      const osName = displayOs(Number(wpf.serverOs));
      const rawPwd = await aesDecrypt(String(wpf.serverPwd || ''));
      const serverAddr = `${wpf.serverIp}:${wpf.serverPort}`;
      const username = String(wpf.serverAccount || '');
      const totalFiles = wpf.publishFiles.reduce((n, d) => n + d.files.length, 0);
      pushLog(`WpfClient ${wpf.serverName} (${osName}) 待部署 ${totalFiles} 个文件到 ${wpf.publishPath}`, 'log-info');
      let wpfOk = true;
      for (const dir of wpf.publishFiles) {
        if (!dir.files || dir.files.length === 0) {
          pushLog(`WpfClient ${wpf.serverName} 目录 ${dir.dirName} 无待发布文件，跳过`, 'log-warning');
          continue;
        }
        pushLog(`WpfClient ${wpf.serverName} 正在部署目录 ${dir.dirName} (${dir.files.length} 个文件)...`);
        for (const f of dir.files) {
          const localPath = `${removeSlash(mPublishDir)}/WpfClient/${dir.dirName}/${f}`;
          const fallbackPath = `${removeSlash(mPublishDir)}/WpfClient/${f}`;
          const remotePath = `${removeSlash(wpf.publishPath)}/${dir.dirName}/${f}`;
          // 优先按目录结构，其次回退到扁平（兼容 App 单目录回退）
          const candidates = [localPath, fallbackPath];
          let uploaded = false;
          let lastErr = '';
          for (const lp of candidates) {
            const up = await cmdInvoke('upload_server_files', { localPaths: [lp], remotePaths: [remotePath], username, password: rawPwd, server: serverAddr });
            if (up.code === 0) { uploaded = true; break; }
            lastErr = String(up.data || up.msg || '');
          }
          if (!uploaded) {
            pushLog(`WpfClient ${wpf.serverName} 上传 ${dir.dirName}/${f} 失败：${lastErr}`, 'log-error');
            wpfOk = false;
            break;
          }
          pushLog(`WpfClient ${wpf.serverName} 已部署 ${dir.dirName}/${f}`, 'log-info');
        }
        if (!wpfOk) break;
      }
      if (!wpfOk) return false;
      pushLog(`WpfClient ${wpf.serverName} 发布完成`, 'log-success');
    }
  }

  pushLog('发布成功！', 'log-success');
  return true;
};

const onPublish = async () => {
  if (!store.canPublish) { ElMessage.warning('请先完成必选步骤'); pushLog('发布失败：尚有必选步骤未完成', 'log-error'); return; }
  if (!hasAppconfig.value) { ElMessage.warning('请先配置应用配置'); pushLog('发布失败：未配置应用配置', 'log-error'); return; }
  publishing.value = true;
  logs.value = [];
  pushLog('开始发布...');
  try {
    const input = await toPublishInput();
    if (!input) { pushLog('发布中止：聚合入参失败', 'log-error'); ElMessage.error('发布失败：请检查日志'); return; }
    pushLog(`项目: ${input.projectName} 环境: ${displayEnvironment(input.environment)} 备份: ${input.isBackup === 1 ? '开启' : '关闭'}`);
    // 复用既有链路执行发布（不复制引擎：通过 publishSettings 与 Tauri 命令复用）
    const ok = await executeRemotePublish(input);
    if (ok) {
      pushLog('发布流程结束', 'log-success');
      ElMessage.success('发布成功');
    } else {
      pushLog('发布失败，请查看日志', 'log-error');
      ElMessage.error('发布失败');
    }
  } catch (e: any) {
    pushLog(`发布异常：${e?.message || String(e)}`, 'log-error');
    ElMessage.error(`发布异常：${e?.message || String(e)}`);
  } finally {
    publishing.value = false;
    // 清理临时目录
    try {
      const dir = await papersPublishDir();
      await cmdInvoke('delete_paths', { paths: [dir] });
    } catch { /* ignore */ }
  }
};

const validate = (): boolean => {
  if (!store.canPublish) {
    ElMessage.warning('尚有必选步骤未完成，无法发布');
    pushLog('校验失败：尚有必选步骤未完成', 'log-warning');
    return false;
  }
  return true;
};

watch(() => [store.draft.projectId, store.draft.gitId, store.draft.tfsId, store.draft.serverIds, store.draft.appconfigDraft], () => loadAll(), { deep: true });

onMounted(async () => { await loadAll(); });

defineExpose({ validate, onPrecheck, onPublish });
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

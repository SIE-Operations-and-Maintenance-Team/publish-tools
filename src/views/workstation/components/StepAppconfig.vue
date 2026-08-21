<template>
  <div class="step-appconfig">
    <el-form ref="formRef" :model="form" :rules="formRules" label-width="110px" size="default">
      <el-form-item label="所属项目">
        <el-input :model-value="projectName" disabled placeholder="未选择项目（请返回上一步）" />
      </el-form-item>

      <el-form-item label="环境" prop="environment">
        <el-radio-group v-model="form.environment">
          <el-radio :value="1">Dev</el-radio>
          <el-radio :value="2">Uat</el-radio>
          <el-radio :value="3">Pro</el-radio>
          <el-radio :value="4">Other</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="获取模式" prop="buildMode">
        <el-select v-model="form.buildMode" placeholder="请选择获取模式" style="width: 200px">
          <el-option label="Debug" value="Debug" />
          <el-option label="Release" value="Release" />
        </el-select>
      </el-form-item>

      <el-form-item label="获取dll方式" prop="dllMode">
        <el-select v-model="form.dllMode" placeholder="请选择dll获取方式" style="width: 200px">
          <el-option label="全部" value="全部" />
          <el-option label="当天" value="当天" />
          <el-option label="最近3天" value="最近3天" />
          <el-option label="日期范围" value="日期范围" />
          <el-option label="DLL名称" value="DLL名称" />
          <el-option label="TFS" value="TFS" />
          <el-option label="Git" value="Git" />
        </el-select>
      </el-form-item>

      <el-form-item v-if="form.dllMode === '日期范围'" label="日期范围" prop="dllModeValue">
        <el-date-picker v-model="dllDateRange" type="datetimerange" range-separator="~" start-placeholder="起始日期" end-placeholder="截止日期" @change="onDllDateChange" style="width: 100%" />
      </el-form-item>
      <el-form-item v-else-if="form.dllMode === 'DLL名称'" label="DLL名称" prop="dllModeValue">
        <el-input v-model="form.dllModeValue" type="textarea" :rows="3" placeholder="每行一个，支持 * 和 ? 通配符" maxlength="2000" clearable />
      </el-form-item>

      <el-form-item label="MsBuild路径" prop="msBuildPath">
        <el-input v-model="form.msBuildPath" placeholder="可选，MsBuild.exe 路径" maxlength="450" clearable />
      </el-form-item>

      <el-row :gutter="12">
        <el-col :span="8">
          <el-form-item label="重新编译">
            <el-switch v-model="form.configItems.isRebuild" :active-value="1" :inactive-value="0" inline-prompt active-text="是" inactive-text="否" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="发布前备份">
            <el-switch v-model="form.configItems.isBackup" :active-value="1" :inactive-value="0" inline-prompt active-text="开启" inactive-text="关闭" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="10.2+版本">
            <el-checkbox v-model="form.configItems.isNewVersion" label="是" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="备份路径" prop="backupBasePath">
        <el-input v-model="form.configItems.backupBasePath" placeholder="选填，备份到指定路径；不填使用默认路径" maxlength="450" clearable />
      </el-form-item>

      <el-divider>客户端生成路径（选填，用于覆盖默认）</el-divider>
      <el-form-item label="WebApiHost">
        <el-input v-model="form.configItems.webApiHost.clientPath" placeholder="WebApiHost 客户端生成路径" clearable />
      </el-form-item>
      <el-form-item label="ScheduleServer">
        <el-input v-model="form.configItems.scheduleServer.clientPath" placeholder="ScheduleServer 客户端生成路径" clearable />
      </el-form-item>
      <el-form-item label="WebClient">
        <el-input v-model="form.configItems.webClient.clientPath" placeholder="WebClient 客户端生成路径" clearable />
      </el-form-item>
      <el-form-item label="WpfClient">
        <el-input v-model="form.configItems.wpfClient.clientPath" placeholder="WpfClient 客户端生成路径" clearable />
      </el-form-item>
      <el-form-item label="SpcMonitor">
        <el-input v-model="form.configItems.spcMonitor.clientPath" placeholder="SpcMonitor 客户端生成路径" clearable />
      </el-form-item>
    </el-form>

    <el-alert v-if="!store.draft.projectId" type="warning" :closable="false" show-icon title="请先在第1步选择项目" style="margin-top: 8px" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { useWorkstationStore } from '@/stores/workstation';
import { useProjectDb } from '@/database/project/index';
import { formatDate } from '@/utils/formatTime';

const store = useWorkstationStore();
const projectDb = useProjectDb();

const formRef = ref<FormInstance>();

const form = reactive<RowAppconfigType>({
  id: null,
  projectId: store.draft.projectId as number | null,
  projectName: null,
  environment: 1,
  msBuildPath: null,
  dllMode: '全部',
  dllModeValue: null,
  buildMode: 'Debug',
  configItemsJson: '',
  configItems: {
    webApiHost: { clientPath: '', serverPath: '', serverIds: [], serverArr: [] },
    scheduleServer: { clientPath: '', serverPath: '', serverIds: [], serverArr: [] },
    webClient: { clientPath: '', serverPath: '', serverIds: [], serverArr: [] },
    wpfClient: { clientPath: '', serverId: null, serverName: null, serverPath: '', serverIds: [], serverArr: [], isCompress: 1, generateDirJson: '', compressFileJson: '' },
    spcMonitor: { clientPath: '', serverPath: '', serverIds: [], serverArr: [] },
    isRebuild: 1,
    isBackup: 0,
    isNewVersion: false,
    backupBasePath: null,
  },
});

const dllDateRange = ref<[Date, Date] | null>(null);
const projectName = ref('');

const loadProjectName = async () => {
  const pid = store.draft.projectId;
  if (!pid) { projectName.value = ''; return; }
  const r = await projectDb.getProjectById(pid as number);
  const data = (r as any)?.data?.data;
  if (data?.name) { projectName.value = data.name; form.projectId = pid as number; }
};

const onDllDateChange = (val: [Date, Date] | null) => {
  if (!val || val.length !== 2) { form.dllModeValue = null; return; }
  const start = formatDate(val[0], 'YYYY-mm-dd HH:MM:SS');
  const end = formatDate(val[1], 'YYYY-mm-dd HH:MM:SS');
  form.dllModeValue = JSON.stringify([start, end]);
};

// 复用 appconfig 的校验思路：projectId 必填、环境必选，dllModeValue 按模式必填
const formRules = reactive<FormRules>({
  environment: [{ required: true, message: '请选择环境', trigger: 'change' }],
  buildMode: [{ required: true, message: '请选择获取模式', trigger: 'change' }],
  dllMode: [{ required: true, message: '请选择获取dll方式', trigger: 'change' }],
  dllModeValue: [
    {
      validator: (_rule: any, _value: any, cb: any) => {
        if (form.dllMode === '日期范围' && !form.dllModeValue) cb(new Error('请选择日期范围'));
        else if (form.dllMode === 'DLL名称' && !form.dllModeValue) cb(new Error('请输入DLL名称'));
        else cb();
      },
      trigger: ['blur', 'change'],
    },
  ],
});

const syncFromDraft = () => {
  const d = store.draft.appconfigDraft as any;
  if (!d || Object.keys(d).length === 0) return;
  // 仅覆盖可持久化字段，保留默认值兜底
  if (d.environment != null) form.environment = d.environment;
  if (d.buildMode) form.buildMode = d.buildMode;
  if (d.dllMode) form.dllMode = d.dllMode;
  if (d.dllModeValue !== undefined) form.dllModeValue = d.dllModeValue;
  if (d.msBuildPath !== undefined) form.msBuildPath = d.msBuildPath;
  if (d.configItems) {
    const ci = d.configItems;
    if (ci.isRebuild !== undefined && ci.isRebuild !== null) form.configItems.isRebuild = ci.isRebuild;
    if (ci.isBackup !== undefined && ci.isBackup !== null) form.configItems.isBackup = ci.isBackup;
    if (ci.isNewVersion !== undefined && ci.isNewVersion !== null) form.configItems.isNewVersion = ci.isNewVersion as any;
    if (ci.backupBasePath !== undefined) form.configItems.backupBasePath = ci.backupBasePath;
    if (ci.webApiHost?.clientPath !== undefined) form.configItems.webApiHost.clientPath = ci.webApiHost.clientPath;
    if (ci.scheduleServer?.clientPath !== undefined) form.configItems.scheduleServer.clientPath = ci.scheduleServer.clientPath;
    if (ci.webClient?.clientPath !== undefined) form.configItems.webClient.clientPath = ci.webClient.clientPath;
    if (ci.wpfClient?.clientPath !== undefined) form.configItems.wpfClient.clientPath = ci.wpfClient.clientPath;
    if (ci.spcMonitor?.clientPath !== undefined) form.configItems.spcMonitor.clientPath = ci.spcMonitor.clientPath;
  }
  if (form.dllMode === '日期范围' && form.dllModeValue) {
    try {
      const arr = JSON.parse(String(form.dllModeValue));
      dllDateRange.value = [new Date(arr[0]), new Date(arr[1])];
    } catch { /* 忽略解析失败 */ }
  }
};

const validate = async (): Promise<boolean> => {
  if (!formRef.value) return false;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) {
    ElMessage.warning('请检查应用配置必填项');
    return false;
  }
  if (!store.draft.projectId) {
    ElMessage.warning('请先选择项目');
    return false;
  }
  // 同步 serverIds 到各模块（与 appconfigDialog 的多选卡片联动思路一致，简化为全量复用）
  const sIds = [...(store.draft.serverIds || [])];
  // 仅当已有 serverIds 时，同步到各模块的 serverIds，便于后续发布聚合
  form.configItems.webApiHost.serverIds = [...sIds];
  form.configItems.scheduleServer.serverIds = [...sIds];
  form.configItems.webClient.serverIds = [...sIds];
  form.configItems.wpfClient.serverIds = [...sIds];
  form.configItems.spcMonitor.serverIds = [...sIds];

  const payload: any = {
    id: form.id,
    projectId: store.draft.projectId,
    projectName: projectName.value || null,
    environment: form.environment,
    msBuildPath: form.msBuildPath,
    dllMode: form.dllMode,
    dllModeValue: form.dllModeValue,
    buildMode: form.buildMode,
    configItemsJson: JSON.stringify(form.configItems),
    configItems: JSON.parse(JSON.stringify(form.configItems)),
    publishMode: (store.draft.appconfigDraft as any)?.publishMode ?? 0,
  };
  store.draft.appconfigDraft = payload;
  // 同步 publishOptions 便捷字段
  store.draft.publishOptions = {
    isBackup: form.configItems.isBackup as number,
    isNewVersion: form.configItems.isNewVersion as boolean | null,
    backupBasePath: form.configItems.backupBasePath as string | undefined,
  } as any;
  store.persist();
  return true;
};

watch(() => store.draft.projectId, () => { form.projectId = store.draft.projectId as number | null; loadProjectName(); });
watch(() => store.draft.appconfigDraft, () => syncFromDraft(), { deep: true });

onMounted(async () => {
  await loadProjectName();
  syncFromDraft();
});

defineExpose({ validate });
</script>

<style scoped>
.step-appconfig {
  padding: 4px 0;
}
</style>

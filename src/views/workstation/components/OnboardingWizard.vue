<template>
  <el-dialog
    :model-value="visible"
    fullscreen
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="true"
    align-center
    class="onboarding-wizard-dialog"
    @update:model-value="onVisibleChange"
    @close="onClose"
  >
    <template #header>
      <div class="wizard-header">
        <span>新手指引 · 发布工作台</span>
        <span v-if="hasExistingConfig" class="wizard-header-hint">检测到已有配置</span>
      </div>
    </template>

    <el-steps :active="active" finish-status="success" align-center style="margin-bottom: 20px">
      <el-step v-for="s in steps" :key="s.key" :title="s.title" :description="s.desc" />
    </el-steps>

    <div class="wizard-body">
      <!-- Step 0: 欢迎 + 环境检测 -->
      <div v-if="active === 0" class="wizard-welcome">
        <el-result icon="success" title="欢迎使用 SMOM 发布工作台" sub-title="5 步完成最小闭环，快速完成首次发布配置">
          <template #extra>
            <p class="welcome-desc">按顺序完成：项目 → 代码源(Git/TFS) → 服务器 → 应用配置，随后可在工作台预检并发布。</p>
          </template>
        </el-result>

        <div v-loading="detecting" class="welcome-detect">
          <el-alert
            v-if="hasExistingConfig"
            type="success"
            :closable="false"
            show-icon
            title="检测到已有配置，可直接进入工作台"
            description="t_project 与 t_server 已有数据，无需重复配置。点击下方“直接进入工作台”可跳过向导。"
            style="margin-top: 12px"
          />
          <el-alert
            v-else-if="!detecting"
            type="info"
            :closable="false"
            show-icon
            title="未检测到已有配置"
            description="按“开始配置”进入第 1 步，完成 5 步后即可预检发布。"
            style="margin-top: 12px"
          />
          <div v-if="hasExistingConfig" style="text-align: center; margin-top: 16px">
            <el-button type="success" @click="onEnterWorkstation">直接进入工作台</el-button>
          </div>
          <div v-if="detectError" style="margin-top: 12px">
            <el-alert type="warning" :closable="false" show-icon :title="detectError" />
          </div>
        </div>
      </div>

      <!-- Step 1-4: 复用真实 Step* 组件 -->
      <div v-show="active === 1">
        <StepProject ref="stepProjectRef" />
      </div>
      <div v-show="active === 2">
        <StepSource ref="stepSourceRef" />
      </div>
      <div v-show="active === 3">
        <StepServers ref="stepServersRef" />
      </div>
      <div v-show="active === 4">
        <StepAppconfig ref="stepAppconfigRef" />
      </div>
    </div>

    <template #footer>
      <div class="wizard-footer">
        <el-button :disabled="active === 0" @click="onPrev">上一步</el-button>
        <el-button v-if="active > 0 && active < 4" @click="onSkip">跳过</el-button>
        <span style="flex: 1" />
        <el-button v-if="active < 4" type="primary" @click="onNext">{{ active === 0 ? '开始配置' : '下一步' }}</el-button>
        <el-button v-if="active === 4" type="primary" :loading="finishing" @click="onFinish">完成并预检</el-button>
        <el-button @click="onClose">关闭</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useOnboardingStore } from '@/stores/onboarding';
import { useProjectDb } from '@/database/project/index';
import { useServerDb } from '@/database/servers/index';
import StepProject from './StepProject.vue';
import StepSource from './StepSource.vue';
import StepServers from './StepServers.vue';
import StepAppconfig from './StepAppconfig.vue';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [val: boolean] }>();

const onboarding = useOnboardingStore();
const projectDb = useProjectDb();
const serverDb = useServerDb();

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

const steps = [
  { key: 'welcome', title: '欢迎', desc: '' },
  { key: 'project', title: '选择项目', desc: '' },
  { key: 'source', title: '代码源', desc: 'Git / TFS' },
  { key: 'servers', title: '服务器', desc: '' },
  { key: 'appconfig', title: '应用配置', desc: '' },
] as const;

const active = ref(0);
const finishing = ref(false);
const detecting = ref(false);
const detectError = ref<string | null>(null);
const hasProjects = ref(false);
const hasServers = ref(false);

const hasExistingConfig = computed(() => hasProjects.value && hasServers.value);

const stepProjectRef = ref<any>(null);
const stepSourceRef = ref<any>(null);
const stepServersRef = ref<any>(null);
const stepAppconfigRef = ref<any>(null);

const getCurrentRef = (): any => {
  if (active.value === 1) return stepProjectRef.value;
  if (active.value === 2) return stepSourceRef.value;
  if (active.value === 3) return stepServersRef.value;
  if (active.value === 4) return stepAppconfigRef.value;
  return null;
};

const detectEnv = async () => {
  detecting.value = true;
  detectError.value = null;
  try {
    const [pr, sr] = await Promise.all([
      projectDb.getProjectList({ code: null, name: null, sorting: 'id DESC', skipCount: 0, maxResultCount: 1 }),
      serverDb.getServerList({ projectId: null, name: null, sorting: 'ts.id DESC', skipCount: 0, maxResultCount: 1 } as any),
    ]);
    hasProjects.value = (pr as any)?.data?.total > 0 || (pr as any)?.data?.data?.length > 0;
    hasServers.value = (sr as any)?.data?.total > 0 || (sr as any)?.data?.data?.length > 0;
  } catch (e: any) {
    detectError.value = e?.message || String(e);
  } finally {
    detecting.value = false;
  }
};

const syncActiveFromStore = () => {
  const s = onboarding.currentStep;
  if (s >= 0 && s < steps.length) active.value = s;
  else active.value = 0;
};

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      syncActiveFromStore();
      detectEnv();
    }
  },
  { immediate: false }
);

const onVisibleChange = (v: boolean) => {
  emit('update:modelValue', v);
};

const onClose = () => {
  emit('update:modelValue', false);
};

const onPrev = () => {
  if (active.value > 0) {
    active.value -= 1;
    onboarding.currentStep = active.value;
    onboarding.persist();
  }
};

const onNext = async () => {
  if (active.value === 0) {
    active.value = 1;
    onboarding.currentStep = active.value;
    onboarding.persist();
    return;
  }
  const cur = getCurrentRef();
  if (cur?.validate) {
    const ok = await Promise.resolve(cur.validate());
    if (!ok) return;
  }
  if (active.value < steps.length - 1) {
    active.value += 1;
    onboarding.currentStep = active.value;
    onboarding.persist();
  }
};

const onSkip = () => {
  onboarding.skipStep(active.value);
  if (active.value < steps.length - 1) {
    active.value += 1;
    onboarding.currentStep = active.value;
    onboarding.persist();
  }
};

const onEnterWorkstation = () => {
  onboarding.markCompleted();
  ElMessage.success('已进入工作台');
  emit('update:modelValue', false);
};

const onFinish = async () => {
  const cur = getCurrentRef();
  if (cur?.validate) {
    finishing.value = true;
    try {
      const ok = await Promise.resolve(cur.validate());
      if (!ok) return;
      onboarding.markCompleted();
      ElMessage.success('配置完成，已进入工作台');
      emit('update:modelValue', false);
    } finally {
      finishing.value = false;
    }
  } else {
    onboarding.markCompleted();
    emit('update:modelValue', false);
  }
};

defineExpose({ active });
</script>

<style scoped>
.wizard-header {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 600;
}

.wizard-header-hint {
  font-size: 12px;
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
  padding: 2px 8px;
  border-radius: 10px;
}

.wizard-body {
  min-height: 360px;
  padding: 8px 4px;
}

.wizard-welcome {
  padding: 8px 0;
}

.welcome-desc {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin: 0;
  text-align: center;
}

.welcome-detect {
  max-width: 560px;
  margin: 0 auto;
}

.wizard-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: flex-start;
}
</style>

<style>
.onboarding-wizard-dialog .el-dialog__body {
  padding-top: 10px;
}
</style>

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
        <span>{{ $t("message.onboarding.title") }}</span>
        <span v-if="hasExistingConfig" class="wizard-header-hint">{{
          $t("message.onboarding.headerHint")
        }}</span>
      </div>
    </template>

    <el-steps
      :active="active"
      finish-status="success"
      align-center
      style="margin-bottom: 20px"
    >
      <el-step
        v-for="s in steps"
        :key="s.key"
        :title="s.title"
        :description="s.desc"
      />
    </el-steps>

    <div class="wizard-body">
      <!-- Step 0: 欢迎 + 环境检测 -->
      <div v-if="active === 0" class="wizard-welcome">
        <el-result
          icon="success"
          :title="$t('message.onboarding.welcomeTitle')"
          :sub-title="$t('message.onboarding.welcomeSubTitle')"
        >
          <template #extra>
            <p class="welcome-desc">
              {{ $t("message.onboarding.welcomeDesc") }}
            </p>
          </template>
        </el-result>

        <div v-loading="detecting" class="welcome-detect">
          <el-alert
            v-if="hasExistingConfig"
            type="success"
            :closable="false"
            show-icon
            :title="$t('message.onboarding.hasConfigTitle')"
            :description="$t('message.onboarding.hasConfigDesc')"
            style="margin-top: 12px"
          />
          <el-alert
            v-else-if="!detecting"
            type="info"
            :closable="false"
            show-icon
            :title="$t('message.onboarding.noConfigTitle')"
            :description="$t('message.onboarding.noConfigDesc')"
            style="margin-top: 12px"
          />
          <div
            v-if="hasExistingConfig"
            style="text-align: center; margin-top: 16px"
          >
            <el-button type="success" @click="onEnterWorkstation">{{
              $t("message.onboarding.goWorkstation")
            }}</el-button>
          </div>
          <div v-if="detectError" style="margin-top: 12px">
            <el-alert
              type="warning"
              :closable="false"
              show-icon
              :title="detectError"
            />
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
        <el-button :disabled="active === 0" @click="onPrev">{{
          $t("message.onboarding.prev")
        }}</el-button>
        <el-button v-if="active > 0 && active < 4" @click="onSkip">{{
          $t("message.onboarding.skip")
        }}</el-button>
        <span style="flex: 1" />
        <el-button v-if="active < 4" type="primary" @click="onNext">{{
          active === 0
            ? $t("message.onboarding.startConfig")
            : $t("message.onboarding.next")
        }}</el-button>
        <el-button
          v-if="active === 4"
          type="primary"
          :loading="finishing"
          @click="onFinish"
          >{{ $t("message.onboarding.finish") }}</el-button
        >
        <el-button @click="onClose">{{
          $t("message.onboarding.close")
        }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { ElMessage } from "element-plus";
import { useI18n } from "vue-i18n";
import { useOnboardingStore } from "@/stores/onboarding";
import { useWorkstationStore } from "@/stores/workstation";
import { useProjectDb } from "@/database/project/index";
import { useServerDb } from "@/database/servers/index";
import StepProject from "./StepProject.vue";
import StepSource from "./StepSource.vue";
import StepServers from "./StepServers.vue";
import StepAppconfig from "./StepAppconfig.vue";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ "update:modelValue": [val: boolean] }>();

const { t } = useI18n();
const onboarding = useOnboardingStore();
const workstation = useWorkstationStore();
const projectDb = useProjectDb();
const serverDb = useServerDb();

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit("update:modelValue", v),
});

const steps = [
  { key: "welcome", title: "欢迎", desc: "" },
  { key: "project", title: "选择项目", desc: "" },
  { key: "source", title: "代码源", desc: "Git / TFS" },
  { key: "servers", title: "服务器", desc: "" },
  { key: "appconfig", title: "应用配置", desc: "" },
] as const;

const active = ref(0);
const finishing = ref(false);
const detecting = ref(false);
const detectError = ref<string | null>(null);
const hasProjects = ref(false);
const hasServers = ref(false);

const hasExistingConfig = computed(() => hasProjects.value && hasServers.value);

type StepValidateRef = { validate: () => boolean | Promise<boolean> };
const stepProjectRef = ref<StepValidateRef | null>(null);
const stepSourceRef = ref<StepValidateRef | null>(null);
const stepServersRef = ref<StepValidateRef | null>(null);
const stepAppconfigRef = ref<StepValidateRef | null>(null);

const getCurrentRef = (): StepValidateRef | null => {
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
      projectDb.getProjectList({
        code: null,
        name: null,
        sorting: "id DESC",
        skipCount: 0,
        maxResultCount: 1,
      }),
      serverDb.getServerList({
        projectId: null,
        name: null,
        sorting: "ts.id DESC",
        skipCount: 0,
        maxResultCount: 1,
      }),
    ]);
    hasProjects.value =
      Number(pr.data?.total ?? pr.data?.data?.length ?? 0) > 0 ||
      (Array.isArray(pr.data?.data) && pr.data.data.length > 0);
    hasServers.value =
      Number(sr.data?.total ?? sr.data?.data?.length ?? 0) > 0 ||
      (Array.isArray(sr.data?.data) && sr.data.data.length > 0);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    detectError.value = msg;
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
  emit("update:modelValue", v);
};

const onClose = () => {
  emit("update:modelValue", false);
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
  ElMessage.success(t("message.onboarding.doneHint"));
  emit("update:modelValue", false);
  // 切到工作台预览步，提示去预检
  workstation.currentStep = 5 as WorkstationStep;
  workstation.persist();
};

const onFinish = async () => {
  const cur = getCurrentRef();
  if (cur?.validate) {
    finishing.value = true;
    try {
      const ok = await Promise.resolve(cur.validate());
      if (!ok) return;
      // 真实闭环校验：canPublish 不满足则不 markCompleted，提示缺失项并阻止关闭
      if (!workstation.canPublish) {
        const missing: string[] = [];
        if (!workstation.draft.projectId)
          missing.push(t("message.workstation.missingProject"));
        if (!workstation.draft.tfsId && !workstation.draft.gitId)
          missing.push(t("message.workstation.missingSource"));
        if (!workstation.draft.serverIds.length)
          missing.push(t("message.workstation.missingServers"));
        if (
          !workstation.draft.appconfigDraft ||
          Object.keys(workstation.draft.appconfigDraft as object).length === 0
        )
          missing.push(t("message.workstation.missingAppconfig"));
        ElMessage.warning(
          missing.join("、") || t("message.workstation.bottomHint")
        );
        return;
      }
      onboarding.markCompleted();
      ElMessage.success(t("message.onboarding.doneHint"));
      workstation.currentStep = 5 as WorkstationStep;
      workstation.persist();
      ElMessage.info(
        t("message.workstation.precheckDryRun") +
          " — " +
          t("message.workstation.previewTitle")
      );
      emit("update:modelValue", false);
    } finally {
      finishing.value = false;
    }
  } else {
    if (!workstation.canPublish) {
      ElMessage.warning(t("message.workstation.bottomHint"));
      return;
    }
    onboarding.markCompleted();
    workstation.currentStep = 5 as WorkstationStep;
    workstation.persist();
    emit("update:modelValue", false);
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

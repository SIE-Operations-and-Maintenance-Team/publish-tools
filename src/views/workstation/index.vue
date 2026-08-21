<template>
  <div class="workstation-container layout-padding">
    <!-- 顶部 Steps -->
    <el-card shadow="hover" class="mb15">
      <el-steps :active="store.currentStep" finish-status="success" align-center>
        <el-step v-for="item in stepTitles" :key="item.key" :title="item.title" :description="item.desc" />
      </el-steps>
    </el-card>

    <!-- 缺失项提示：canPublish 不满足时在操作区旁展示 -->
    <el-alert
      v-if="missingItems.length > 0"
      type="warning"
      :closable="false"
      show-icon
      class="mb15"
      :title="`尚有 ${missingItems.length} 项未完成，无法预检/发布`"
      :description="missingItems.join('、')"
    />

    <el-row :gutter="16">
      <!-- 左侧：表单区，按 currentStep 切换子组件 -->
      <el-col :span="16">
        <el-card shadow="hover">
          <template #header>
            <div class="workstation-step-header">
              <span>{{ stepTitles[store.currentStep]?.title || stepTitles[0].title }}</span>
              <el-button link type="primary" size="small" @click="onGoAdvanced">高级设置 →</el-button>
            </div>
          </template>

          <!-- 动态步骤组件：Task 8 真实 Step* 组件 -->
          <component :is="stepComp" ref="stepRef" />

          <!-- 步骤导航 -->
          <div class="workstation-step-actions">
            <el-button :disabled="store.currentStep === 0" @click="onPrev">上一步</el-button>
            <el-button type="primary" :disabled="!store.canNext" @click="onNext">下一步</el-button>
          </div>
        </el-card>
      </el-col>

      <!-- 右侧：预览 / 日志（复用 StepPreview 只读聚合） -->
      <el-col :span="8">
        <el-card shadow="hover" class="workstation-preview-card">
          <template #header>
            <span>预览与日志</span>
          </template>
          <RightPreview />
          <el-empty v-if="!hasPreviewContent" description="完成左侧步骤后，此处将展示待发布清单与实时日志 — 预检/发布前请在此确认" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 底部常驻：预检 / 发布，canPublish 控制禁用 -->
    <el-affix position="bottom" :offset="12">
      <el-card shadow="hover" class="workstation-bottom-bar">
        <div class="workstation-bottom-actions">
          <el-button :disabled="!store.canPublish" @click="onPrecheck">预检</el-button>
          <el-button type="primary" :disabled="!store.canPublish" @click="onPublish">发布</el-button>
          <span v-if="!store.canPublish" class="workstation-bottom-hint">请先完成必选步骤</span>
        </div>
      </el-card>
    </el-affix>

    <!-- 新手指引向导：首启自弹 + Header 常驻入口重播 -->
    <OnboardingWizard v-model="onboardingVisible" />
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, onUnmounted, ref, defineAsyncComponent } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { useWorkstationStore } from "@/stores/workstation";
import { useOnboardingStore } from "@/stores/onboarding";
import mittBus from "@/utils/mitt";

const store = useWorkstationStore();
const router = useRouter();
const onboarding = useOnboardingStore();
const onboardingVisible = ref(false);

const OnboardingWizard = defineAsyncComponent(() => import("./components/OnboardingWizard.vue"));

// 真实步骤组件（异步加载，复用既有 Dialog）
const StepProject = defineAsyncComponent(() => import("./components/StepProject.vue"));
const StepSource = defineAsyncComponent(() => import("./components/StepSource.vue"));
const StepServers = defineAsyncComponent(() => import("./components/StepServers.vue"));
const StepAppconfig = defineAsyncComponent(() => import("./components/StepAppconfig.vue"));
const StepPreview = defineAsyncComponent(() => import("./components/StepPreview.vue"));

// 欢迎占位：保留轻量占位，仅 Step 0 使用
const WelcomePlaceholder = defineComponent({
  name: "WelcomePlaceholder",
  setup() {
    return () => h("div", { class: "workstation-placeholder" }, "欢迎使用 SMOM 发布工作台 — 点击“下一步”开始");
  },
});

// 右侧预览（只读聚合）：复用 StepPreview 组件的只读展示，右侧保持常驻
const RightPreview = defineComponent({
  name: "RightPreview",
  setup() {
    const s = useWorkstationStore();
    return () =>
      h("div", { class: "workstation-preview" }, [
        h("div", { class: "workstation-preview-row" }, `项目: ${s.draft.projectId ?? "未选择"}`),
        h("div", { class: "workstation-preview-row" }, `代码源: ${s.draft.tfsId ?? s.draft.gitId ?? "未选择"}`),
        h("div", { class: "workstation-preview-row" }, `服务器: ${s.draft.serverIds.length ? s.draft.serverIds.join(", ") : "未选择"}`),
        h("div", { class: "workstation-preview-row" }, `应用配置: ${Object.keys(s.draft.appconfigDraft || {}).length ? "已配置" : "未配置"}`),
      ]);
  },
});

// 6 步对应 WorkstationStep 0|1|2|3|4|5，与 store.currentStep 逐一映射
const stepTitles = [
  { key: "welcome", title: "欢迎", desc: "" },
  { key: "project", title: "选择项目", desc: "" },
  { key: "source", title: "代码源", desc: "Git / TFS" },
  { key: "servers", title: "服务器", desc: "" },
  { key: "appconfig", title: "应用配置", desc: "" },
  { key: "preview", title: "预览发布", desc: "" },
] as const;

const stepMap = [
  WelcomePlaceholder,
  StepProject,
  StepSource,
  StepServers,
  StepAppconfig,
  StepPreview,
] as const;

const stepRef = ref<any>(null);

const stepComp = computed(() => {
  const idx = store.currentStep;
  return stepMap[idx] ?? StepPreview;
});

const hasPreviewContent = computed(() => {
  return !!(store.draft.projectId || store.draft.tfsId || store.draft.gitId || store.draft.serverIds.length);
});

// 缺失项：用于 el-alert 与底部禁用态的文案
const missingItems = computed(() => {
  const items: string[] = [];
  if (!store.draft.projectId) items.push("未选择项目");
  if (!store.draft.tfsId && !store.draft.gitId) items.push("未选择代码源（Git/TFS）");
  if (!store.draft.serverIds.length) items.push("未选择服务器");
  if (!store.draft.appconfigDraft || Object.keys(store.draft.appconfigDraft).length === 0) items.push("未配置应用配置");
  return items;
});

const onPrev = () => {
  if (store.currentStep > 0) {
    store.currentStep = ((store.currentStep - 1) as WorkstationStep);
    store.persist();
  }
};

const onNext = async () => {
  // 优先调用当前步骤的 validate()，成功后才允许下一步（并已在子组件内 persist）
  if (stepRef.value?.validate) {
    const ok = await stepRef.value.validate();
    if (!ok) return;
  } else if (!store.canNext) {
    ElMessage.warning("请先完成当前步骤必填项");
    return;
  }
  if (store.currentStep < 5) {
    store.currentStep = ((store.currentStep + 1) as WorkstationStep);
    store.persist();
  }
};

const onPrecheck = async () => {
  if (!store.canPublish) {
    ElMessage.warning(`预检前请先完成：${missingItems.value.join("、")}`);
    return;
  }
  // 若当前在预览步，委托其 dry-run 聚合校验
  if (store.currentStep === 5 && stepRef.value?.onPrecheck) {
    await stepRef.value.onPrecheck();
    return;
  }
  ElMessage.info("预检：请进入“预览发布”步骤执行预检");
  store.currentStep = 5 as WorkstationStep;
  store.persist();
};

const onPublish = async () => {
  if (!store.canPublish) {
    ElMessage.warning(`发布前请先完成：${missingItems.value.join("、")}`);
    return;
  }
  // 预览步直接聚合 draft → RemotePublishType 并复用既有 papersPublish 链路
  if (store.currentStep === 5 && stepRef.value?.onPublish) {
    await stepRef.value.onPublish();
    return;
  }
  // 非预览步则先切到预览步，再由用户触发发布（避免越级发布）
  ElMessage.info("请先进入“预览发布”步骤确认清单后发布");
  store.currentStep = 5 as WorkstationStep;
  store.persist();
};

// 高级设置跳转：每步右上角快捷入口，保留旧页能力
const stepAdvancedRoute: Record<number, string> = {
  0: "/home",
  1: "/smom/project",
  2: "/tfs",
  3: "/server",
  4: "/smom/appconfig",
  5: "/smom/papersPublish",
};

const onGoAdvanced = () => {
  const target = stepAdvancedRoute[store.currentStep] ?? "/smom/project";
  router.push(target);
};

const onOpenOnboarding = () => {
  onboardingVisible.value = true;
};

onMounted(() => {
  store.restore();
  onboarding.restore();
  if (onboarding.shouldAutoOpen()) onboardingVisible.value = true;
  mittBus.on("openOnboarding", onOpenOnboarding);
});

onUnmounted(() => {
  mittBus.off("openOnboarding", onOpenOnboarding);
});
</script>

<style scoped>
.workstation-container {
  padding: 0;
}

.workstation-step-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.workstation-step-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 16px;
}

.workstation-preview-card {
  min-height: 260px;
}

.workstation-preview-row {
  line-height: 28px;
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.workstation-placeholder {
  padding: 24px 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
  text-align: center;
}

.workstation-bottom-bar {
  border: 1px solid var(--el-border-color-lighter);
}

.workstation-bottom-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.workstation-bottom-hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.mb15 {
  margin-bottom: 15px;
}
</style>

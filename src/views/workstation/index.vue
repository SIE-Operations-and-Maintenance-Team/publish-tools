<template>
  <div class="workstation-container layout-padding">
    <!-- 顶部 Steps -->
    <el-card shadow="hover" class="mb15">
      <el-steps
        :active="store.currentStep"
        finish-status="success"
        align-center
      >
        <el-step
          v-for="item in stepTitles"
          :key="item.key"
          :title="$t(item.title)"
          :description="item.desc ? $t(item.desc) : ''"
        />
      </el-steps>
    </el-card>

    <!-- 缺失项提示：canPublish 不满足时在操作区旁展示 -->
    <el-alert
      v-if="missingItems.length > 0"
      type="warning"
      :closable="false"
      show-icon
      class="mb15"
      :title="
        $t('message.workstation.missingHint', { count: missingItems.length })
      "
      :description="missingItems.join('、')"
    />

    <el-row :gutter="16">
      <!-- 左侧：表单区，按 currentStep 切换子组件 -->
      <el-col :span="16">
        <el-card shadow="hover">
          <template #header>
            <div class="workstation-step-header">
              <span>{{
                stepTitles[store.currentStep]?.title
                  ? $t(stepTitles[store.currentStep].title as string)
                  : $t(stepTitles[0].title as string)
              }}</span>
              <el-button
                link
                type="primary"
                size="small"
                @click="onGoAdvanced"
                >{{ $t("message.workstation.advanced") }}</el-button
              >
            </div>
          </template>

          <!-- 动态步骤组件：Task 8 真实 Step* 组件 -->
          <component :is="stepComp" ref="stepRef" />

          <!-- 步骤导航 -->
          <div class="workstation-step-actions">
            <el-button :disabled="store.currentStep === 0" @click="onPrev">{{
              $t("message.workstation.prev")
            }}</el-button>
            <el-button
              v-if="store.currentStep < 5"
              type="primary"
              :disabled="!store.canNext"
              @click="onNext"
              >{{ $t("message.workstation.next") }}</el-button
            >
          </div>

          <!-- 预检 / 发布 -->
          <div class="workstation-publish-actions">
            <el-button :disabled="!store.canPublish" @click="onPrecheck">{{
              $t("message.workstation.precheck")
            }}</el-button>
            <el-button
              type="primary"
              :disabled="!store.canPublish"
              @click="onPublish"
              >{{ $t("message.workstation.publish") }}</el-button
            >
            <span v-if="!store.canPublish" class="workstation-bottom-hint">{{
              $t("message.workstation.bottomHint")
            }}</span>
          </div>
        </el-card>
      </el-col>

      <!-- 右侧：预览 / 日志（复用 StepPreview 只读聚合） -->
      <el-col :span="8">
        <el-card shadow="hover" class="workstation-preview-card">
          <template #header>
            <span>{{ $t("message.workstation.previewTitle") }}</span>
          </template>
          <RightPreview />
          <el-empty
            v-if="!hasPreviewContent"
            :description="$t('message.workstation.previewEmpty')"
            :image-size="80"
          />
        </el-card>
      </el-col>
    </el-row>

    <!-- 新手指引向导：首启自弹 + Header 常驻入口重播 -->
    <OnboardingWizard v-model="onboardingVisible" />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  ref,
  watch,
  defineAsyncComponent,
} from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { ElMessage } from "element-plus";
import { useWorkstationStore } from "@/stores/workstation";
import { useOnboardingStore } from "@/stores/onboarding";
import { useProjectDb } from "@/database/project/index";
import { useGitDb } from "@/database/git/index";
import { useTfsDb } from "@/database/teamFoundationServer/index";
import { useServerDb } from "@/database/servers/index";
import mittBus from "@/utils/mitt";

const { t } = useI18n();
const store = useWorkstationStore();
const router = useRouter();
const onboarding = useOnboardingStore();
const onboardingVisible = ref(false);

const OnboardingWizard = defineAsyncComponent(
  () => import("./components/OnboardingWizard.vue")
);

// 真实步骤组件（异步加载，复用既有 Dialog）
const StepProject = defineAsyncComponent(
  () => import("./components/StepProject.vue")
);
const StepSource = defineAsyncComponent(
  () => import("./components/StepSource.vue")
);
const StepServers = defineAsyncComponent(
  () => import("./components/StepServers.vue")
);
const StepAppconfig = defineAsyncComponent(
  () => import("./components/StepAppconfig.vue")
);
const StepPreview = defineAsyncComponent(
  () => import("./components/StepPreview.vue")
);

// 欢迎占位：保留轻量占位，仅 Step 0 使用
const WelcomePlaceholder = defineComponent({
  name: "WelcomePlaceholder",
  setup() {
    return () =>
      h(
        "div",
        { class: "workstation-placeholder" },
        t("message.workstation.welcomePlaceholder")
      );
  },
});

// 右侧预览（只读聚合）：复用 StepPreview 组件的只读展示，右侧保持常驻
// 与 StepPreview.vue 的 loadAll 一致：把 draft 中的 ID 解析成可读名称，而非显示数字
const RightPreview = defineComponent({
  name: "RightPreview",
  setup() {
    const s = useWorkstationStore();
    const projectDb = useProjectDb();
    const gitDb = useGitDb();
    const tfsDb = useTfsDb();
    const serverDb = useServerDb();
    const projectName = ref("");
    const gitName = ref("");
    const tfsName = ref("");
    const serverNames = ref<string[]>([]);

    // 解析 draft 中的 ID 为名称（取值方式与 StepPreview.loadAll 完全一致）
    const loadAll = async () => {
      projectName.value = "";
      gitName.value = "";
      tfsName.value = "";
      serverNames.value = [];
      if (s.draft.projectId) {
        try {
          const r = await projectDb.getProjectById(s.draft.projectId as number);
          const data = (r as any)?.data?.data;
          if (data?.name) projectName.value = data.name;
        } catch {
          /* ignore */
        }
      }
      if (s.draft.gitId) {
        try {
          const r = await gitDb.getGitById(s.draft.gitId as number);
          const d = (r as any)?.data?.data;
          if (d?.gitName) gitName.value = d.gitName;
        } catch {
          /* ignore */
        }
      }
      if (s.draft.tfsId) {
        try {
          const r = await tfsDb.getTfsById(s.draft.tfsId as number);
          const d = (r as any)?.data?.data;
          if (d?.tfsName) tfsName.value = d.tfsName;
        } catch {
          /* ignore */
        }
      }
      if (s.draft.serverIds?.length) {
        const ids = [...s.draft.serverIds];
        const results = await Promise.all(
          ids.map(async (id) => {
            try {
              const r = await serverDb.getServerById(id as number);
              const d = (r as any)?.data?.data;
              if (d?.name) return d.name as string;
              return `#${id}`;
            } catch {
              return `#${id}`;
            }
          })
        );
        serverNames.value = results;
      }
    };

    onMounted(() => loadAll());
    watch(
      () => [
        s.draft.projectId,
        s.draft.gitId,
        s.draft.tfsId,
        s.draft.serverIds,
      ],
      () => loadAll(),
      { deep: true }
    );

    // 代码源标签：与 StepPreview.sourceLabel 一致
    const sourceLabel = computed(() => {
      const parts: string[] = [];
      if (gitName.value) parts.push(`Git: ${gitName.value}`);
      if (tfsName.value) parts.push(`TFS: ${tfsName.value}`);
      return parts.join(" + ");
    });

    const unselected = t("message.workstation.previewUnselected");
    return () =>
      h("div", { class: "workstation-preview" }, [
        h(
          "div",
          { class: "workstation-preview-row" },
          `${t("message.workstation.previewProject")}: ${
            projectName.value || unselected
          }`
        ),
        h(
          "div",
          { class: "workstation-preview-row" },
          `${t("message.workstation.previewSource")}: ${
            sourceLabel.value || unselected
          }`
        ),
        h(
          "div",
          { class: "workstation-preview-row" },
          `${t("message.workstation.previewServers")}: ${
            serverNames.value.length
              ? serverNames.value.join("、")
              : unselected
          }`
        ),
        h(
          "div",
          { class: "workstation-preview-row" },
          `${t("message.workstation.previewAppconfig")}: ${
            Object.keys(s.draft.appconfigDraft || {}).length
              ? t("message.workstation.previewConfigured")
              : t("message.workstation.previewUnconfigured")
          }`
        ),
      ]);
  },
});

// 6 步对应 WorkstationStep 0|1|2|3|4|5，与 store.currentStep 逐一映射
const stepTitles = [
  { key: "welcome", title: "message.workstation.steps.welcome", desc: "" },
  { key: "project", title: "message.workstation.steps.project", desc: "" },
  {
    key: "source",
    title: "message.workstation.steps.source",
    desc: "message.workstation.steps.sourceDesc",
  },
  { key: "servers", title: "message.workstation.steps.servers", desc: "" },
  { key: "appconfig", title: "message.workstation.steps.appconfig", desc: "" },
  { key: "preview", title: "message.workstation.steps.preview", desc: "" },
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
  return !!(
    store.draft.projectId ||
    store.draft.tfsId ||
    store.draft.gitId ||
    store.draft.serverIds.length
  );
});

// 缺失项：用于 el-alert 与底部禁用态的文案
const missingItems = computed(() => {
  const items: string[] = [];
  if (!store.draft.projectId)
    items.push(t("message.workstation.missingProject"));
  if (!store.draft.tfsId && !store.draft.gitId) {
    // 仅当应用配置的 dllMode 需要代码源时才提示缺失，否则代码源可跳过
    const ac: any = store.draft.appconfigDraft;
    const needSource = ac?.dllMode === 'TFS' || ac?.dllMode === 'Git';
    if (needSource) items.push(t("message.workstation.missingSource"));
  }
  if (!store.draft.serverIds.length)
    items.push(t("message.workstation.missingServers"));
  if (
    !store.draft.appconfigDraft ||
    Object.keys(store.draft.appconfigDraft).length === 0
  )
    items.push(t("message.workstation.missingAppconfig"));
  return items;
});

const onPrev = () => {
  if (store.currentStep > 0) {
    store.currentStep = (store.currentStep - 1) as WorkstationStep;
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
    store.currentStep = (store.currentStep + 1) as WorkstationStep;
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
  overflow-y: auto !important;
  min-height: 0;
}

/* 主内容区（el-row）：让长表单不被 flex 压缩，撑开容器滚动高度 */
.workstation-container > .el-row {
  flex-shrink: 0 !important;
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

.workstation-publish-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.workstation-bottom-hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.mb15 {
  margin-bottom: 15px;
  flex-shrink: 0;
}
</style>

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

          <!-- 动态步骤组件：Task 8 将替换为真实 Step* 组件，当前为占位 -->
          <component :is="stepComp" />

          <!-- 步骤导航 -->
          <div class="workstation-step-actions">
            <el-button :disabled="store.currentStep === 0" @click="onPrev">上一步</el-button>
            <el-button type="primary" :disabled="!store.canNext" @click="onNext">下一步</el-button>
          </div>
        </el-card>
      </el-col>

      <!-- 右侧：预览 / 日志 -->
      <el-col :span="8">
        <el-card shadow="hover" class="workstation-preview-card">
          <template #header>
            <span>预览与日志</span>
          </template>
          <StepPreview />
          <el-empty v-if="!hasPreviewContent" description="完成左侧步骤后此处展示待发布清单与日志" :image-size="80" />
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
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { useWorkstationStore } from "@/stores/workstation";

// 占位步骤组件：Task 8 将替换为 src/views/workstation/components/Step*.vue
// 此处以轻量 defineComponent 占位，保证构建通过且不引入不存在文件
const StepProjectPlaceholder = defineComponent({
  name: "StepProjectPlaceholder",
  setup() {
    return () => h("div", { class: "workstation-placeholder" }, "步骤 1：项目选择（占位，Task 8 实现）");
  },
});

const StepSourcePlaceholder = defineComponent({
  name: "StepSourcePlaceholder",
  setup() {
    return () => h("div", { class: "workstation-placeholder" }, "步骤 2：代码源 Git/TFS 二选一（占位，Task 8 实现）");
  },
});

const StepServersPlaceholder = defineComponent({
  name: "StepServersPlaceholder",
  setup() {
    return () => h("div", { class: "workstation-placeholder" }, "步骤 3：服务器多选与发现（占位，Task 8 实现）");
  },
});

const StepAppconfigPlaceholder = defineComponent({
  name: "StepAppconfigPlaceholder",
  setup() {
    return () => h("div", { class: "workstation-placeholder" }, "步骤 4：应用配置（占位，Task 8 实现）");
  },
});

const StepPreviewPlaceholder = defineComponent({
  name: "StepPreviewPlaceholder",
  setup() {
    return () => h("div", { class: "workstation-placeholder" }, "步骤 5：聚合预览（占位，Task 8 实现）");
  },
});

// 右侧预览/日志占位：后续 Task 8 抽为独立 components/StepPreview.vue
const StepPreview = defineComponent({
  name: "StepPreview",
  setup() {
    const store = useWorkstationStore();
    return () =>
      h("div", { class: "workstation-preview" }, [
        h("div", { class: "workstation-preview-row" }, `项目: ${store.draft.projectId ?? "未选择"}`),
        h("div", { class: "workstation-preview-row" }, `代码源: ${store.draft.tfsId ?? store.draft.gitId ?? "未选择"}`),
        h("div", { class: "workstation-preview-row" }, `服务器: ${store.draft.serverIds.length ? store.draft.serverIds.join(", ") : "未选择"}`),
        h("div", { class: "workstation-preview-row" }, `应用配置: ${Object.keys(store.draft.appconfigDraft || {}).length ? "已配置" : "未配置"}`),
      ]);
  },
});

const store = useWorkstationStore();
const router = useRouter();

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
  StepProjectPlaceholder,
  StepProjectPlaceholder,
  StepSourcePlaceholder,
  StepServersPlaceholder,
  StepAppconfigPlaceholder,
  StepPreviewPlaceholder,
] as const;

const stepComp = computed(() => {
  const idx = store.currentStep;
  return stepMap[idx] ?? StepPreviewPlaceholder;
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

const onNext = () => {
  if (!store.canNext) {
    ElMessage.warning("请先完成当前步骤必填项");
    return;
  }
  if (store.currentStep < 5) {
    store.currentStep = ((store.currentStep + 1) as WorkstationStep);
    store.persist();
  }
};

const onPrecheck = () => {
  if (!store.canPublish) {
    ElMessage.warning(`预检前请先完成：${missingItems.value.join("、")}`);
    return;
  }
  ElMessage.info("预检（占位）：Task 9 将聚合 draft 并复用既有链路");
};

const onPublish = () => {
  if (!store.canPublish) {
    ElMessage.warning(`发布前请先完成：${missingItems.value.join("、")}`);
    return;
  }
  ElMessage.info("发布（占位）：Task 9 将聚合 draft 并复用既有发布引擎");
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

onMounted(() => {
  store.restore();
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

<template>
  <div class="step-project">
    <el-form label-width="90px" size="default">
      <el-form-item label="选择项目" required>
        <div style="display: flex; gap: 10px; width: 100%">
          <el-select
            v-model="selectedId"
            placeholder="请选择项目"
            filterable
            clearable
            style="flex: 1"
            @change="onChange"
          >
            <el-option
              v-for="p in projectList"
              :key="p.id"
              :label="`${p.name} (${p.code})`"
              :value="p.id"
            />
          </el-select>
          <el-button type="primary" plain @click="onOpenNew"
            >新建项目</el-button
          >
        </div>
      </el-form-item>
      <el-form-item v-if="selectedProject" label="项目编码">
        <el-input :model-value="selectedProject.code" disabled />
      </el-form-item>
      <el-form-item v-if="selectedProject" label="描述">
        <el-input
          :model-value="selectedProject.description || '—'"
          type="textarea"
          :rows="2"
          disabled
        />
      </el-form-item>
    </el-form>
    <el-alert
      v-if="!selectedId"
      type="info"
      :closable="false"
      show-icon
      title="请选择一个项目后进入下一步"
      style="margin-top: 8px"
    />
    <!-- 复用既有 Dialog：异步加载，不复制表单 -->
    <component
      :is="ProjectDialogComp"
      ref="projectDialogRef"
      @refresh="onRefreshAfterAdd"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, defineAsyncComponent, watch } from "vue";
import { ElMessage } from "element-plus";
import { useProjectDb } from "@/database/project/index";
import { useWorkstationStore } from "@/stores/workstation";

const store = useWorkstationStore();
const projectDb = useProjectDb();

const ProjectDialogComp = defineAsyncComponent(
  () => import("@/views/project/components/projectDialog.vue")
);

const projectDialogRef = ref<any>(null);
const projectList = ref<RowProjectType[]>([]);
const selectedId = ref<number | null>(store.draft.projectId as number | null);

const selectedProject = computed(
  () => projectList.value.find((p) => p.id === selectedId.value) || null
);

const loadProjects = async () => {
  const r = await projectDb.getProjectList({
    code: null,
    name: null,
    sorting: "id DESC",
    skipCount: 0,
    maxResultCount: 1000,
  });
  if (r.code === 0) {
    projectList.value = r.data.data;
  } else {
    ElMessage.warning(r.msg);
  }
};

const onChange = (val: number | null) => {
  const changed = val !== (store.draft.projectId as number | null);
  selectedId.value = val as number | null;
  // 即时持久化，满足“on success persist to store.draft”
  store.draft.projectId = val as number | null;
  if (changed) {
    // 换项目后旧项目的应用配置草稿/表单缓存/服务器不再适用，清空防止误存到旧配置行
    (store.draft as any).appconfigDraft = {};
    (store.draft as any).appconfigFormCache = null;
    store.draft.serverIds = [];
  }
  store.persist();
};

// 新建后回填：监听 refresh 事件，刷新列表并选中最新一条
const onRefreshAfterAdd = async () => {
  await loadProjects();
  // 取 id 最大的一条作为新建结果（t_project 自增）
  if (projectList.value.length > 0) {
    const latest = [...projectList.value].sort(
      (a, b) => (b.id as number) - (a.id as number)
    )[0];
    // 仅当当前无选中时自动回填，避免覆盖用户已选
    if (!selectedId.value) {
      selectedId.value = latest.id as number;
      store.draft.projectId = latest.id as number;
      store.persist();
    }
  }
};

const onOpenNew = () => {
  projectDialogRef.value?.openDialog("add", null);
};

const validate = (): boolean => {
  if (!selectedId.value) {
    ElMessage.warning("请选择项目");
    return false;
  }
  store.draft.projectId = selectedId.value as number;
  store.persist();
  return true;
};

// 保持与外部 draft 同步（例如还原后）
watch(
  () => store.draft.projectId,
  (v) => {
    if (v !== selectedId.value) selectedId.value = v as number | null;
  }
);

onMounted(async () => {
  await loadProjects();
  // 若 draft 已有值且列表中存在，则回显
  if (
    store.draft.projectId &&
    !projectList.value.find((p) => p.id === store.draft.projectId)
  ) {
    // 已删除的项目保持显示提示
    ElMessage.warning("已选项目不存在，请重新选择");
  }
});

defineExpose({ validate });
</script>

<style scoped>
.step-project {
  padding: 4px 0;
}
</style>

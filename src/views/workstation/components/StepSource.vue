<template>
  <div class="step-source">
    <el-tabs v-model="activeTab" type="border-card">
      <el-tab-pane label="Git" name="git">
        <div style="display: flex; gap: 10px; align-items: flex-start">
          <el-select
            v-model="selectedGitId"
            placeholder="请选择 Git"
            filterable
            clearable
            style="flex: 1"
            @change="onGitChange"
          >
            <el-option
              v-for="g in gitList"
              :key="g.id"
              :label="g.gitName"
              :value="g.id"
            />
          </el-select>
          <el-button type="primary" plain @click="onOpenGitNew"
            >新建 Git</el-button
          >
        </div>
        <el-descriptions
          v-if="selectedGit"
          :column="1"
          border
          size="small"
          style="margin-top: 12px"
        >
          <el-descriptions-item label="仓库">{{
            selectedGit.gitRepository || "—"
          }}</el-descriptions-item>
          <el-descriptions-item label="分支">{{
            selectedGit.branchName || "—"
          }}</el-descriptions-item>
        </el-descriptions>
      </el-tab-pane>
      <el-tab-pane label="TFS" name="tfs">
        <div style="display: flex; gap: 10px; align-items: flex-start">
          <el-select
            v-model="selectedTfsId"
            placeholder="请选择 TFS"
            filterable
            clearable
            style="flex: 1"
            @change="onTfsChange"
          >
            <el-option
              v-for="t in tfsList"
              :key="t.id"
              :label="t.tfsName"
              :value="t.id"
            />
          </el-select>
          <el-button type="primary" plain @click="onOpenTfsNew"
            >新建 TFS</el-button
          >
        </div>
        <el-descriptions
          v-if="selectedTfs"
          :column="1"
          border
          size="small"
          style="margin-top: 12px"
        >
          <el-descriptions-item label="服务地址">{{
            selectedTfs.tfsServerUrl || "—"
          }}</el-descriptions-item>
          <el-descriptions-item label="本地根目录">{{
            selectedTfs.tfsLocalPath || "—"
          }}</el-descriptions-item>
        </el-descriptions>
      </el-tab-pane>
    </el-tabs>
    <el-alert
      v-if="!selectedGitId && !selectedTfsId"
      type="info"
      :closable="false"
      show-icon
      title="此步非必选：如无 Git/TFS 可直接点“下一步” — 将按“全部/DLL名称/日期”等其他模式发布"
      style="margin-top: 10px"
    />
    <el-alert
      v-else
      type="success"
      :closable="false"
      show-icon
      :title="`已选择：${selectedGit ? selectedGit.gitName : ''}${
        selectedGit && selectedTfs ? ' + ' : ''
      }${selectedTfs ? selectedTfs.tfsName : ''}`"
      style="margin-top: 10px"
    />

    <component :is="GitDialogComp" ref="gitDialogRef" @refresh="loadGit" />
    <component :is="TfsDialogComp" ref="tfsDialogRef" @refresh="loadTfs" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, defineAsyncComponent, watch } from "vue";
import { useGitDb } from "@/database/git/index";
import { useTfsDb } from "@/database/teamFoundationServer/index";
import { useWorkstationStore } from "@/stores/workstation";

const store = useWorkstationStore();
const gitDb = useGitDb();
const tfsDb = useTfsDb();

const GitDialogComp = defineAsyncComponent(
  () => import("@/views/git/components/gitDialog.vue")
);
const TfsDialogComp = defineAsyncComponent(
  () => import("@/views/teamFoundationServer/components/tfsDialog.vue")
);

const gitDialogRef = ref<any>(null);
const tfsDialogRef = ref<any>(null);

const activeTab = ref<"git" | "tfs">(
  store.draft.gitId ? "git" : store.draft.tfsId ? "tfs" : "git"
);
const gitList = ref<RowGitType[]>([]);
const tfsList = ref<RowTfsType[]>([]);
const selectedGitId = ref<number | null>(store.draft.gitId as number | null);
const selectedTfsId = ref<number | null>(store.draft.tfsId as number | null);

const selectedGit = computed(
  () => gitList.value.find((g) => g.id === selectedGitId.value) || null
);
const selectedTfs = computed(
  () => tfsList.value.find((t) => t.id === selectedTfsId.value) || null
);

const loadGit = async () => {
  const r = await gitDb.getGitList({
    gitName: null,
    gitRepository: null,
    sorting: "id DESC",
    skipCount: 0,
    maxResultCount: 1000,
  });
  if (r.code === 0) gitList.value = r.data.data;
};
const loadTfs = async () => {
  const r = await tfsDb.getTfsList({
    tfsName: null,
    tfsSourcePath: null,
    sorting: "id DESC",
    skipCount: 0,
    maxResultCount: 1000,
  });
  if (r.code === 0) tfsList.value = r.data.data;
};

const persist = () => {
  store.draft.gitId = selectedGitId.value as number | null;
  store.draft.tfsId = selectedTfsId.value as number | null;
  store.persist();
};

const onGitChange = () => persist();
const onTfsChange = () => persist();

const onOpenGitNew = () => gitDialogRef.value?.openDialog("add", null);
const onOpenTfsNew = () => tfsDialogRef.value?.openDialog("add", null);

const validate = (): boolean => {
  // 代码源可跳过：无 Git/TFS 时按其他 dllMode 发布，不再强阻塞
  persist();
  return true;
};

watch(
  () => store.draft.gitId,
  (v) => {
    if (v !== selectedGitId.value) selectedGitId.value = v as number | null;
  }
);
watch(
  () => store.draft.tfsId,
  (v) => {
    if (v !== selectedTfsId.value) selectedTfsId.value = v as number | null;
  }
);

onMounted(async () => {
  await Promise.all([loadGit(), loadTfs()]);
});

defineExpose({ validate });
</script>

<style scoped>
.step-source {
  padding: 4px 0;
}
</style>

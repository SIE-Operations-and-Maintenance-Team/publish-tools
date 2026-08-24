import { defineStore } from 'pinia';
import { Session } from '@/utils/storage';

export const useWorkstationStore = defineStore('workstation', {
  state: () => ({
    draft: {
      projectId: null,
      tfsId: null,
      gitId: null,
      serverIds: [],
      appconfigDraft: {} as any,
      // 应用配置步骤未校验的表单快照（防手滑离开后丢失），仅同项目有效
      appconfigFormCache: null as any,
      publishOptions: { isBackup: 1, isNewVersion: null },
    } as WorkstationDraft,
    currentStep: 0 as WorkstationStep,
  }),
  getters: {
    canNext: (s) => {
      if (s.currentStep === 1) return !!s.draft.projectId;
      if (s.currentStep === 2) return true; // 代码源可跳过：按其他 dllMode（全部/DLL名称等）发布时无需 TFS/Git
      if (s.currentStep === 3) return s.draft.serverIds.length > 0;
      if (s.currentStep === 4) return true; // 应用配置由 StepAppconfig.validate() 负责校验与落库，允许点击“下一步”进入校验
      return true;
    },
    canPublish: (s) => {
      // 代码源仅当 appconfig 的 dllMode 为 TFS/Git 时才必需，否则可跳过
      const ac: any = s.draft.appconfigDraft;
      const needSource = ac?.dllMode === 'TFS' || ac?.dllMode === 'Git';
      const hasSource = !!(s.draft.tfsId || s.draft.gitId);
      if (needSource && !hasSource) return false;
      return !!(s.draft.projectId && s.draft.serverIds.length > 0 && s.draft.appconfigDraft && Object.keys(s.draft.appconfigDraft as any).length > 0);
    },
  },
  actions: {
    validateStep(_n: number) {
      /* 复用各 Dialog 的 formRules 思路，首期仅判空 */
      void _n;
    },
    persist() {
      Session.set('workstationDraft', JSON.stringify(this.$state));
    },
    restore() {
      const raw = Session.get('workstationDraft');
      if (raw) Object.assign(this, JSON.parse(raw as string));
    },
    reset() {
      this.draft = {
        projectId: null,
        tfsId: null,
        gitId: null,
        serverIds: [],
        appconfigDraft: {} as any,
        appconfigFormCache: null as any,
        publishOptions: { isBackup: 1, isNewVersion: null },
      } as WorkstationDraft;
      this.currentStep = 0;
      Session.remove('workstationDraft');
    },
  },
});

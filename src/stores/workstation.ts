import { defineStore } from 'pinia';
import { Session } from '@/utils/storage';

export const useWorkstationStore = defineStore('workstation', {
  state: () => ({
    draft: {
      projectId: null,
      tfsId: null,
      gitId: null,
      serverIds: [],
      appconfigDraft: { publishMode: 0 } as any,
      publishOptions: { isBackup: 1, isNewVersion: null },
    } as WorkstationDraft,
    currentStep: 0 as WorkstationStep,
  }),
  getters: {
    canNext: (s) => {
      if (s.currentStep === 1) return !!s.draft.projectId;
      if (s.currentStep === 2) return !!(s.draft.tfsId || s.draft.gitId);
      if (s.currentStep === 3) return s.draft.serverIds.length > 0;
      if (s.currentStep === 4) return !!s.draft.appconfigDraft && Object.keys(s.draft.appconfigDraft).length > 0;
      return true;
    },
    canPublish: (s) => !!(s.draft.projectId && (s.draft.tfsId || s.draft.gitId) && s.draft.serverIds.length > 0 && s.draft.appconfigDraft && Object.keys(s.draft.appconfigDraft as any).length > 0),
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
        appconfigDraft: { publishMode: 0 } as any,
        publishOptions: { isBackup: 1, isNewVersion: null },
      } as WorkstationDraft;
      this.currentStep = 0;
      Session.remove('workstationDraft');
    },
  },
});

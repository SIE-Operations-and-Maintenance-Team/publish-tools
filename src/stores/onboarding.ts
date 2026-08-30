import { defineStore } from 'pinia';
import { Local } from '@/utils/storage';

export const useOnboardingStore = defineStore('onboarding', {
  state: (): OnboardingState => ({
    completed: Local.get('hasCompletedOnboarding') === 'true',
    // 首次安装只自动弹出一次:弹出后即标记,用户直接关闭也不再自动弹
    autoShown: Local.get('hasOnboardingAutoShown') === 'true',
    currentStep: 0,
    skippedSteps: [] as number[],
  }),
  actions: {
    shouldAutoOpen() {
      return !this.completed && !this.autoShown;
    },
    markCompleted() {
      this.completed = true;
      Local.set('hasCompletedOnboarding', 'true');
      Local.set('onboardingState', JSON.stringify(this.$state));
    },
    markAutoShown() {
      this.autoShown = true;
      Local.set('hasOnboardingAutoShown', 'true');
      Local.set('onboardingState', JSON.stringify(this.$state));
    },
    skipStep(n: number) {
      if (!this.skippedSteps.includes(n)) this.skippedSteps.push(n);
      this.persist();
    },
    persist() {
      Local.set('onboardingState', JSON.stringify(this.$state));
    },
    restore() {
      const raw = Local.get('onboardingState');
      if (raw) Object.assign(this, JSON.parse(raw as string));
    },
  },
});

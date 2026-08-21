import { defineStore } from 'pinia';
import { Local } from '@/utils/storage';

export const useOnboardingStore = defineStore('onboarding', {
  state: (): OnboardingState => ({
    completed: Local.get('hasCompletedOnboarding') === 'true',
    currentStep: 0,
    skippedSteps: [] as number[],
  }),
  actions: {
    shouldAutoOpen() {
      return !this.completed;
    },
    markCompleted() {
      this.completed = true;
      Local.set('hasCompletedOnboarding', 'true');
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

declare type WorkstationDraft = {
  projectId: number | null;
  tfsId: number | null;
  gitId: number | null;
  serverIds: number[];
  appconfigDraft: Partial<RowAppconfigType> & { publishMode: number };
  // 应用配置步骤未校验的表单快照（防手滑离开后丢失），仅同项目有效
  appconfigFormCache?: any;
  publishOptions: { isBackup: number; isNewVersion: boolean | null; backupBasePath?: string };
  notes?: string;
};

declare type WorkstationStep = 0 | 1 | 2 | 3 | 4 | 5;

declare type OnboardingState = {
  completed: boolean;
  // 首次安装自动弹出已执行过(弹出即标记,直接关闭也不再自动弹)
  autoShown: boolean;
  currentStep: number;
  skippedSteps: number[];
};

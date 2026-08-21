declare type WorkstationDraft = {
  projectId: number | null;
  tfsId: number | null;
  gitId: number | null;
  serverIds: number[];
  appconfigDraft: Partial<RowAppconfigType> & { publishMode: number };
  publishOptions: { isBackup: number; isNewVersion: boolean | null; backupBasePath?: string };
  notes?: string;
};

declare type WorkstationStep = 0 | 1 | 2 | 3 | 4 | 5;

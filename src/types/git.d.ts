// 定义类型
declare type GetGitParams = {
  gitName: string | null;
  gitRepository: string | null;
  maxResultCount: number;
  skipCount: number;
  sorting?: string;
}
declare type gitSelectValueType = {
	placeholder: string;
	value: string;
};
declare type SelectGitType = {
	id: number | null;
	gitName: string | null;
	selectModel: "日期" | "commit",
	selectValue: gitSelectValueType[];
};
declare type RowGitType = {
  id: number | null;
  gitName: string | null;
  gitRepository: string | null;
  gitPath: string | null;
  branchName: string | null;
  remark: string | null;
}



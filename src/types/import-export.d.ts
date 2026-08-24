// src/types/import-export.d.ts

/** 导出文件顶层结构 */
declare type ExportFile = {
	version: 1 | 2;          // v2：新增 tfsConfigs/gitConfigs（TFS/Git 配置随导出）
	exportedAt: string;        // ISO 8601
	items: ExportItem[];
};

/** 单个导出项 */
declare type ExportItem = {
	project: ExportProject;
	appconfig: ExportAppconfig;
	servers: ExportServer[];
	tfsConfigs?: ExportTfsConfig[];   // v2 新增，本 item 引用的 TFS 配置（至多一条，不含 id）
	gitConfigs?: ExportGitConfig[];   // v2 新增，本 item 引用的 Git 配置（至多一条，不含 id）
};

/** 导出项目字段（不含 id） */
declare type ExportProject = {
	code: string;
	name: string;
	description: string | null;
	isDefault: number | null;
	assemblyOutPath: string | null;
};

/** 导出应用配置字段（不含 id, projectId） */
declare type ExportAppconfig = {
	environment: number;
	msBuildPath: string | null;
	dllMode: string | null;
	dllModeValue: string | null;
	buildMode: string | null;
	configItemsJson: string;
};

/** 导出服务器字段（不含 id, projectId） */
declare type ExportServer = {
	oldServerId: number;   // 保存原始 server ID 用于导入时重映射
	name: string;
	os: number;
	ip: string;
	port: number;
	account: string;
	pwd: string;
	description: string | null;
	sourceKey?: string | null;   // SSH MCP 同步来源键（v2 可选，旧导出文件无此字段，导入后视为本地自建）
};

/** 导出 TFS 配置字段（不含 id，oldTfsId 用于导入时重映射） */
declare type ExportTfsConfig = {
	oldTfsId: number;
	tfsName: string | null;
	tfsServerUrl: string | null;
	tfsSourcePath: string | null;
	tfsLocalPath: string | null;
	tfvcPath: string | null;
	remark: string | null;
};

/** 导出 Git 配置字段（不含 id，oldGitId 用于导入时重映射） */
declare type ExportGitConfig = {
	oldGitId: number;
	gitName: string | null;
	gitRepository: string | null;
	gitPath: string | null;
	branchName: string | null;
	remark: string | null;
};

/** 导入预览行 */
declare type ImportPreviewItem = {
	index: number;
	projectCode: string;
	projectName: string;
	environment: number;
	serverCount: number;
	conflict: boolean;          // 当前库中 project.code 是否冲突
};

/** 单条导入结果 */
declare type ImportResult = {
	index: number;
	success: boolean;
	projectCode: string;
	environment: number;
	message: string;
};

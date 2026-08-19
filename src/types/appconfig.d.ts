// appconfigTableParam
declare type GetAppconfigTableParams = {
	skipCount: number;
	maxResultCount: number;
	projectId: number | null;
	environment: number | null;
	sorting: string | null;
}

// AppconfigType
declare type CommonAppconfigType = {
	clientPath: string | null;
	serverPath: string | null;
}

// webApiHostConfig
declare type WebApiHostConfigType = CommonAppconfigType & {
	serverIds: number[];
	serverArr: SelectServerType[];
}

// scheduleServerConfig
declare type ScheduleServerConfigType = CommonAppconfigType & {
	serverIds: number[];
	serverArr: SelectServerType[];
}

// webClientConfig
declare type WebClientConfigType = CommonAppconfigType & {
	serverIds: number[];
	serverArr: SelectServerType[];
}

// wpfClientConfig
declare type WpfClientConfigType = CommonAppconfigType & {
	// 多服务器（与 WebApiHost 等一致）
	serverIds: number[];
	serverArr: SelectServerType[];
	// 存量兼容 + 本地发布（保留）
	serverId: number | null;
	serverName: string | null;
	isCompress: number | null;
	generateDirJson: string | null;
	compressFileJson: string | null;
}

// spcMonitorConfig
declare type SpcMonitorConfigType = CommonAppconfigType & {
	serverIds: number[];
	serverArr: SelectServerType[];
}

// configItemsType
declare type ConfigItemsType = {
	webApiHost: WebApiHostConfigType;
	scheduleServer: ScheduleServerConfigType;
	webClient: WebClientConfigType;
	wpfClient: WpfClientConfigType;
	spcMonitor: SpcMonitorConfigType;
	isRebuild: number | null;
	isBackup: number | null;
	isNewVersion: boolean | null;
	backupBasePath?: string | null;  // 服务端备份基础路径
}

// appconfig
declare type RowAppconfigType = {
	id: number | null;
	projectId: number | null;
	projectName: string | null;
	environment: number | null;
	msBuildPath: string | null;
	dllMode: string | null;
	dllModeValue: string | null;
	buildMode: string | null;
	configItemsJson: string;
	configItems: ConfigItemsType;
};

interface AppconfigTableType extends TableType<GetAppconfigTableParams> {
	data: RowAppconfigType[];
}

declare interface AppconfigState {
	tableData: AppconfigTableType;
}
// 发布结果：0=发布中 1=成功 2=失败 3=已中止
declare type PublishResultType = 0 | 1 | 2 | 3;

// 断点续跑检查点（写入 t_publish_record.stage_json）
declare type PublishStageType = {
	// 编译是否已完成
	buildDone: boolean;
	// 发布前备份是否已完成
	backupDone: boolean;
	// 已完成的服务实例键（serviceType|serverId|identity|port）
	doneKeys: string[];
	// 最近一次失败的服务实例键
	failedKeys: string[];
	// 本次发布包含的服务类型（发布前被「移除」的服务不在其中，续跑时据此保持一致）
	enabledServices?: string[];
	// 已整类发布完成的服务类型（续跑时不再重复发布）
	completedServices?: string[];
	// 本次发布类型（一键发布/手动发布），续跑时据此决定是否需要补编译
	publishType?: string;
};

// 发布说明（写入 t_publish_record.change_log_json）
declare type PublishChangeLogType = {
	// 涉及的 TFS 变更集编号
	changeSets: number[];
	// 涉及的提交人
	users: string[];
	// 涉及的代码项
	items: string[];
	// 渲染好的发布说明（Markdown）
	text: string;
};

// 单个服务实例的发布结果（写入 t_publish_record.service_results_json）
declare type PublishServiceResultType = {
	// 服务实例键（serviceType|serverId|identity|port）
	// 同一实例只保留最新一次结果，续跑重试成功后覆盖此前的失败记录
	key?: string;
	serviceType: string;
	success: boolean;
	errors: string[];
};

// 发布台账
declare type RowPublishRecordType = {
	id: number | null;
	projectId: number | null;
	projectName: string | null;
	environment: number | null;
	startDate: string | null;
	endDate: string | null;
	durationMs: number | null;
	result: PublishResultType | null;
	resumeCount: number | null;
	stageJson: string | null;
	stage: PublishStageType;
	changeLogJson: string | null;
	changeLog: PublishChangeLogType;
	dllItemsJson: string | null;
	dllItems: string[];
	serviceResultsJson: string | null;
	serviceResults: PublishServiceResultType[];
	backupId: number | null;
	appconfigSnapshotJson: string | null;
	remark: string | null;
};

// 发布台账查询参数
declare type GetPublishRecordTableParams = {
	skipCount: number;
	maxResultCount: number;
	projectName: string | null;
	environment: number | null;
	result: number | null;
	sorting: string | null;
};

interface PublishRecordTableType extends TableType<GetPublishRecordTableParams> {
	data: RowPublishRecordType[];
}

declare interface PublishRecordState {
	tableData: PublishRecordTableType;
}

// 发布锁
declare type RowPublishLockType = {
	id: number | null;
	projectId: number | null;
	environment: number | null;
	token: string | null;
	acquiredAt: string | null;
	expireAt: string | null;
	remark: string | null;
};

// 单实例/单服务发布结果（供断点续跑检查点使用）
declare type PublishTaskResult = {
	// 服务类型（WebApiHost / WebClient ...）
	serviceType: string;
	// 是否成功
	success: boolean;
	// 错误信息
	errors: string[];
};

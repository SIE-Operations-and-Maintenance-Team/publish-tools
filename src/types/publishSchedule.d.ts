/** 定时发布状态 */
declare type PublishScheduleStatus = 'pending' | 'executing' | 'completed' | 'cancelled' | 'failed';

/** 定时发布类型 */
declare type PublishScheduleType = '一键发布' | '手动发布';

/** 定时发布记录行类型 */
interface RowPublishScheduleType {
	id: number;
	projectId: number;
	projectName: string;
	environment: number;
	appconfigId: number;
	publishType: PublishScheduleType;
	scheduledTime: string;
	status: PublishScheduleStatus;
	createTime: string;
	executeTime?: string;
	resultLog?: string;
}

/** 定时发布查询参数 */
interface GetPublishScheduleTableParams {
	sorting?: string;
	skipCount: number;
	maxResultCount: number;
	status?: PublishScheduleStatus;
}

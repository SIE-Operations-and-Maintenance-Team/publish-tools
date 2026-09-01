/** 全局设置行类型（t_settings，id 恒 = 1） */
declare interface RowSettingsType {
	id: number;
	oneClickPublishEnabled: number;       // 0 关 / 1 开
	winServiceRetryCount: number;
	winServiceRetryInterval: number;  // 秒
	winCopyRetryCount: number;
	winCopyRetryInterval: number;         // 秒
	sshMcpUrl: string;                    // SSH MCP 管理服务 API 地址
	sshMcpAutoSync: number;               // 0 关 / 1 开，启动时自动下行同步
	startupMenu: string;                  // 启动默认菜单：'workstation' 发布工作台 / 'home' 项目发布
	updateTime?: string;
}

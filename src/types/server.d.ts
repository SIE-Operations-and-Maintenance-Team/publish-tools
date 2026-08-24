// serverTableParam
declare type GetServerTableParams = {
	skipCount: number;
	maxResultCount: number;
	projectId: number | null;
	name: string | null;
	sorting: string | null;
}

declare type SelectServerType = {
	id: number | null;
	name: string | null;
	serverPathArr: ServerOptionType[];
}

// server
declare type RowServerType = {
	id: number | null;
	projectId: number | null;
	projectName: string | null;
	name: string;
	os: number;
	ip: string;
	port: number;
	account: string;
	pwd: string;
	description: string | null;
	sourceKey?: string | null;   // SSH MCP 同步来源键（项目/环境/主机），有值=已纳管
	loading?: boolean | null;
};

interface ServerTableType extends TableType<GetServerTableParams> {
	data: RowServerType[];
}

declare interface ServerState {
	tableData: ServerTableType;
}

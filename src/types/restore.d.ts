// restoreTableParam
declare type GetRestoreTableParams = {
	skipCount: number;
	maxResultCount: number;
	backupId: number | null;
	sorting: string | null;
}

// restore
declare type RowRestoreType = {
	id: number | null;
	backupId: number | null;
	restoreDate: string | null;
	result: number | null;
	logContent: string | null;
};

interface RestoreTableType extends TableType<GetRestoreTableParams> {
	data: RowRestoreType[];
}

declare interface RestoreState {
	tableData: RestoreTableType;
}

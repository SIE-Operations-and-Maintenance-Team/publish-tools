// backupTableParam
declare type GetBackupTableParams = {
	skipCount: number;
	maxResultCount: number;
    projectName: string | null;
	environment: number | null;
	sorting: string | null;
}

// backPathType
declare type BackupPathType = {
	identity: string;
	publishPath: string;
	backupPath: string;
	backFiles: string[] | any;
}

// backServerType
declare type BackupServerType = {
	serverId: number;
	serverName: string;
	backupPaths: BackupPathType[];
}

// backItemsType
declare type BackupItemsType = {
	dllMode: string | null;
	dllModeValue: string | null;
	webApiHost: BackupServerType[] | null;
	scheduleServer: BackupServerType[] | null;
	webClient: BackupServerType[] | null;
	wpfClient: BackupServerType[] | null;
	spcMonitor: BackupServerType[] | null;
	isNewVersion: boolean | null;
}

// backup
declare type RowBackupType = {
	id: number | null;
	projectId: number | null;
	projectName: string | null;
	environment: number | null;
	backupDate: string | null;
	remark: string | null;
	backupItemsJson: string;
	backupItems: BackupItemsType;
};

interface BackupTableType extends TableType<GetBackupTableParams> {
	data: RowBackupType[];
}

declare interface BackupState {
	tableData: BackupTableType;
}
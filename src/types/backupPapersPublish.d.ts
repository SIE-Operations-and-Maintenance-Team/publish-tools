// BackupPapersPublish
declare type BackupCommonPapersPublishType = {
	projectName: string;
	environment: number;
	publishMode: number;
}

declare type BackupPublishServerConfigType = {
	serverIdentity: string;
	publishPath: string;
	backupPath: string;
	publishFiles: string[];
}

// BackupPublishServer
declare type BackupPublishServerType = {
	serverName: string;
	serverOs: number | null;
	serverIp: string | null;
	serverPort: number | null;
	serverAccount: string | null;
	serverPwd: string | null;
	serverConfigs: BackupPublishServerConfigType[];
}

// WpfPublishDir
declare type WpfPublishDirType = {
	dirName: string;
	files: string[];
}

// BackupPublishWpf
declare type BackupPublishWpfType = {
	serverName: string;
	serverOs: number | null;
	serverIp: string | null;
	serverPort: number | null;
	serverAccount: string | null;
	serverPwd: string | null;
	publishPath: string;
	backupPath: string;
	publishFiles: WpfPublishDirType[];
}

// BackupRemotePublish
declare type BackupRemotePublishType = BackupCommonPapersPublishType & {
	webApiHost: BackupPublishServerType[] | null;
	webClient: BackupPublishServerType[] | null;
	scheduleServer: BackupPublishServerType[] | null;
	spcMonitor: BackupPublishServerType[] | null;
	wpfClient: BackupPublishWpfType[] | null;
	isNewVersion: boolean | null;
};

// BackupLocalPublish
declare type BackupLocalPublishType = BackupCommonPapersPublishType & {
	webApiHost: BackupPublishServerType | null;
	webClient: BackupPublishServerType | null;
	scheduleServer: BackupPublishServerType | null;
	spcMonitor: BackupPublishServerType | null;
	wpfClient: BackupPublishWpfType | null;
	isNewVersion: boolean | null;
};

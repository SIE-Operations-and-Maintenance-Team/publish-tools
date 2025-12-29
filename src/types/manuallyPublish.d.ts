// PapersPublish
declare type CommonPapersPublishType = {
	projectName: string;
	environment: number;
	publishMode: number;
	isBackup: number;
	generateDate: string;
	notes?: string;
	isNewVersion: boolean | null;
}

declare type PublishServerConfigType = {
	serverIdentity: string;
	publishPath: string;
	publishFiles: string[];
}

// PublishServer
declare type PublishServerType = {
	serverName: string;
	serverOs: number | null;
	serverIp: string | null;
	serverPort: number | null;
	serverAccount: string | null;
	serverPwd: string | null;
	serverConfigs: PublishServerConfigType[];
}

// WpfPublishDir
declare type WpfPublishDirType = {
	dirName: string;
	files: string[];
}

// PublishWpf
declare type PublishWpfType = {
	serverName: string;
	serverOs: number | null;
	serverIp: string | null;
	serverPort: number | null;
	serverAccount: string | null;
	serverPwd: string | null;
	publishPath: string;
	publishFiles: WpfPublishDirType[];
}

// RemotePublish
declare type RemotePublishType = CommonPapersPublishType & {
	webApiHost: PublishServerType[] | null;
	webClient: PublishServerType[] | null;
	scheduleServer: PublishServerType[] | null;
	spcMonitor: PublishServerType[] | null;
	wpfClient: PublishWpfType | null;
};

// LocalPublish
declare type LocalPublishType = CommonPapersPublishType & {
	webApiHost: PublishServerType | null;
	webClient: PublishServerType | null;
	scheduleServer: PublishServerType | null;
	spcMonitor: PublishServerType | null;
	wpfClient: PublishWpfType | null;
};

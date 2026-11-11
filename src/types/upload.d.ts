// 增量上传结果（对应 Rust: UploadSyncResult）
declare type UploadSyncResultType = {
	// 本地文件总数
	total: number;
	// 实际上传的文件数
	uploaded: number;
	// 内容未变化而跳过的文件数
	skipped: number;
	// 实际传输的字节数
	bytes: number;
	// 准备阶段耗时（本地清单 + 远端目录扫描 + 目录创建），毫秒
	scanMs: number;
	// 实际传输耗时，毫秒
	transferMs: number;
};

// 增量上传进度事件负载（Tauri 事件 publish://upload-progress）
declare type UploadProgressPayloadType = {
	// 关联的日志标识
	tabId: string | null;
	// 已处理文件数（含跳过）
	current: number;
	// 文件总数
	total: number;
	// 已上传文件数
	uploaded: number;
	// 已跳过文件数
	skipped: number;
	// 当前处理的文件（相对路径）
	fileName: string;
};

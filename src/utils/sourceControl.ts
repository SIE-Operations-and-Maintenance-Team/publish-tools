import { ElMessageBox } from "element-plus";
import { cmdInvoke } from "@/utils/command";
import { useTfsDb } from "@/database/teamFoundationServer/index";
import { useGitDb } from "@/database/git/index";

export type PullLatestLogType = "log-info" | "log-warning" | "log-error" | "log-success";

export type PullLatestOptions = {
	// 手动触发为 true（脏工作区弹确认框）；定时发布等无人值守场景为 false
	interactive: boolean;
	log: (content: string, type?: PullLatestLogType) => void;
};

export type PullLatestData = {
	// true 表示本次未执行拉取（非 TFS/Git、分支不一致、脏工作区未确认）
	skipped: boolean;
};

// TFS 工作区没有挂起更改时的输出（中文/英文）
const TFS_NO_PENDING_CHANGES = ["没有挂起的更改", "No pending changes"];
// TFS 冲突标记
const TFS_CONFLICT_KEYWORDS = ["冲突", "Conflict"];

/**
 * 是否在发布前获取最新代码：存量配置缺少该字段时按开启处理
 */
export function isPullLatestEnabled(configItems?: ConfigItemsType | null) {
	if (!configItems) return true;
	return configItems.isPullLatest !== 0;
}

/**
 * 按应用配置的[获取dll方式]获取最新代码
 * 只支持 TFS / Git，其余方式直接跳过
 */
export async function pullLatestCode(
	appconfigData: RowAppconfigType,
	options: PullLatestOptions
): Promise<DataResultType<PullLatestData>> {
	const dllMode = appconfigData.dllMode;
	if (dllMode !== "TFS" && dllMode !== "Git") {
		options.log("当前发布配置未使用TFS/Git获取dll，无法确定源码仓库，未获取最新代码.", "log-warning");
		return buildResult(0, "当前配置没有源码管理信息，未获取最新代码", { skipped: true });
	}
	if (!appconfigData.dllModeValue) {
		options.log("当前发布配置缺少TFS/Git信息，未获取最新代码.", "log-warning");
		return buildResult(0, "当前配置缺少源码管理信息，未获取最新代码", { skipped: true });
	}

	let selectItem: SelectTfsType | SelectGitType;
	try {
		selectItem = JSON.parse(appconfigData.dllModeValue);
	} catch (error) {
		options.log(`解析[获取dll方式]配置失败：${JSON.stringify(error)}`, "log-error");
		return buildResult(1, "解析源码管理配置失败", { skipped: false });
	}
	const sourceId = Number(selectItem.id);
	if (!sourceId) {
		options.log("当前发布配置未选择具体的TFS/Git条目，未获取最新代码.", "log-warning");
		return buildResult(0, "未选择源码管理条目，未获取最新代码", { skipped: true });
	}

	return dllMode === "TFS"
		? await pullTfsLatest(sourceId, options)
		: await pullGitLatest(sourceId, options);
}

// 获取TFS最新代码
const pullTfsLatest = async (
	id: number,
	options: PullLatestOptions
): Promise<DataResultType<PullLatestData>> => {
	const dataResult = await useTfsDb().getTfsById(id);
	const tfsItem = dataResult.code === 0 ? dataResult.data.data : null;
	if (!tfsItem) {
		options.log("未查询到TFS配置，未获取最新代码.", "log-error");
		return buildResult(1, "未查询到TFS配置", { skipped: false });
	}
	const tfvcPath = String(tfsItem.tfvcPath || "");
	const localPath = String(tfsItem.tfsLocalPath || "");
	if (!tfvcPath) {
		options.log("TFS配置缺少[TFVC工具]路径，未获取最新代码.", "log-error");
		return buildResult(1, "TFS配置缺少TFVC工具路径", { skipped: false });
	}
	if (!localPath) {
		options.log("TFS配置缺少[本地根目录]，未获取最新代码.", "log-error");
		return buildResult(1, "TFS配置缺少本地根目录", { skipped: false });
	}

	options.log(`正在获取最新代码（TFS：${tfsItem.tfsName}，${localPath}），文件较多时可能需要几分钟…`);

	// 本地是否存在未提交修改
	const statusResult = await runLocalCommand(tfvcPath, ["status", localPath, "/recursive", "/noprompt"]);
	const statusOutput = toText(statusResult.data);
	const isDirty = statusResult.code !== 0 || !hasNoPendingChanges(statusOutput);
	if (isDirty) {
		const canContinue = await confirmDirty(options);
		if (!canContinue) return buildResult(0, "已跳过获取最新代码", { skipped: true });
	}

	const getResult = await runLocalCommand(tfvcPath, ["get", localPath, "/recursive", "/noprompt"]);
	if (getResult.code !== 0) {
		options.log(`获取最新代码失败：${toText(getResult.data)}`, "log-error");
		await logTfsConflicts(tfvcPath, localPath, options);
		options.log("若为冲突，请在 Visual Studio 中解决后重新发布.", "log-warning");
		return buildResult(1, "获取最新代码失败", { skipped: false });
	}

	options.log("获取最新代码完成.", "log-success");
	return buildResult(0, "获取最新代码完成", { skipped: false });
};

// 获取Git最新代码
const pullGitLatest = async (
	id: number,
	options: PullLatestOptions
): Promise<DataResultType<PullLatestData>> => {
	const dataResult = await useGitDb().getGitById(id);
	const gitItem = dataResult.code === 0 ? dataResult.data.data : null;
	if (!gitItem) {
		options.log("未查询到Git配置，未获取最新代码.", "log-error");
		return buildResult(1, "未查询到Git配置", { skipped: false });
	}
	const gitPath = String(gitItem.gitPath || "");
	const gitRepository = String(gitItem.gitRepository || "");
	const branchName = String(gitItem.branchName || "").trim();
	if (!gitPath) {
		options.log("Git配置缺少[Git工具]路径，未获取最新代码.", "log-error");
		return buildResult(1, "Git配置缺少Git工具路径", { skipped: false });
	}
	if (!gitRepository) {
		options.log("Git配置缺少[仓库路径]，未获取最新代码.", "log-error");
		return buildResult(1, "Git配置缺少仓库路径", { skipped: false });
	}

	// 当前分支与配置分支不一致时不拉取，避免更新到错误的代码
	const branchResult = await runGitCommand(gitPath, ["rev-parse", "--abbrev-ref", "HEAD"], gitRepository);
	if (branchResult.code !== 0) {
		options.log(`查询当前Git分支失败：${toText(branchResult.data)}`, "log-error");
		return buildResult(1, "查询当前Git分支失败", { skipped: false });
	}
	const currentBranch = toText(branchResult.data).trim();
	if (branchName && currentBranch !== branchName) {
		options.log(
			`当前分支[${currentBranch}]与配置分支[${branchName}]不一致，未获取最新代码；请切换到配置分支后重试.`,
			"log-warning"
		);
		return buildResult(0, "Git分支不一致，已跳过获取最新代码", { skipped: true });
	}

	// 本地是否存在未提交修改
	const statusResult = await runGitCommand(gitPath, ["status", "--porcelain"], gitRepository);
	if (statusResult.code !== 0) {
		options.log(`查询Git工作区状态失败：${toText(statusResult.data)}`, "log-error");
		return buildResult(1, "查询Git工作区状态失败", { skipped: false });
	}
	if (toText(statusResult.data).trim() !== "") {
		const canContinue = await confirmDirty(options);
		if (!canContinue) return buildResult(0, "已跳过获取最新代码", { skipped: true });
	}

	options.log(`正在获取最新代码（Git：${gitItem.gitName}，分支：${currentBranch}）…`);

	const pullResult = await runGitCommand(gitPath, ["pull", "--ff-only"], gitRepository);
	const pullOutput = toText(pullResult.data).trim();
	if (pullResult.code !== 0) {
		options.log(`获取最新代码失败：${pullOutput}`, "log-error");
		return buildResult(1, "获取最新代码失败", { skipped: false });
	}
	if (pullOutput) options.log(pullOutput);

	options.log("获取最新代码完成.", "log-success");
	return buildResult(0, "获取最新代码完成", { skipped: false });
};

// 本地有未提交修改时确认是否继续
const confirmDirty = async (options: PullLatestOptions) => {
	if (!options.interactive) {
		options.log("本地存在未提交修改，定时发布不做确认，已跳过获取最新代码.", "log-warning");
		return false;
	}
	try {
		await ElMessageBox.confirm(
			"检测到本地存在未提交修改，继续获取最新代码可能触发自动合并。是否继续？",
			"提示",
			{
				confirmButtonText: "继续",
				cancelButtonText: "取消",
				type: "warning",
			}
		);
		return true;
	} catch {
		options.log("已取消获取最新代码，继续使用本地现有代码.", "log-warning");
		return false;
	}
};

// 拉取失败时尽量列出TFS冲突项
const logTfsConflicts = async (
	tfvcPath: string,
	localPath: string,
	options: PullLatestOptions
) => {
	const statusResult = await runLocalCommand(tfvcPath, ["status", localPath, "/recursive", "/noprompt"]);
	if (statusResult.code !== 0) return;
	const conflictLines = toText(statusResult.data)
		.split("\n")
		.filter((line) => TFS_CONFLICT_KEYWORDS.some((keyword) => line.includes(keyword)));
	if (conflictLines.length < 1) return;
	options.log(`冲突项：\n${conflictLines.slice(0, 50).join("\n")}`, "log-error");
};

// 执行本地命令（不设工作目录）；命令失败时不做重试，避免重复拉取
const runLocalCommand = async (command: string, args: string[]) => {
	return await cmdInvoke<string>("execute_local_command", {
		command,
		args,
		retryCount: 1,
	});
};

// 执行Git命令（指定仓库目录）
const runGitCommand = async (command: string, args: string[], workingDir: string) => {
	return await cmdInvoke<string>("execute_local_command_with_working_dir", {
		command,
		args,
		workingDir,
	});
};

// TFS 工作区是否没有挂起更改
const hasNoPendingChanges = (output: string) => {
	return TFS_NO_PENDING_CHANGES.some((keyword) => output.includes(keyword));
};

// 统一转换为字符串
const toText = (value: any) => {
	if (value === null || value === undefined) return "";
	return String(value);
};

// 构造统一返回结果
const buildResult = (
	code: DataResultType<PullLatestData>["code"],
	msg: string,
	data: PullLatestData
): DataResultType<PullLatestData> => {
	return {
		code,
		msg,
		data,
	};
};

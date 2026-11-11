import { cmdInvoke } from "@/utils/command";

/**
 * MCP 动作暂存：界面不在发布页时，App.vue 先把请求存下并跳转，
 * 发布页挂载后取走执行，避免事件在组件挂载前丢失导致调用方等待超时。
 */
let pendingAction: any = null;

export function setPendingMcpAction(payload: any) {
	// 新请求覆盖未执行的旧请求时，先给旧请求回传失败，避免调用方一直等待
	if (pendingAction?.request_id) {
		cmdInvoke("mcp_action_result", {
			requestId: pendingAction.request_id,
			success: false,
			message: "前一个 MCP 请求尚未执行即被新请求取代",
			code: null,
		});
	}
	pendingAction = payload;
}

/**
 * 取走暂存的 MCP 动作；传入 match 时只取符合条件的动作，
 * 不匹配则保持暂存，避免备份页与发布页互相取走对方的请求。
 */
export function takePendingMcpAction(match?: (payload: any) => boolean) {
	const payload = pendingAction;
	if (!payload) return null;
	if (match && !match(payload)) return null;
	pendingAction = null;
	return payload;
}

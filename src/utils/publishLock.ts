// 发布锁：整机同一时间只允许一个发布流程（不区分项目与环境）
//
// 说明：TFS 工作区、编译输出目录、上传通道与部署目录都是整机共享资源，
// 跨项目/跨环境并发同样会互相踩踏，因此锁不按项目+环境切分。
// 锁记录写入 t_publish_lock，带过期时间，过期后可被接管。
import { usePublishRecordDb } from "@/database/publishRecord";

// 锁有效期（分钟）：超时视为持有者异常退出，可被后续发布接管
// 发布期间每 3 分钟心跳续约，因此缩短 TTL 不影响正常发布，只让崩溃后恢复更快。
// TTL 需大于 Rust 侧的僵死判定（12 分钟）：判定先触发、由前端正常释放锁，
// 不会出现「锁先过期导致两个发布并行」的窗口
const LOCK_TTL_MINUTES = 15;

// 获取发布锁的结果
export type PublishLockResult = {
    // 是否成功获取
    ok: boolean;
    // 本次持有的令牌（ok=true 时有效）
    token: string | null;
    // 当前持有者（ok=false 时有效）
    holder: RowPublishLockType | null;
    // 失败原因（可直接展示）
    message: string;
};

// 生成锁令牌
function createToken(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 获取发布锁（全局单锁）
 *
 * 锁不按项目/环境切分：projectId 与 environment 只作为「发起方」写入锁记录，
 * 便于排查是谁占着锁，不参与互斥判断。
 * @param projectId 发起发布的项目ID
 * @param environment 发起发布的环境
 * @returns 获取结果
 */
export async function acquirePublishLock(
    projectId: number,
    environment: number | null
): Promise<PublishLockResult> {
    const recordDb = usePublishRecordDb();
    // 先清理过期锁，避免历史异常退出导致永久占用
    await recordDb.cleanExpiredPublishLocks();

    const existsResult = await recordDb.getPublishLock();
    if (existsResult.code !== 0) {
        return {
            ok: false,
            token: null,
            holder: null,
            message: existsResult.msg,
        };
    }
    if (existsResult.data) {
        return {
            ok: false,
            token: null,
            holder: existsResult.data,
            message: "",
        };
    }

    const token = createToken();
    const now = new Date();
    const expireAt = new Date(now.getTime() + LOCK_TTL_MINUTES * 60 * 1000);
    const insertResult = await recordDb.insertPublishLock({
        id: null,
        projectId,
        environment,
        token,
        acquiredAt: now.toISOString(),
        expireAt: expireAt.toISOString(),
        remark: null,
    });
    if (insertResult.code !== 0) {
        return { ok: false, token: null, holder: null, message: insertResult.msg };
    }

    // 回读校验：极端并发下后写入者胜出，先写入者需让位
    const verifyResult = await recordDb.getPublishLock();
    if (verifyResult.code === 0 && verifyResult.data?.token === token) {
        return { ok: true, token, holder: null, message: "" };
    }
    await recordDb.releasePublishLock(token);
    return {
        ok: false,
        token: null,
        holder: verifyResult.data,
        message: "",
    };
}

/**
 * 释放发布锁（只释放自己持有的令牌，避免误删他人锁）
 * @param token 锁令牌
 */
export async function releasePublishLock(token: string | null): Promise<void> {
    if (!token) return;
    await usePublishRecordDb().releasePublishLock(token);
}

/**
 * 清理本机所有残留发布锁（应用启动时调用）
 *
 * 应用是单实例运行的，进程刚启动时不可能有本应用的发布在跑，
 * 此时表中的锁必然是异常退出（强制关机 / 结束进程）遗留的，直接清空。
 */
export async function clearAllPublishLocks(): Promise<void> {
    await usePublishRecordDb().clearPublishLocks();
}

/**
 * 发布过程中为锁续约（心跳）
 *
 * 长时间发布（例如大目录全量上传）可能超过锁有效期，
 * 期间定时刷新过期时间，避免被后续发布误判为「锁已过期」。
 * @param token 锁令牌
 */
export async function refreshPublishLock(token: string | null): Promise<void> {
    if (!token) return;
    const expireAt = new Date(Date.now() + LOCK_TTL_MINUTES * 60 * 1000).toISOString();
    await usePublishRecordDb().refreshPublishLock(token, expireAt);
}

/**
 * 获取锁有效期（分钟），供界面提示使用
 */
export const PUBLISH_LOCK_TTL_MINUTES = LOCK_TTL_MINUTES;

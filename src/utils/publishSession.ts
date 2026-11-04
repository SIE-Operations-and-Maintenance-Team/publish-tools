// 发布会话：发布台账 + 断点续跑检查点
//
// 设计要点：
// 1. 每次发布在 t_publish_record 中创建一条记录（result=0 表示进行中）；
// 2. 编译完成、备份完成、每个服务实例发布成功后，都把检查点写回 stage_json，
//    因此中途失败（或程序被关闭）后可以「继续发布」，跳过已完成的部分；
// 3. 服务实例键由「服务类型 + 服务器ID + 服务标识 + 端口」组成，保证同一服务
//    在多台服务器上的多个实例可以分别记录。
import { PUBLISH_RESULT, usePublishRecordDb } from "@/database/publishRecord";

// 会话状态（运行期）
export type PublishSession = {
    // 台账记录ID（写入数据库后回填）
    recordId: number | null;
    projectId: number;
    projectName: string;
    environment: number | null;
    // 开始时间（毫秒时间戳）
    startedAt: number;
    // 断点续跑检查点
    stage: PublishStageType;
    // 各服务实例发布结果
    serviceResults: PublishServiceResultType[];
    // 本次发布对应的发布前备份记录ID
    backupId: number | null;
    // 是否为「继续发布」
    isResume: boolean;
    // 发布开始时的应用配置快照（续跑时用于还原「哪些服务被移除」）
    appconfigSnapshotJson: string;
};

// 当前会话
let currentSession: PublishSession | null = null;

/**
 * 生成服务实例键
 * @param serviceType 服务类型（WebApiHost / WebClient ...）
 * @param serverId 服务器ID
 * @param identity 服务标识（Windows 服务名 / Docker 容器名）
 * @param port 服务器端口
 */
export function buildServiceKey(
    serviceType: string,
    serverId: number | null,
    identity: string,
    port: number | null
): string {
    return [serviceType, serverId ?? "", identity, port ?? ""].join("|");
}

// 空检查点
export function emptyStage(): PublishStageType {
    return {
        buildDone: false,
        backupDone: false,
        doneKeys: [],
        failedKeys: [],
        enabledServices: [],
        completedServices: [],
    };
}

/**
 * 归一化服务实例结果（同一实例只保留最新一次）
 *
 * 续跑时旧结果会随会话一起恢复，若不归一化，重试成功的实例会与上次的失败记录共存，
 * 导致发布实际成功后仍被判为失败。旧台账记录没有 key，无法对应到具体实例，
 * 直接丢弃，避免它们参与本次发布的成败判定。
 * @param results 服务结果集合
 */
function normalizeServiceResults(
    results: PublishServiceResultType[]
): PublishServiceResultType[] {
    const merged = new Map<string, PublishServiceResultType>();
    for (const item of results) {
        if (!item.key) continue;
        // 后写入的覆盖先写入的，保证同一实例只留最新一次
        merged.set(item.key, item);
    }
    return Array.from(merged.values());
}

// 获取当前会话
export function getPublishSession(): PublishSession | null {
    return currentSession;
}

/**
 * 开始一次新的发布会话（写入台账）
 * @param params 会话参数
 */
export async function beginPublishSession(params: {
    projectId: number;
    projectName: string;
    environment: number | null;
    appconfigSnapshotJson: string;
    // 本次发布包含的服务类型（发布前被「移除」的服务不在其中）
    enabledServices: string[];
    // 本次发布类型（一键发布/手动发布），续跑时据此决定是否需要补编译
    publishType?: string;
}): Promise<PublishSession> {
    currentSession = {
        recordId: null,
        projectId: params.projectId,
        projectName: params.projectName,
        environment: params.environment,
        startedAt: Date.now(),
        stage: {
            ...emptyStage(),
            enabledServices: params.enabledServices,
            publishType: params.publishType,
        },
        serviceResults: [],
        backupId: null,
        isResume: false,
        appconfigSnapshotJson: params.appconfigSnapshotJson,
    };

    const recordDb = usePublishRecordDb();
    const now = new Date();
    const insertResult = await recordDb.insertPublishRecord({
        id: null,
        projectId: params.projectId,
        projectName: params.projectName,
        environment: params.environment,
        startDate: now.toISOString(),
        endDate: null,
        durationMs: null,
        result: PUBLISH_RESULT.RUNNING,
        resumeCount: 0,
        stageJson: JSON.stringify(currentSession.stage),
        stage: currentSession.stage,
        changeLogJson: null,
        changeLog: { changeSets: [], users: [], items: [], text: "" },
        dllItemsJson: null,
        dllItems: [],
        serviceResultsJson: null,
        serviceResults: [],
        backupId: null,
        appconfigSnapshotJson: params.appconfigSnapshotJson,
        remark: null,
    });
    if (insertResult.code === 0) {
        currentSession.recordId = insertResult.data;
    }
    return currentSession;
}

/**
 * 从一条未结束的台账记录恢复会话（继续发布）
 * @param record 台账记录
 */
export function resumePublishSession(record: RowPublishRecordType): PublishSession {
    currentSession = {
        recordId: record.id,
        projectId: Number(record.projectId ?? 0),
        projectName: record.projectName ?? "",
        environment: record.environment,
        startedAt: record.startDate ? new Date(record.startDate).getTime() : Date.now(),
        stage: {
            buildDone: record.stage?.buildDone ?? false,
            backupDone: record.stage?.backupDone ?? false,
            doneKeys: record.stage?.doneKeys ?? [],
            failedKeys: [],
            // 兼容旧记录：老数据没有 enabledServices/completedServices 字段
            enabledServices: record.stage?.enabledServices ?? [],
            completedServices: record.stage?.completedServices ?? [],
            // 旧记录没有类型字段，按一键发布处理（保持原有的"补编译"行为）
            publishType: record.stage?.publishType,
        },
        // 按实例键归一化后只继承「已成功」的结果：
        // 上次失败的实例会在本次续跑中重新发布并重新记录，沿用旧失败会让 success=false
        // 一直拖累判定（若中途改过服务标识/端口，实例键已变，连覆盖都做不到）；
        // 旧台账记录没有 key、无法对应具体实例，也一并丢弃。
        serviceResults: normalizeServiceResults(record.serviceResults ?? []).filter(
            (result) => result.success
        ),
        backupId: record.backupId,
        isResume: true,
        appconfigSnapshotJson: record.appconfigSnapshotJson ?? "",
    };
    return currentSession;
}

/**
 * 清空当前会话
 */
export function clearPublishSession(): void {
    currentSession = null;
}

/**
 * 判断编译是否已完成（续跑时用于跳过编译）
 */
export function isBuildDone(): boolean {
    return currentSession?.stage.buildDone ?? false;
}

/**
 * 判断发布前备份是否已完成（续跑时用于跳过备份）
 */
export function isBackupDone(): boolean {
    return currentSession?.stage.backupDone ?? false;
}

/**
 * 判断服务实例是否已发布成功（续跑时用于跳过该实例）
 * @param key 服务实例键
 */
export function isServiceDone(key: string): boolean {
    return currentSession?.stage.doneKeys.includes(key) ?? false;
}

// 检查点落库（失败仅告警，不打断发布）
async function persistStage(): Promise<void> {
    if (!currentSession?.recordId) return;
    await usePublishRecordDb().updatePublishStage(currentSession.recordId, currentSession.stage);
}

/**
 * 标记编译完成
 */
export async function markBuildDone(): Promise<void> {
    if (!currentSession) return;
    currentSession.stage.buildDone = true;
    await persistStage();
}

/**
 * 标记发布前备份完成
 * @param backupId 备份记录ID
 */
export async function markBackupDone(backupId: number | null): Promise<void> {
    if (!currentSession) return;
    currentSession.stage.backupDone = true;
    currentSession.backupId = backupId;
    await persistStage();
}

/**
 * 标记某类服务已整体发布完成（续跑时不再重复发布，例如 WpfClient）
 * @param serviceType 服务类型
 */
export async function markServiceCompleted(serviceType: string): Promise<void> {
    if (!currentSession) return;
    const completed = currentSession.stage.completedServices ?? [];
    if (!completed.includes(serviceType)) {
        completed.push(serviceType);
        currentSession.stage.completedServices = completed;
        await persistStage();
    }
}

/**
 * 获取本次发布包含的服务类型（发布前被「移除」的服务不在其中）
 */
export function getEnabledServices(): string[] {
    return currentSession?.stage.enabledServices ?? [];
}

/**
 * 获取已整体发布完成的服务类型
 */
export function getCompletedServices(): string[] {
    return currentSession?.stage.completedServices ?? [];
}

/**
 * 记录单个服务实例的发布结果
 * @param key 服务实例键
 * @param serviceType 服务类型
 * @param success 是否成功
 * @param errors 错误信息
 */
export async function recordServiceResult(
    key: string,
    serviceType: string,
    success: boolean,
    errors: string[]
): Promise<void> {
    if (!currentSession) return;
    // 同一服务实例只保留最新一次结果：续跑重试成功后覆盖上次的失败记录，
    // 避免旧的 success=false 一直留在数组里把本次发布判成失败
    const result: PublishServiceResultType = { key, serviceType, success, errors };
    const resultIndex = currentSession.serviceResults.findIndex((item) => item.key === key);
    if (resultIndex >= 0) {
        currentSession.serviceResults[resultIndex] = result;
    } else {
        currentSession.serviceResults.push(result);
    }
    if (success) {
        if (!currentSession.stage.doneKeys.includes(key)) {
            currentSession.stage.doneKeys.push(key);
        }
        currentSession.stage.failedKeys = currentSession.stage.failedKeys.filter((k) => k !== key);
    } else {
        if (!currentSession.stage.failedKeys.includes(key)) {
            currentSession.stage.failedKeys.push(key);
        }
    }
    await persistStage();
}

/**
 * 获取本次发布中「最新一次仍失败」的服务实例结果
 *
 * 以按实例键去重后的结果为准：无 key 的旧台账记录不参与判定，
 * 防止历史失败把已经成功的续跑判成失败。
 */
export function getFailedServiceResults(): PublishServiceResultType[] {
    const latestResults = normalizeServiceResults(currentSession?.serviceResults ?? []);
    return latestResults.filter((result) => !result.success);
}

/**
 * 暂停发布会话（失败后保留「未完成」状态，供断点续跑）
 *
 * 与 `finishPublishSession` 的区别：这里不回写最终结果，
 * 记录在台账中保持 result=0（未完成），因此仍可「继续发布」。
 * @param changeLog 发布说明
 * @param dllItems 已发布的程序集清单
 */
export async function pausePublishSession(
    changeLog: PublishChangeLogType,
    dllItems: string[]
): Promise<void> {
    if (!currentSession) return;
    const recordId = currentSession.recordId;
    if (!recordId) {
        clearPublishSession();
        return;
    }
    await usePublishRecordDb().updatePublishProgress(recordId, {
        stage: currentSession.stage,
        serviceResults: currentSession.serviceResults,
        changeLog,
        dllItems,
        backupId: currentSession.backupId,
    });
    clearPublishSession();
}

/**
 * 结束发布会话并回写台账
 * @param result 最终结果
 * @param changeLog 发布说明
 * @param dllItems 发布的 DLL 清单
 * @param remark 备注
 */
export async function finishPublishSession(
    result: PublishResultType,
    changeLog: PublishChangeLogType,
    dllItems: string[],
    remark: string | null = null
): Promise<void> {
    if (!currentSession) return;
    const recordId = currentSession.recordId;
    if (!recordId) {
        clearPublishSession();
        return;
    }
    await usePublishRecordDb().finishPublishRecord(recordId, {
        endDate: new Date().toISOString(),
        durationMs: Date.now() - currentSession.startedAt,
        result,
        stage: currentSession.stage,
        serviceResults: currentSession.serviceResults,
        changeLog,
        dllItems,
        backupId: currentSession.backupId,
        remark,
    });
    clearPublishSession();
}

/**
 * 查询指定项目+环境可续跑的发布记录
 * @param projectId 项目ID
 * @param environment 环境
 */
export async function findResumableRecord(
    projectId: number,
    environment: number | null
): Promise<RowPublishRecordType | null> {
    const result = await usePublishRecordDb().getRunningPublishRecord(projectId, environment);
    if (result.code !== 0) return null;
    return result.data;
}

/**
 * 累加续跑次数
 * @param recordId 记录ID
 */
export async function increaseResumeCount(recordId: number | null): Promise<void> {
    if (!recordId) return;
    await usePublishRecordDb().increaseResumeCount(recordId);
}

/**
 * 清理历史遗留的「发布中」记录（应用异常退出、锁已过期时调用）
 * @param olderThanHours 超过该小时数仍未结束的记录判定为中止
 * @returns 被置为中止的记录数
 */
export async function abortStaleRecords(olderThanHours = 12): Promise<number> {
    const recordDb = usePublishRecordDb();
    const listResult = await recordDb.getPublishRecordList({
        skipCount: 0,
        maxResultCount: 100,
        projectName: null,
        environment: null,
        result: PUBLISH_RESULT.RUNNING,
        sorting: "start_date desc",
    });
    if (listResult.code !== 0) return 0;
    const deadline = Date.now() - olderThanHours * 60 * 60 * 1000;
    let count = 0;
    for (const record of listResult.data.data) {
        const startedAt = record.startDate ? new Date(record.startDate).getTime() : 0;
        if (startedAt > deadline) continue;
        await recordDb.finishPublishRecord(Number(record.id), {
            endDate: new Date().toISOString(),
            durationMs: 0,
            result: PUBLISH_RESULT.ABORTED,
            stage: record.stage,
            serviceResults: record.serviceResults,
            changeLog: record.changeLog,
            dllItems: record.dllItems,
            backupId: record.backupId,
            remark: record.remark,
        });
        count += 1;
    }
    return count;
}

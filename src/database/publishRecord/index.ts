import { db } from "@/database/sqlite";

// 发布结果常量（与 PublishResultType 对应）
export const PUBLISH_RESULT = {
    RUNNING: 0,
    SUCCESS: 1,
    FAILED: 2,
    ABORTED: 3,
} as const;

// 反序列化 JSON 字段的默认值
const emptyStage = (): PublishStageType => ({
    buildDone: false,
    backupDone: false,
    doneKeys: [],
    failedKeys: [],
    enabledServices: [],
    completedServices: [],
});

const emptyChangeLog = (): PublishChangeLogType => ({
    changeSets: [],
    users: [],
    items: [],
    text: "",
});

// 安全解析 JSON，失败时回退默认值
function parseJson<T>(json: string | null | undefined, fallback: T): T {
    if (!json) return fallback;
    try {
        return JSON.parse(json) as T;
    } catch {
        return fallback;
    }
}

// 台账列表查询的公共字段
const RECORD_COLUMNS =
    "id, project_id projectId, project_name projectName, environment, start_date startDate, end_date endDate, duration_ms durationMs, result, resume_count resumeCount, stage_json stageJson, change_log_json changeLogJson, dll_items_json dllItemsJson, service_results_json serviceResultsJson, backup_id backupId, appconfig_snapshot_json appconfigSnapshotJson, remark";

// 补齐 JSON 字段反序列化结果
function normalizeRecord(row: RowPublishRecordType): RowPublishRecordType {
    return {
        ...row,
        stage: parseJson<PublishStageType>(row.stageJson, emptyStage()),
        changeLog: parseJson<PublishChangeLogType>(row.changeLogJson, emptyChangeLog()),
        dllItems: parseJson<string[]>(row.dllItemsJson, []),
        serviceResults: parseJson<PublishServiceResultType[]>(row.serviceResultsJson, []),
    };
}

// 统一执行写操作
async function updateRecord(
    sql: string,
    bindValues: (string | number | null)[]
): Promise<DataResultType<boolean>> {
    let dataResult: DataResultType<boolean> = {
        code: 1,
        msg: "",
        data: false,
    };
    try {
        let rowResult = await (await db()).execute(sql, bindValues);
        if (rowResult.rowsAffected > 0) {
            dataResult.code = 0;
            dataResult.data = true;
            dataResult.msg = "操作成功！";
        } else {
            dataResult.msg = "操作失败（未影响任何数据）！";
        }
    } catch (error) {
        dataResult.code = -1;
        dataResult.msg = "操作出错：" + JSON.stringify(error);
        console.error(error);
    }
    return dataResult;
}

export function usePublishRecordDb() {
    return {
        /**
         * 查询发布台账(分页)列表
         * @param params 查询参数
         * @returns 分页查询结果
         */
        getPublishRecordList: async (
            params: GetPublishRecordTableParams
        ): Promise<DataResultType<TableResultType<RowPublishRecordType[]>>> => {
            const dataSql = `select ${RECORD_COLUMNS} from t_publish_record`;
            const totalSql = "select count(*) totalCount from t_publish_record";

            let where = " where 1=1 ";
            const orderBy = ` order by ${params.sorting || "start_date desc"} `;
            const bindValues: (string | number | null)[] = [];

            if (params.projectName) {
                where += ` and project_name like $${bindValues.length + 1} `;
                bindValues.push(`%${params.projectName}%`);
            }
            if (params.environment) {
                where += ` and environment = $${bindValues.length + 1} `;
                bindValues.push(params.environment);
            }
            if (params.result !== null && params.result !== undefined) {
                where += ` and result = $${bindValues.length + 1} `;
                bindValues.push(params.result);
            }

            const limitIndex = bindValues.length + 1;
            const offsetIndex = bindValues.length + 2;
            const querySql = `${dataSql}${where}${orderBy} LIMIT $${limitIndex} OFFSET $${offsetIndex};`;
            const countSql = `${totalSql}${where};`;

            let dataResult: DataResultType<TableResultType<RowPublishRecordType[]>> = {
                code: 0,
                msg: "",
                data: {
                    data: [],
                    total: 0,
                },
            };

            try {
                const totalData = await (await db()).select<{ totalCount: number }[]>(
                    countSql,
                    bindValues
                );
                if (!totalData || totalData.length < 1 || totalData[0].totalCount < 1)
                    return dataResult;
                dataResult.data.total = totalData[0].totalCount;

                const rows = await (await db()).select<RowPublishRecordType[]>(querySql, [
                    ...bindValues,
                    params.maxResultCount,
                    params.skipCount,
                ]);
                dataResult.data.data = rows.map((row) => normalizeRecord(row));
                dataResult.msg = "查询发布台账列表成功";
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "查询发布台账列表出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 按ID查询发布记录
         * @param id 记录ID
         */
        getPublishRecordById: async (
            id: number
        ): Promise<DataResultType<RowPublishRecordType | null>> => {
            const sql = `select ${RECORD_COLUMNS} from t_publish_record where id = $1;`;
            let dataResult: DataResultType<RowPublishRecordType | null> = {
                code: 1,
                msg: "",
                data: null,
            };
            try {
                const rows = await (await db()).select<RowPublishRecordType[]>(sql, [id]);
                if (rows.length < 1) {
                    dataResult.msg = "发布记录不存在";
                    return dataResult;
                }
                dataResult.code = 0;
                dataResult.data = normalizeRecord(rows[0]);
                dataResult.msg = "查询发布记录成功";
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "查询发布记录出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 查询指定项目+环境下未结束（可续跑）的发布记录
         * @param projectId 项目ID
         * @param environment 环境
         */
        getRunningPublishRecord: async (
            projectId: number,
            environment: number | null
        ): Promise<DataResultType<RowPublishRecordType | null>> => {
            const sql = `select ${RECORD_COLUMNS} from t_publish_record where project_id = $1 and (environment = $2 or (environment is null and $2 is null)) and result = 0 order by id desc limit 1;`;
            let dataResult: DataResultType<RowPublishRecordType | null> = {
                code: 0,
                msg: "",
                data: null,
            };
            try {
                const rows = await (await db()).select<RowPublishRecordType[]>(sql, [
                    projectId,
                    environment,
                ]);
                if (rows.length > 0) dataResult.data = normalizeRecord(rows[0]);
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "查询未结束发布记录出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 新增发布记录（发布开始时调用）
         * @param record 发布记录
         */
        insertPublishRecord: async (
            record: RowPublishRecordType
        ): Promise<DataResultType<number>> => {
            const sql =
                "INSERT INTO t_publish_record (project_id, project_name, environment, start_date, result, resume_count, stage_json, appconfig_snapshot_json, remark) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id;";
            let dataResult: DataResultType<number> = { code: 1, msg: "", data: 0 };
            try {
                const rowResult = await (await db()).execute(sql, [
                    record.projectId,
                    record.projectName,
                    record.environment,
                    record.startDate,
                    PUBLISH_RESULT.RUNNING,
                    record.resumeCount ?? 0,
                    JSON.stringify(record.stage ?? emptyStage()),
                    record.appconfigSnapshotJson,
                    record.remark,
                ]);
                if (rowResult.lastInsertId && rowResult.lastInsertId > 0) {
                    dataResult.code = 0;
                    dataResult.data = rowResult.lastInsertId;
                    dataResult.msg = "新增发布记录成功！";
                } else {
                    dataResult.msg = "新增发布记录失败！";
                }
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "新增发布记录出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 更新断点续跑检查点
         * @param id 记录ID
         * @param stage 检查点
         */
        updatePublishStage: async (
            id: number,
            stage: PublishStageType
        ): Promise<DataResultType<boolean>> => {
            return await updateRecord("UPDATE t_publish_record SET stage_json = $1 WHERE id = $2;", [
                JSON.stringify(stage),
                id,
            ]);
        },

        /**
         * 更新发布进度（保持「发布中」状态，用于断点续跑）
         * @param id 记录ID
         * @param data 进度信息
         */
        updatePublishProgress: async (
            id: number,
            data: {
                stage: PublishStageType;
                serviceResults: PublishServiceResultType[];
                changeLog: PublishChangeLogType;
                dllItems: string[];
                backupId: number | null;
            }
        ): Promise<DataResultType<boolean>> => {
            return await updateRecord(
                "UPDATE t_publish_record SET stage_json = $1, service_results_json = $2, change_log_json = $3, dll_items_json = $4, backup_id = $5 WHERE id = $6;",
                [
                    JSON.stringify(data.stage),
                    JSON.stringify(data.serviceResults),
                    JSON.stringify(data.changeLog),
                    JSON.stringify(data.dllItems),
                    data.backupId,
                    id,
                ]
            );
        },

        /**
         * 结束发布记录
         * @param id 记录ID
         * @param data 结束信息
         */
        finishPublishRecord: async (
            id: number,
            data: {
                endDate: string;
                durationMs: number;
                result: PublishResultType;
                stage: PublishStageType;
                serviceResults: PublishServiceResultType[];
                changeLog: PublishChangeLogType;
                dllItems: string[];
                backupId: number | null;
                remark?: string | null;
            }
        ): Promise<DataResultType<boolean>> => {
            return await updateRecord(
                "UPDATE t_publish_record SET end_date = $1, duration_ms = $2, result = $3, stage_json = $4, service_results_json = $5, change_log_json = $6, dll_items_json = $7, backup_id = $8, remark = coalesce($9, remark) WHERE id = $10;",
                [
                    data.endDate,
                    data.durationMs,
                    data.result,
                    JSON.stringify(data.stage),
                    JSON.stringify(data.serviceResults),
                    JSON.stringify(data.changeLog),
                    JSON.stringify(data.dllItems),
                    data.backupId,
                    data.remark ?? null,
                    id,
                ]
            );
        },

        /**
         * 累加续跑次数
         * @param id 记录ID
         */
        increaseResumeCount: async (id: number): Promise<DataResultType<boolean>> => {
            return await updateRecord(
                "UPDATE t_publish_record SET resume_count = coalesce(resume_count, 0) + 1 WHERE id = $1;",
                [id]
            );
        },

        /**
         * 删除发布记录
         * @param id 记录ID
         */
        deletePublishRecord: async (id: number): Promise<DataResultType<boolean>> => {
            return await updateRecord("DELETE FROM t_publish_record WHERE id = $1;", [id]);
        },

        /**
         * 批量删除发布记录
         * @param ids 记录ID集合
         */
        deletePublishRecords: async (ids: number[]): Promise<DataResultType<boolean>> => {
            if (!ids || ids.length < 1) {
                return { code: 1, msg: "未选择要删除的发布记录", data: false };
            }
            const placeholders = ids.map((_, index) => `$${index + 1}`).join(", ");
            return await updateRecord(
                `DELETE FROM t_publish_record WHERE id IN (${placeholders});`,
                ids
            );
        },

        /**
         * 查询当前有效的发布锁
         *
         * 锁是全局的：TFS 工作区、编译输出目录、上传通道与部署目录都是整机共享，
         * 任意项目、任意环境同时只允许一个发布流程，因此不按项目/环境过滤。
         */
        getPublishLock: async (): Promise<DataResultType<RowPublishLockType | null>> => {
            const sql =
                "select id, project_id projectId, environment, token, acquired_at acquiredAt, expire_at expireAt, remark from t_publish_lock where expire_at > $1 order by id desc limit 1;";
            let dataResult: DataResultType<RowPublishLockType | null> = {
                code: 0,
                msg: "",
                data: null,
            };
            try {
                const now = new Date().toISOString();
                const rows = await (await db()).select<RowPublishLockType[]>(sql, [now]);
                dataResult.data = rows.length > 0 ? rows[0] : null;
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "查询发布锁出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 新增发布锁
         * @param lock 发布锁
         */
        insertPublishLock: async (lock: RowPublishLockType): Promise<DataResultType<number>> => {
            const sql =
                "INSERT INTO t_publish_lock (project_id, environment, token, acquired_at, expire_at, remark) VALUES($1, $2, $3, $4, $5, $6) RETURNING id;";
            let dataResult: DataResultType<number> = { code: 1, msg: "", data: 0 };
            try {
                const rowResult = await (await db()).execute(sql, [
                    lock.projectId,
                    lock.environment,
                    lock.token,
                    lock.acquiredAt,
                    lock.expireAt,
                    lock.remark,
                ]);
                if (rowResult.lastInsertId && rowResult.lastInsertId > 0) {
                    dataResult.code = 0;
                    dataResult.data = rowResult.lastInsertId;
                    dataResult.msg = "获取发布锁成功！";
                }
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "获取发布锁出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 释放发布锁（仅删除自己持有的 token）
         * @param token 锁令牌
         */
        releasePublishLock: async (token: string): Promise<DataResultType<boolean>> => {
            return await updateRecord("DELETE FROM t_publish_lock WHERE token = $1;", [token]);
        },

        /**
         * 清理已过期的发布锁
         */
        cleanExpiredPublishLocks: async (): Promise<DataResultType<boolean>> => {
            return await updateRecord("DELETE FROM t_publish_lock WHERE expire_at <= $1;", [
                new Date().toISOString(),
            ]);
        },

        /**
         * 清空所有发布锁
         *
         * 应用以单实例方式运行，因此进程启动时残留的锁必然来自已退出的进程
         * （强制关机、任务管理器结束进程等），启动时一律清理，
         * 避免「继续发布」被上一次异常退出留下的锁误拦。
         */
        clearPublishLocks: async (): Promise<DataResultType<boolean>> => {
            return await updateRecord("DELETE FROM t_publish_lock;", []);
        },

        /**
         * 续约发布锁（刷新过期时间，避免长时间发布过程中锁被判定为过期）
         * @param token 锁令牌
         * @param expireAt 新的过期时间（ISO 字符串）
         */
        refreshPublishLock: async (
            token: string,
            expireAt: string
        ): Promise<DataResultType<boolean>> => {
            return await updateRecord("UPDATE t_publish_lock SET expire_at = $1 WHERE token = $2;", [
                expireAt,
                token,
            ]);
        },
    };
}

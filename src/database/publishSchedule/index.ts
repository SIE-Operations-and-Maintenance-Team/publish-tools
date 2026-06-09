import { db } from '@/database/sqlite';
import { formatDate } from "@/utils/formatTime";

export function usePublishScheduleDb() {
    return {
        /**
         * 查询定时发布(分页)列表信息
         * @param params 查询参数
         */
        getScheduleList: async (params: GetPublishScheduleTableParams) => {
            let dataSql = "select id, project_id projectId, project_name projectName, environment, appconfig_id appconfigId, publish_type publishType, scheduled_time scheduledTime, status, create_time createTime, execute_time executeTime, result_log resultLog from t_publish_schedule";
            let totalSql = "select count(*) totalCount from t_publish_schedule";
            let where = " where 1=1 ";
            let orderBy = " order by scheduled_time desc ";
            if (params) {
                if (params.status) where += " and status = $1 ";
                if (params.sorting) orderBy = ` order by ${params.sorting} `;
            }
            dataSql += where + orderBy;
            dataSql += " LIMIT $2 OFFSET $3;";
            totalSql += `${where};`;

            let dataResult: DataResultType<TableResultType<RowPublishScheduleType[]>> = {
                code: 0,
                msg: "",
                data: {
                    data: [],
                    total: 0,
                },
            };
            let bindValues: any[] = [params.status, params.maxResultCount, params.skipCount];

            try {
                let totalData = await (await db()).select<any>(totalSql, bindValues);
                if (!totalData || totalData.length < 1 || totalData[0].totalCount < 1) return dataResult;
                dataResult.data.total = totalData[0].totalCount;
                dataResult.data.data = await (await db()).select<RowPublishScheduleType[]>(dataSql, bindValues);
                dataResult.msg = "查询定时发布列表成功";
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "查询定时发布列表出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 查询待执行的定时任务（按时间升序）
         */
        getPendingSchedules: async () => {
            let dataSql = "select id, project_id projectId, project_name projectName, environment, appconfig_id appconfigId, publish_type publishType, scheduled_time scheduledTime, status, create_time createTime, execute_time executeTime, result_log resultLog from t_publish_schedule where status = 'pending' order by scheduled_time asc";

            let dataResult: DataResultType<RowPublishScheduleType[]> = {
                code: 0,
                msg: "",
                data: [],
            };
            try {
                dataResult.data = await (await db()).select<RowPublishScheduleType[]>(dataSql);
                dataResult.msg = "查询待执行定时任务成功";
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "查询待执行定时任务出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 根据ID查询定时发布任务
         * @param id 任务ID
         */
        getScheduleById: async (id: number) => {
            let dataSql = "select id, project_id projectId, project_name projectName, environment, appconfig_id appconfigId, publish_type publishType, scheduled_time scheduledTime, status, create_time createTime, execute_time executeTime, result_log resultLog from t_publish_schedule where id = $1";

            let dataResult: DataResultType<TableResultType<RowPublishScheduleType>> = {
                code: 0,
                msg: "",
                data: {
                    data: {} as RowPublishScheduleType,
                    total: 0,
                },
            };
            try {
                let scheduleData = await (await db()).select<RowPublishScheduleType[]>(dataSql, [id]);
                if (scheduleData && scheduleData.length > 0) {
                    dataResult.data.data = scheduleData[0];
                }
                dataResult.msg = "查询定时发布任务成功";
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "查询定时发布任务出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 新增定时发布任务
         * @param data 定时发布数据
         */
        insertSchedule: async (data: RowPublishScheduleType) => {
            let insertSql = "INSERT INTO t_publish_schedule (project_id, project_name, environment, appconfig_id, publish_type, scheduled_time, status, create_time) VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id;";

            let dataResult: DataResultType<number> = {
                code: 1,
                msg: "",
                data: 0,
            };
            try {
                let rowResult = await (await db()).execute(insertSql, [
                    data.projectId,
                    data.projectName,
                    data.environment,
                    data.appconfigId,
                    data.publishType,
                    data.scheduledTime,
                    'pending',
                    formatDate(new Date(), "YYYY-mm-dd HH:MM:SS"),
                ]);
                if (rowResult.lastInsertId && rowResult.lastInsertId > 0) {
                    dataResult.code = 0;
                    dataResult.data = rowResult.lastInsertId;
                    dataResult.msg = "新增定时发布任务成功！";
                } else {
                    dataResult.code = 1;
                    dataResult.msg = "新增定时发布任务失败！";
                }
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "新增定时发布任务出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 更新定时发布任务状态
         * @param id 任务ID
         * @param status 状态
         * @param resultLog 结果日志
         */
        updateScheduleStatus: async (id: number, status: PublishScheduleStatus, resultLog?: string) => {
            let updateSql = "UPDATE t_publish_schedule SET status = $1, execute_time = $2";
            let bindValues: any[] = [status, formatDate(new Date(), "YYYY-mm-dd HH:MM:SS")];

            if (resultLog !== undefined) {
                updateSql += ", result_log = $3";
                bindValues.push(resultLog);
            }
            updateSql += " WHERE id = $4";
            bindValues.push(id);

            let dataResult: DataResultType<number> = {
                code: 1,
                msg: "",
                data: 0,
            };
            try {
                let rowResult = await (await db()).execute(updateSql, bindValues);
                if (rowResult.rowsAffected > 0) {
                    dataResult.code = 0;
                    dataResult.data = id;
                    dataResult.msg = "更新定时发布任务状态成功！";
                } else {
                    dataResult.code = 1;
                    dataResult.msg = "更新定时发布任务状态失败！";
                }
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "更新定时发布任务状态出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 更新定时发布任务的执行时间
         * @param id 任务ID
         * @param newTime 新的计划时间
         */
        updateScheduleTime: async (id: number, newTime: string) => {
            let updateSql = "UPDATE t_publish_schedule SET scheduled_time = $1 WHERE id = $2";

            let dataResult: DataResultType<number> = {
                code: 1,
                msg: "",
                data: 0,
            };
            try {
                let rowResult = await (await db()).execute(updateSql, [newTime, id]);
                if (rowResult.rowsAffected > 0) {
                    dataResult.code = 0;
                    dataResult.data = id;
                    dataResult.msg = "更新定时发布任务时间成功！";
                } else {
                    dataResult.code = 1;
                    dataResult.msg = "更新定时发布任务时间失败！";
                }
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "更新定时发布任务时间出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 删除定时发布任务
         * @param id 任务ID
         */
        deleteSchedule: async (id: number) => {
            let deleteSql = "DELETE FROM t_publish_schedule WHERE id = $1";

            let dataResult: DataResultType<number> = {
                code: 1,
                msg: "",
                data: 0,
            };
            try {
                let rowResult = await (await db()).execute(deleteSql, [id]);
                if (rowResult.rowsAffected > 0) {
                    dataResult.code = 0;
                    dataResult.data = id;
                    dataResult.msg = "删除定时发布任务成功！";
                } else {
                    dataResult.code = 1;
                    dataResult.msg = "删除定时发布任务失败！";
                }
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "删除定时发布任务出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },
    };
}

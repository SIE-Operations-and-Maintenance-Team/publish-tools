import { db } from "@/database/sqlite";

export function useBackupDb() {
    return {
        /**
         * 查询备份(分页)列表信息
         * @param { object } params
         * @returns 分页查询结果
         */
        getBackupList: async (params: GetBackupTableParams) => {
            let dataSql =
                "select id, project_id projectId, project_name projectName, environment, backup_date backupDate, remark, backup_items_json backupItemsJson from t_backup";
            let totalSql = "select count(*) totalCount from t_backup";
            let where = " where 1=1 ";
            let orderBy = "";
            if (params) {
                if (params.projectName) where += " and project_name like $1 ";
                if (params.environment) where += " and environment = $2 ";
                if (params.sorting) orderBy += ` order by ${ params.sorting } `;
            }
            dataSql += where + orderBy;
            dataSql += " LIMIT $3 OFFSET $4;";
            totalSql += `${where};`;

            // 定义(默认)响应结果
            let dataResult: DataResultType<TableResultType<RowBackupType[]>> = {
                code: 0,
                msg: "",
                data: {
                    data: [],
                    total: 0,
                },
            };
            // 绑定SQL参数值
            let bindValues = [
                `%${params.projectName}%`,
                params.environment,
                params.maxResultCount,
                params.skipCount,
            ];

            try {
                // 查询数量
                let totalData = await (await db()).select<any>(totalSql, bindValues);
                if (!totalData || totalData.length < 1 || totalData[0].totalCount < 1)
                    return dataResult;
                dataResult.data.total = totalData[0].totalCount;
                // 查询数据
                var dataList = await (
                    await db()
                ).select<RowBackupType[]>(dataSql, bindValues);

                for (let i = 0; i < dataList.length; i++) {
                    const dItem = dataList[i];
                    if(!dItem.backupItemsJson) continue;
                    dItem.backupItems = JSON.parse(dItem.backupItemsJson);
                }

                dataResult.data.data = dataList;

                dataResult.msg = "查询备份(分页)列表信息成功";
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "查询备份(分页)列表信息出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 插入备份
         * @param backup 备份
         * @returns 插入结果
         */
        insertBackup: async (backup: RowBackupType) => {
            let insertSql =
                "INSERT INTO t_backup (project_id, project_name, environment, backup_date, remark, backup_items_json) VALUES($1, $2, $3, $4, $5, $6) RETURNING id;";

            // 定义(默认)响应结果
            let dataResult: DataResultType<number> = {
                code: 1,
                msg: "",
                data: 0,
            };
            try {
                let rowResult = await (
                    await db()
                ).execute(insertSql, [
                    backup.projectId,
                    backup.projectName,
                    backup.environment,
                    backup.backupDate,
                    backup.remark,
                    backup.backupItemsJson
                ]);
                if (rowResult.lastInsertId && rowResult.lastInsertId > 0) {
                    dataResult.code = 0;
                    dataResult.data = rowResult.lastInsertId;
                    dataResult.msg = "备份成功！";
                } else {
                    dataResult.code = 1;
                    dataResult.msg = "备份失败！";
                }

            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "备份信息出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 删除备份
         * @param id 项目ID
         * @returns 删除结果 
         */
        deleteBackup: async (id: number) => {
            let deleteSql = "DELETE FROM t_backup WHERE id=$1;";
            // 定义(默认)响应结果
            let dataResult: DataResultType<boolean> = {
                code: 1,
                msg: "",
                data: false,
            };
            try {
                let rowResult = await (await db()).execute(deleteSql, [id]);
                if (rowResult.rowsAffected > 0) {
                    dataResult.code = 0;
                    dataResult.data = true;
                    dataResult.msg = "删除备份成功！";
                } else {
                    dataResult.code = 1;
                    dataResult.data = false;
                    dataResult.msg = "删除备份失败！";
                }
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "删除备份出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },
    };
}

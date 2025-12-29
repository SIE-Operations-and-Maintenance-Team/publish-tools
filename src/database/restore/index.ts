import { db } from "@/database/sqlite";

export function useRestoreDb() {
    return {
        /**
         * 查询还原(分页)列表信息
         * @param { object } params
         * @returns 分页查询结果
         */
        getRestoreList: async (params: GetRestoreTableParams) => {
            let dataSql =
                "select id, backup_id backupId, restore_date restoreDate, result, log_content logContent from t_restore";
            let totalSql = "select count(*) totalCount from t_restore";
            let where = " where 1=1 ";
            let orderBy = "";
            if (params) {
                if (params.backupId) where += " and backup_id = $1 ";
                if (params.sorting) orderBy += ` order by ${ params.sorting } `;
            }
            dataSql += where + orderBy;
            dataSql += " LIMIT $2 OFFSET $3;";
            totalSql += `${where};`;

            // 定义(默认)响应结果
            let dataResult: DataResultType<TableResultType<RowRestoreType[]>> = {
                code: 0,
                msg: "",
                data: {
                    data: [],
                    total: 0,
                },
            };
            // 绑定SQL参数值
            let bindValues = [
                params.backupId,
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
                ).select<RowRestoreType[]>(dataSql, bindValues);
                dataResult.data.data = dataList;
                dataResult.msg = "查询还原(分页)列表信息成功";
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "查询还原(分页)列表信息出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 插入还原
         * @param restore 还原
         * @returns 插入结果
         */
        insertRestore: async (restore: RowRestoreType) => {
            let insertSql =
                "INSERT INTO t_restore (backup_id, restore_date, result, log_content) VALUES($1, $2, $3, $4) RETURNING id;";

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
                    restore.backupId,
                    restore.restoreDate,
                    restore.result,
                    restore.logContent,
                ]);
                if (rowResult.lastInsertId && rowResult.lastInsertId > 0) {
                    dataResult.code = 0;
                    dataResult.data = rowResult.lastInsertId;
                    dataResult.msg = "还原成功！";
                } else {
                    dataResult.code = 1;
                    dataResult.msg = "还原失败！";
                }

            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "还原信息出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        }
    };
}

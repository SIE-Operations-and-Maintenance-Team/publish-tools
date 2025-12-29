import { db } from "@/database/sqlite";

export function useTfsDb() {
    return {
        /**
         * 查询TFS(分页)列表信息
         * @param { object } params
         * @returns 分页查询结果
         */
        getTfsList: async (params: GetTfsTableParams) => {
            let dataSql =
                "select id, tfs_name tfsName, tfs_server_url tfsServerUrl, tfs_source_path tfsSourcePath, tfvc_path tfvcPath, remark from t_team_foundation_server";
            let totalSql = "select count(*) totalCount from t_team_foundation_server";
            let where = " where 1=1 ";
            let orderBy = "";
            if (params) {
                if (params.tfsName) where += " and tfs_name like $1 ";
                if (params.tfsSourcePath) where += " and tfs_source_path like $2 ";
                if (params.sorting) orderBy += ` order by ${ params.sorting } `;
            }
            dataSql += where + orderBy;
            dataSql += " LIMIT $3 OFFSET $4;";
            totalSql += `${where};`;

            // 定义(默认)响应结果
            let dataResult: DataResultType<TableResultType<RowTfsType[]>> = {
                code: 0,
                msg: "",
                data: {
                    data: [],
                    total: 0,
                },
            };
            // 绑定SQL参数值
            let bindValues = [
                `%${params.tfsName}%`,
                `%${params.tfsSourcePath}%`,
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
                dataResult.data.data = await (
                    await db()
                ).select<RowTfsType[]>(dataSql, bindValues);
                dataResult.msg = "查询TFS(分页)列表信息成功";
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "查询TFS(分页)列表信息出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 获取TFS
         * @returns Tfs信息
         */
        getTfsById: async (id: number) => {
            let dataSql =
                "select id, tfs_name tfsName, tfs_server_url tfsServerUrl, tfs_source_path tfsSourcePath, tfvc_path tfvcPath, remark from t_team_foundation_server where id = $1;";

            // 定义(默认)响应结果
            let dataResult: DataResultType<TableResultType<RowTfsType>> = {
                code: 0,
                msg: "",
                data: {
                    data: {} as RowTfsType,
                    total: 0
                },
            };
            try {
                // 查询数据
                let tfsList: RowTfsType[] = await (
                    await db()
                ).select<RowTfsType[]>(dataSql, [id]);
                if (tfsList && tfsList.length > 0) {
                    dataResult.data.data = tfsList[0];
                }
                dataResult.msg = "获取TFS成功";
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "获取TFS出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 插入TFS
         * @param tfs TFS
         * @returns 插入结果
         */
        insertTfs: async (tfs: RowTfsType) => {
            let insertSql =
                "INSERT INTO t_team_foundation_server (tfs_name, tfs_server_url, tfs_source_path, tfvc_path, remark) VALUES($1, $2, $3, $4, $5) RETURNING id;";

            // 定义(默认)响应结果
            let dataResult: DataResultType<number> = {
                code: 1,
                msg: "",
                data: 0,
            };
            try {

                // 验证TFS名称是否存在
                let existData = await (
                    await db()
                ).select<any>(
                    "select COUNT(*) as totalCount from t_team_foundation_server where tfs_name=$1",
                    [tfs.tfsName]
                );
                if (existData && existData.length > 0 && existData[0].totalCount > 0) {
                    dataResult.code = 1;
                    dataResult.msg = `TFS名称[${tfs.tfsName}]已存在！`;
                    return dataResult;
                }

                let rowResult = await (
                    await db()
                ).execute(insertSql, [
                    tfs.tfsName,
                    tfs.tfsServerUrl,
                    tfs.tfsSourcePath,
                    tfs.tfvcPath,
                    tfs.remark
                ]);
                if (rowResult.lastInsertId && rowResult.lastInsertId > 0) {
                    dataResult.code = 0;
                    dataResult.data = rowResult.lastInsertId;
                    dataResult.msg = "新增TFS成功！";
                } else {
                    dataResult.code = 1;
                    dataResult.msg = "新增TFS失败！";
                }

            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "插入TFS出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 修改TFS
         * @param tfs TFS
         * @returns 修改结果
         */
        updateTfs: async (tfs: RowTfsType) => {
            let updateSql =
                "UPDATE t_team_foundation_server SET tfs_name=$1, tfs_server_url=$2, tfs_source_path=$3, tfvc_path=$4, remark=$5 WHERE id=$6;";

            // 定义(默认)响应结果
            let dataResult: DataResultType<boolean> = {
                code: 1,
                msg: "",
                data: false,
            };
            try {
                // 验证TFS名称是否存在
                let existData = await (
                    await db()
                ).select<any>(
                    "select COUNT(*) as totalCount from t_team_foundation_server where tfs_name=$1 and id != $2",
                    [tfs.tfsName, tfs.id]
                );
                if (existData && existData.length > 0 && existData[0].totalCount > 0) {
                    dataResult.code = 1;
                    dataResult.msg = `TFS名称[${tfs.tfsName}]已存在！`;
                    return dataResult;
                }

                let rowResult = await (
                    await db()
                ).execute(updateSql, [
                    tfs.tfsName,
                    tfs.tfsServerUrl,
                    tfs.tfsSourcePath,
                    tfs.tfvcPath,
                    tfs.remark,
                    tfs.id
                ]);
                if (rowResult.rowsAffected > 0) {
                    dataResult.code = 0;
                    dataResult.data = true;
                    dataResult.msg = "修改TFS成功！";
                } else {
                    dataResult.code = 1;
                    dataResult.data = false;
                    dataResult.msg = "修改TFS失败！";
                }
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "修改TFS出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 删除TFS
         * @param id 项目ID
         * @returns 删除结果 
         */
        deleteTfs: async (id: number) => {
            let deleteSql = "DELETE FROM t_team_foundation_server WHERE id=$1;";
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
                    dataResult.msg = "删除TFS成功！";
                } else {
                    dataResult.code = 1;
                    dataResult.data = false;
                    dataResult.msg = "删除TFS失败！";
                }
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "删除TFS出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },
    };
}

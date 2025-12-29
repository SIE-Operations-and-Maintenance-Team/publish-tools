import { db } from '@/database/sqlite';

export function useServerDb() {
    return {
        /**
         * 查询服务器(分页)列表信息
         * @param { object } params
         * @returns { any }
         */
        getServerList: async (params: GetServerTableParams) => {
            let dataSql = "select ts.id, ts.project_id projectId, tp.name projectName, ts.name, ts.os, ts.ip, ts.port, ts.account, ts.pwd, ts.description from t_server ts left join t_project tp on ts.project_id = tp.id";
            let totalSql = "select count(*) totalCount from t_server ts";
            let where = " where 1=1 ";
            let orderBy = "";
            if (params) {
                if (params.projectId) where += " and ts.project_id = $1 ";
                if (params.name) where += " and ts.name = $2 ";
                if (params.sorting) orderBy += ` order by ${params.sorting} `;
            }
            dataSql += where + orderBy;
            dataSql += " LIMIT $3 OFFSET $4;";
            totalSql += `${where};`;

            // 定义(默认)响应结果
            let dataResult: DataResultType<TableResultType<RowServerType[]>> = {
                code: 0,
                msg: "",
                data: {
                    data: [],
                    total: 0,
                },
            };
            let bindValues = [params.projectId, params.name, params.maxResultCount, params.skipCount];

            try {
                // 查询数量
                let totalData = await (await db()).select<any>(totalSql, bindValues);
                if (!totalData || totalData.length < 1 || totalData[0].totalCount < 1) return dataResult;
                dataResult.data.total = totalData[0].totalCount;
                // 查询数据
                dataResult.data.data = await (await db()).select<RowServerType[]>(dataSql, bindValues);
                dataResult.msg = "查询服务器(分页)列表信息成功";
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "查询项目管理(分页)列表信息出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 根据ID查询服务器信息
         * @param { number } id
         * @returns { any }
         */
        getServerById: async (id: number) => {
            let dataSql = "select ts.id, ts.project_id projectId, tp.name projectName, ts.name, ts.os, ts.ip, ts.port, ts.account, ts.pwd, ts.description from t_server ts left join t_project tp on ts.project_id = tp.id where ts.id = $1";

            // 定义(默认)响应结果
            let dataResult: DataResultType<TableResultType<RowServerType>> = {
                code: 0,
                msg: "",
                data: {
                    data: {} as RowServerType,
                    total: 0,
                },
            };
            try {
                // 查询数据
                let serverData = await (await db()).select<RowServerType[]>(dataSql, [id]);
                if (serverData && serverData.length > 0) {
                    dataResult.data.data = serverData[0];
                }
                dataResult.msg = "查询服务器信息成功";
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "查询服务器信息出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 插入服务器信息
         * @param server 服务器
         */
        insertServer: async (server: RowServerType) => {
            let insertSql = "INSERT INTO t_server (project_id, name, os, ip, port, account, pwd, description) VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id;";

            // 定义(默认)响应结果
            let dataResult: DataResultType<number> = {
                code: 1,
                msg: "",
                data: 0,
            };
            try {
                // 验证服务器名称是否存在
                let existData = await (
                    await db()
                ).select<any>(
                    "select COUNT(*) as totalCount from t_server where name=$1;",
                    [server.name]
                );
                if (existData && existData.length > 0 && existData[0].totalCount > 0) {
                    dataResult.code = 1;
                    dataResult.msg = `该服务器名称[${server.name}]已存在！`;
                    return dataResult;
                }

                let rowResult = await (await db()).execute(insertSql, [server.projectId, server.name, server.os, server.ip, server.port, server.account, server.pwd, server.description]);
                if (rowResult.lastInsertId && rowResult.lastInsertId > 0) {
                    dataResult.code = 0;
                    dataResult.data = rowResult.lastInsertId;
                    dataResult.msg = "新增服务器成功！";
                } else {
                    dataResult.code = 1;
                    dataResult.msg = "新增服务器失败！";
                }
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "插入服务器信息出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 修改服务器信息
         * @param server 服务器
         */
        updateServer: async (server: RowServerType) => {
            let updateSql = "UPDATE t_server SET project_id=$1, name=$2, os=$3, ip=$4, port=$5, account=$6, pwd=$7, description=$8 WHERE id=$9;";

            // 定义(默认)响应结果
            let dataResult: DataResultType<boolean> = {
                code: 1,
                msg: "",
                data: false,
            };
            try {
                // 验证服务器名称是否存在
                let existData = await (
                    await db()
                ).select<any>(
                    "select COUNT(*) as totalCount from t_server where name=$1 and id != $2",
                    [server.name, server.id]
                );
                if (existData && existData.length > 0 && existData[0].totalCount > 0) {
                    dataResult.code = 1;
                    dataResult.msg = `该服务器名称[${server.name}]已存在！`;
                    return dataResult;
                }

                let rowResult = await (await db()).execute(updateSql, [server.projectId, server.name, server.os, server.ip, server.port, server.account, server.pwd, server.description, server.id]);
                if (rowResult.rowsAffected > 0) {
                    dataResult.code = 0;
                    dataResult.data = true;
                    dataResult.msg = "修改服务器成功！";
                } else {
                    dataResult.code = 1;
                    dataResult.data = false;
                    dataResult.msg = "修改服务器失败！";
                }
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "修改服务器信息出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 删除服务器信息
         * @param id 服务器ID
         */
        deleteServer: async (id: number) => {
            let deleteSql = "DELETE FROM t_server WHERE id=$1;";

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
                    dataResult.msg = "删除服务器成功！";
                } else {
                    dataResult.code = 1;
                    dataResult.data = false;
                    dataResult.msg = "删除服务器失败！";
                }
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "删除服务器信息出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        }
    };
}
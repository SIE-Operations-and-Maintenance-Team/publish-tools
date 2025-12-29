import { db } from '@/database/sqlite';
import { displayEnvironment } from "@/utils/other";

export function useAppconfigDb() {
    return {
        /**
         * 查询应用配置(分页)列表信息
         * @param { object } params
         * @returns { any }
         */
        getAppconfigList: async (params: GetAppconfigTableParams) => {
            let dataSql = "select ta.id, ta.project_id projectId, tp.name projectName, ta.environment, ta.ms_build_path msBuildPath, ta.dll_mode dllMode, ta.dll_mode_value dllModeValue, ta.config_items_json configItemsJson from t_app_config ta left join t_project tp on ta.project_id = tp.id";
            let totalSql = "select count(*) totalCount from t_app_config ta";
            let where = " where 1=1 ";
            let orderBy = "";
            if (params) {
                if (params.projectId) where += " and ta.project_id = $1 ";
                if (params.environment) where += " and ta.environment = $2 ";
                if (params.sorting) orderBy += ` order by ${ params.sorting } `;
            }
            dataSql += where + orderBy;
            dataSql += " LIMIT $3 OFFSET $4;";
            totalSql += `${where};`;

            // 定义(默认)响应结果
            let dataResult: DataResultType<TableResultType<RowAppconfigType[]>> = {
                code: 0,
                msg: "",
                data: {
                    data: [],
                    total: 0,
                },
            };
            let bindValues = [params.projectId, params.environment, params.maxResultCount, params.skipCount];
            try {
                // 查询数量
                let totalData = await (await db()).select<any>(totalSql, bindValues);
                if (!totalData || totalData.length < 1 || totalData[0].totalCount < 1) return dataResult;
                dataResult.data.total = totalData[0].totalCount;
                // 查询数据
                dataResult.data.data = await (await db()).select<RowAppconfigType[]>(dataSql, bindValues);
                for (let i = 0; i < dataResult.data.data.length; i++) {
                    if(!dataResult.data.data[i].configItemsJson) continue;
                    dataResult.data.data[i].configItems = JSON.parse(String(dataResult.data.data[i].configItemsJson));
                }
                dataResult.msg = "查询应用配置(分页)列表信息成功";
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "查询项目管理(分页)列表信息出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 根据ID获取应用配置信息
         * @param appconfigId 配置ID
         */
        getAppconfigById: async (appconfigId: number) => {
            let dataSql = "select ta.id, ta.project_id projectId, tp.name projectName, ta.environment, ta.ms_build_path msBuildPath, ta.dll_mode dllMode, ta.dll_mode_value dllModeValue, ta.config_items_json configItemsJson from t_app_config ta left join t_project tp on ta.project_id = tp.id where ta.id = $1 ";

            // 定义(默认)响应结果
            let dataResult: DataResultType<TableResultType<RowAppconfigType>> = {
                code: 0,
                msg: "",
                data: {
                    data: {} as RowAppconfigType,
                    total: 0,
                },
            };
            try {
                // 查询数据
                let appconfigData = await (await db()).select<RowAppconfigType[]>(dataSql, [appconfigId]);
                if (appconfigData && appconfigData.length > 0) {
                    dataResult.data.data = appconfigData[0];
                    if(dataResult.data.data.configItemsJson) {
                        dataResult.data.data.configItems = JSON.parse(String(dataResult.data.data.configItemsJson));
                    }
                }
                dataResult.msg = "获取要发布的应用配置信息成功";
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "获取要发布的应用配置信息出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 获取要发布的应用配置信息
         * @param projectId 项目ID
         * @param environment 环境变量
         */
        getPublishAppconfigs: async (projectId: number, environment: number) => {
            let dataSql = "select ta.id, ta.project_id projectId, tp.name projectName, ta.environment, ta.ms_build_path msBuildPath, ta.dll_mode dllMode, ta.dll_mode_value dllModeValue, ta.config_items_json configItemsJson from t_app_config ta left join t_project tp on ta.project_id = tp.id";
            let where = " where ta.project_id = $1 and ta.environment = $2";
            dataSql += where;

            // 定义(默认)响应结果
            let dataResult: DataResultType<TableResultType<RowAppconfigType>> = {
                code: 0,
                msg: "",
                data: {
                    data: {} as RowAppconfigType,
                    total: 0,
                },
            };
            let bindValues = [projectId, environment];
            try {
                // 查询数据
                let appconfigData = await (await db()).select<RowAppconfigType[]>(dataSql, bindValues);
                if (appconfigData && appconfigData.length > 0) {
                    dataResult.data.data = appconfigData[0];
                    if(dataResult.data.data.configItemsJson) {
                        dataResult.data.data.configItems = JSON.parse(String(dataResult.data.data.configItemsJson));
                    }
                }
                dataResult.msg = "获取要发布的应用配置信息成功";
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "获取要发布的应用配置信息出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 插入应用配置信息
         * @param appconfig 应用配置
         */
        insertAppconfig: async (appconfig: RowAppconfigType) => {
            let insertSql = "INSERT INTO t_app_config (project_id, environment, ms_build_path, dll_mode, dll_mode_value, config_items_json) VALUES($1, $2, $3, $4, $5, $6) RETURNING id;";
            // 定义(默认)响应结果
            let dataResult: DataResultType<number> = {
                code: 1,
                msg: "",
                data: 0,
            };
            try {
                // 验证项目ID-环境是否存在
                let existData = await (
                    await db()
                ).select<any>(
                    "select COUNT(*) as totalCount from t_app_config where project_id=$1 and environment=$2",
                    [appconfig.projectId, appconfig.environment]
                );
                if (existData && existData.length > 0 && existData[0].totalCount > 0) {
                    dataResult.code = 1;
                    dataResult.msg = `该环境[${displayEnvironment(Number(appconfig.environment))}]已存在相同的项目名称！`;
                    return dataResult;
                }

                let rowResult = await (await db()).execute(insertSql, [appconfig.projectId, appconfig.environment, appconfig.msBuildPath, appconfig.dllMode, appconfig.dllModeValue, appconfig.configItemsJson]);
                if (rowResult.lastInsertId && rowResult.lastInsertId > 0) {
                    dataResult.code = 0;
                    dataResult.data = rowResult.lastInsertId;
                    dataResult.msg = "新增应用配置成功！";
                } else {
                    dataResult.code = 1;
                    dataResult.msg = "新增应用配置失败！";
                }
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "插入应用配置信息出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 修改应用配置信息
         * @param appconfig 应用配置
         */
        updateAppconfig: async (appconfig: RowAppconfigType) => {
            let updateSql = "UPDATE t_app_config SET project_id=$1, environment=$2, ms_build_path=$3, dll_mode=$4, dll_mode_value=$5, config_items_json=$6 WHERE id=$7;";

            // 定义(默认)响应结果
            let dataResult: DataResultType<boolean> = {
                code: 1,
                msg: "",
                data: false,
            };
            try {
                // 验证项目ID-环境是否存在
                let existData = await (
                    await db()
                ).select<any>(
                    "select COUNT(*) as totalCount from t_app_config where project_id=$1 and environment=$2 and id != $3",
                    [appconfig.projectId, appconfig.environment, appconfig.id]
                );
                if (existData && existData.length > 0 && existData[0].totalCount > 0) {
                    dataResult.code = 1;
                    dataResult.msg = `该环境[${displayEnvironment(Number(appconfig.environment))}]已存在相同的项目编码！`;
                    return dataResult;
                }

                let rowResult = await (await db()).execute(updateSql, [appconfig.projectId, appconfig.environment, appconfig.msBuildPath, appconfig.dllMode, appconfig.dllModeValue, appconfig.configItemsJson, appconfig.id]);
                if (rowResult.rowsAffected > 0) {
                    dataResult.code = 0;
                    dataResult.data = true;
                    dataResult.msg = "修改应用配置成功！";
                } else {
                    dataResult.code = 1;
                    dataResult.data = false;
                    dataResult.msg = "修改应用配置失败！";
                }
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "修改应用配置信息出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 删除应用配置信息
         * @param id 应用配置ID
         */
        deleteAppconfig: async (id: number) => {
            let deleteSql = "DELETE FROM t_app_config WHERE id=$1;";

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
                    dataResult.msg = "删除应用配置成功！";
                } else {
                    dataResult.code = 1;
                    dataResult.data = false;
                    dataResult.msg = "删除应用配置失败！";
                }
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "删除应用配置信息出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        }
    };
}
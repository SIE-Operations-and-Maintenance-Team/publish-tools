import { db } from "@/database/sqlite";

export function useProjectDb() {
    return {
        /**
         * 查询项目管理(分页)列表信息
         * @param { object } params
         * @returns 分页查询结果
         */
        getProjectList: async (params: GetProjectTableParams) => {
            let dataSql =
                "select id,code,name,description,is_default isDefault, assembly_out_path assemblyOutPath from t_project";
            let totalSql = "select count(*) totalCount from t_project";
            let where = " where 1=1 ";
            let orderBy = "";
            if (params) {
                if (params.code) where += " and code = $1 ";
                if (params.name) where += " and name like $2 ";
                if (params.sorting) orderBy += ` order by ${ params.sorting } `;
            }
            dataSql += where + orderBy;
            dataSql += " LIMIT $3 OFFSET $4;";
            totalSql += `${where};`;

            // 定义(默认)响应结果
            let dataResult: DataResultType<TableResultType<RowProjectType[]>> = {
                code: 0,
                msg: "",
                data: {
                    data: [],
                    total: 0,
                },
            };
            // 绑定SQL参数值
            let bindValues = [
                params.code,
                `%${params.name}%`,
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
                ).select<RowProjectType[]>(dataSql, bindValues);
                dataResult.msg = "查询项目管理(分页)列表信息成功";
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "查询项目管理(分页)列表信息出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 获取默认的项目信息
         * @returns 项目默认信息
         */
        getProjectDefault: async () => {
            let dataSql =
                "select id,code,name,description,is_default isDefault, assembly_out_path assemblyOutPath from t_project where is_default = 1;";

            // 定义(默认)响应结果
            let dataResult: DataResultType<TableResultType<RowProjectType>> = {
                code: 0,
                msg: "",
                data: {
                    data: {} as RowProjectType,
                    total: 0
                },
            };
            try {
                // 查询数据
                let projectList: RowProjectType[] = await (
                    await db()
                ).select<RowProjectType[]>(dataSql);
                // 没有默认的项目，就取最近的一条数据
                if (projectList.length < 1) {
                    let dataMaxIdSql =
                        "select id,code,name,description,is_default isDefault, assembly_out_path assemblyOutPath from t_project order by id desc LIMIT 1;";
                    projectList = await (
                        await db()
                    ).select<RowProjectType[]>(dataMaxIdSql);
                }
                if (projectList && projectList.length > 0) {
                    dataResult.data.data = projectList[0];
                }
                dataResult.msg = "获取默认的项目信息成功";
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "获取默认的项目信息出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 根据ID获取项目信息
         * @param projectId 项目ID
         * @returns 项目信息
         */
        getProjectById: async (projectId: number) => {
            let dataSql =
                "select id,code,name,description,is_default isDefault, assembly_out_path assemblyOutPath from t_project where id = $1;";

            // 定义(默认)响应结果
            let dataResult: DataResultType<TableResultType<RowProjectType>> = {
                code: 0,
                msg: "",
                data: {
                    data: {} as RowProjectType,
                    total: 0
                },
            };
            try {
                // 查询数据
                let projectList: RowProjectType[] = await (
                    await db()
                ).select<RowProjectType[]>(dataSql, [projectId]);
                if (projectList && projectList.length > 0) {
                    dataResult.data.data = projectList[0];
                }
                dataResult.msg = "获取项目信息成功";
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "获取项目信息出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 插入项目信息
         * @param project 项目管理
         * @returns 插入结果
         */
        insertProject: async (project: RowProjectType) => {
            let insertSql =
                "INSERT INTO t_project (code, name, description, is_default, assembly_out_path) VALUES($1, $2, $3, $4, $5) RETURNING id;";

            let updateDefaultSql = "";
            if (project.isDefault === 1) {
                updateDefaultSql = "UPDATE t_project SET is_default = 0 WHERE is_default = 1;";
            }

            // 开启事务执行
            let execSql = `BEGIN TRANSACTION;${updateDefaultSql}${insertSql}COMMIT;`;
            // 定义(默认)响应结果
            let dataResult: DataResultType<number> = {
                code: 1,
                msg: "",
                data: 0,
            };
            try {
                // 验证项目编号是否存在
                let existData = await (
                    await db()
                ).select<any>(
                    "select COUNT(*) as totalCount from t_project where code=$1",
                    [project.code]
                );
                if (existData && existData.length > 0 && existData[0].totalCount > 0) {
                    dataResult.code = 1;
                    dataResult.msg = `项目编号[${project.code}]已存在！`;
                    return dataResult;
                }

                let rowResult = await (
                    await db()
                ).execute(execSql, [
                    project.code,
                    project.name,
                    project.description,
                    project.isDefault,
                    project.assemblyOutPath
                ]);
                if (rowResult.lastInsertId && rowResult.lastInsertId > 0) {
                    dataResult.code = 0;
                    dataResult.data = rowResult.lastInsertId;
                    dataResult.msg = "新增项目信息成功！";
                } else {
                    dataResult.code = 1;
                    dataResult.msg = "新增项目信息失败！";
                }

            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "插入项目信息出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 修改项目信息
         * @param project 项目管理
         * @returns 修改结果
         */
        updateProject: async (project: RowProjectType) => {
            let updateSql =
                "UPDATE t_project SET code=$1, name=$2, description=$3, is_default=$4, assembly_out_path=$5 WHERE id=$6;";

            let updateDefaultSql = "";
            if (project.isDefault === 1) {
                updateDefaultSql = "UPDATE t_project SET is_default = 0 WHERE is_default = 1;";
            }
            // 开启事务执行
            let execSql = `BEGIN TRANSACTION;${updateDefaultSql}${updateSql}COMMIT;`;
            // 定义(默认)响应结果
            let dataResult: DataResultType<boolean> = {
                code: 1,
                msg: "",
                data: false,
            };
            try {
                // 验证项目编号是否存在
                let existData = await (
                    await db()
                ).select<any>(
                    "select COUNT(*) as totalCount from t_project where code=$1 and id != $2",
                    [project.code, project.id]
                );
                if (existData && existData.length > 0 && existData[0].totalCount > 0) {
                    dataResult.code = 1;
                    dataResult.msg = `项目编号[${project.code}]已存在！`;
                    return dataResult;
                }
                let rowResult = await (
                    await db()
                ).execute(execSql, [
                    project.code,
                    project.name,
                    project.description,
                    project.isDefault,
                    project.assemblyOutPath,
                    project.id
                ]);
                if (rowResult.rowsAffected > 0) {
                    dataResult.code = 0;
                    dataResult.data = true;
                    dataResult.msg = "修改项目信息成功！";
                } else {
                    dataResult.code = 1;
                    dataResult.data = false;
                    dataResult.msg = "修改项目信息失败！";
                }
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "修改项目信息出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 修改项目默认信息
         * @param id 项目ID
         * @param isDefault 是否默认 
         * @returns 修改结果
         */
        updateProjectIsDefault: async (id: number, isDefault: number) => {
            let updateSql = "UPDATE t_project SET is_default = $1 WHERE id = $2;";
            if (isDefault === 1) {
                let updateDefaultSql = "UPDATE t_project SET is_default = 0 WHERE is_default = 1;";
                updateSql = updateDefaultSql + updateSql;
            }
            // 开启事务执行
            let execSql = `BEGIN TRANSACTION;${updateSql}COMMIT;`;
            // 定义(默认)响应结果
            let dataResult: DataResultType<boolean> = {
                code: 1,
                msg: "",
                data: false,
            };
            try {
                let rowResult = await (
                    await db()
                ).execute(execSql, [isDefault, id]);
                if (rowResult.rowsAffected > 0) {
                    dataResult.code = 0;
                    dataResult.data = true;
                    dataResult.msg = "修改项目默认信息成功！";
                } else {
                    dataResult.code = 1;
                    dataResult.data = false;
                    dataResult.msg = "修改项目默认信息失败！";
                }
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "修改项目默认信息出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 删除项目信息
         * @param id 项目ID
         * @returns 删除结果 
         */
        deleteProject: async (id: number) => {
            let deleteSql = "DELETE FROM t_project WHERE id=$1;";
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
                    dataResult.msg = "删除项目信息成功！";
                } else {
                    dataResult.code = 1;
                    dataResult.data = false;
                    dataResult.msg = "删除项目信息失败！";
                }
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "删除项目信息出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },
    };
}

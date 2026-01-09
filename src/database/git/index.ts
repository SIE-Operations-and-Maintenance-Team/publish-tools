/**
 * Git 数据库交互模块
 * 提供与 SQLite 数据库的交互功能，包括查询和插入 Git 信息。
 */

import { db } from "@/database/sqlite";

export function useGitDb() {
  return {
    /**
     * 查询 Git 信息（分页）
     * @param {GetGitParams} params - 查询参数，包括Git名称、仓库地址、分页信息等。
     * @returns {Promise<DataResultType<RowGitType[]>>} - 查询结果。
     */
    getGitList: async (params: GetGitParams) => {
      let dataSql =
        "SELECT id, git_name gitName, git_repository gitRepository, git_path gitPath, branch_name branchName, remark FROM t_git";
      let totalSql = "SELECT count(*) totalCount FROM t_git";
      let where = " WHERE 1=1 ";
      let orderBy = "";
      if (params) {
        if (params.gitName) where += " AND git_name LIKE $1 ";
        if (params.gitRepository) where += " AND git_repository LIKE $2 ";
        if (params.sorting) orderBy += ` ORDER BY ${params.sorting} `;
      }
      dataSql += where + orderBy;
      dataSql += " LIMIT $3 OFFSET $4;";
      totalSql += `${where};`;

      let dataResult = {
        code: 0,
        msg: "",
        data: {
          data: [] as RowGitType[],
          total: 0,
        },
      };


      let bindValues = [
        `%${params.gitName}%`,
        `%${params.gitRepository}%`,
        params.maxResultCount,
        params.skipCount,
      ];

      try {
        let totalData = await (await db()).select<any>(totalSql, bindValues);
        if (!totalData || totalData.length < 1 || totalData[0].totalCount < 1)
          return dataResult;
        dataResult.data.total = totalData[0].totalCount;
        dataResult.data.data = await (
          await db()
        ).select<RowGitType[]>(dataSql, bindValues);
        dataResult.msg = "查询Git信息成功";
      } catch (error) {
        dataResult.code = -1;
        dataResult.msg = "查询Git信息出错：" + JSON.stringify(error);
        console.error(error);
      }
      return dataResult;
    },
        /**
     * 根据ID获取 Git 信息
     * @param {number} id - Git 信息ID。
     * @returns {Promise<DataResultType<RowGitType>>} - 查询结果。
     */
    getGitById: async (id: number) => {
      let selectSql = "SELECT id, git_name gitName, git_repository gitRepository, git_path gitPath, branch_name branchName, remark FROM t_git WHERE id=$1;";

      let dataResult = {
        code: 0,
        msg: "",
        data: {
          data: null as RowGitType | null,
        },
      };

      let bindValues = [id];

      try {
        // 修复：将类型从 RowGitType 改为 RowGitType[]
        let selectData = await (await db()).select<RowGitType[]>(selectSql, bindValues);
        if (selectData && selectData.length > 0) {
          dataResult.data.data = selectData[0];
          dataResult.msg = "查询Git信息成功";
        } else {
          dataResult.code = -1;
          dataResult.msg = "未找到对应的Git信息";
        }
      } catch (error) {
        dataResult.code = -1;
        dataResult.msg = "查询Git信息出错：" + JSON.stringify(error);
        console.error(error);
      }
      return dataResult;
    },
    /**
     * 插入 Git 信息
     * @param {RowGitType} git - Git 信息对象。
     * @returns {Promise<DataResultType<number>>} - 插入结果。
     */
    insertGit: async (git: RowGitType) => {
      let insertSql =
        "INSERT INTO t_git (git_name, git_repository, git_path, branch_name, remark) VALUES($1, $2, $3, $4, $5) RETURNING id;";

      let dataResult = {
        code: 1,
        msg: "",
        data: 0,
      };

      let bindValues = [
        git.gitName,
        git.gitRepository,
        git.gitPath,
        git.branchName,
        git.remark,
      ];

      try {
        let insertData = await (await db()).select<any>(insertSql, bindValues);
        if (insertData && insertData.length > 0) {
          dataResult.code = 0;
          dataResult.data = insertData[0].id;
          dataResult.msg = "添加Git信息成功";
        }
      } catch (error) {
        dataResult.msg = "添加Git信息出错：" + JSON.stringify(error);
        console.error(error);
      }
      return dataResult;
    },

    /**
     * 更新 Git 信息
     * @param {RowGitType} git - Git 信息对象。
     * @returns {Promise<DataResultType<boolean>>} - 更新结果。
     */
    updateGit: async (git: RowGitType) => {
      let updateSql =
        "UPDATE t_git SET git_name=$1, git_repository=$2, git_path=$3, branch_name=$4, remark=$5 WHERE id=$6;";

      let dataResult = {
        code: 1,
        msg: "",
        data: false,
      };

      let bindValues = [
        git.gitName,
        git.gitRepository,
        git.gitPath,
        git.branchName,
        git.remark,
        git.id,
      ];

      try {
        let updateData = await (await db()).execute(updateSql, bindValues);
        if (updateData?.rowsAffected && updateData.rowsAffected > 0) {
          dataResult.code = 0;
          dataResult.data = true;
          dataResult.msg = "修改Git信息成功";
        }
      } catch (error) {
        dataResult.msg = "修改Git信息出错：" + JSON.stringify(error);
        console.error(error);
      }
      return dataResult;
    },

    /**
     * 删除 Git 信息
     * @param {number} id - Git 信息ID。
     * @returns {Promise<DataResultType<boolean>>} - 删除结果。
     */
    deleteGit: async (id: number) => {
      let deleteSql = "DELETE FROM t_git WHERE id=$1;";

      let dataResult = {
        code: 1,
        msg: "",
        data: false,
      };

      let bindValues = [id];

      try {
        let deleteData = await (await db()).execute(deleteSql, bindValues);
        if (deleteData?.rowsAffected && deleteData.rowsAffected > 0) {
          dataResult.code = 0;
          dataResult.data = true;
          dataResult.msg = "删除Git信息成功";
        }
      } catch (error) {
        dataResult.msg = "删除Git信息出错：" + JSON.stringify(error);
        console.error(error);
      }
      return dataResult;
    }
  };
}
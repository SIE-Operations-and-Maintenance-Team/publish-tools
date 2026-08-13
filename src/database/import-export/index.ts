// src/database/import-export/index.ts
import { db } from "@/database/sqlite";

/**
 * 从 ConfigItemsType JSON 中提取所有被引用的 server ID
 * 涵盖: webApiHost.serverIds, scheduleServer.serverIds, webClient.serverIds,
 *       wpfClient.serverId, spcMonitor.serverIds
 */
function extractServerIds(configItems: ConfigItemsType): number[] {
  const ids: number[] = [];
  const pushIfArray = (arr: unknown) => {
    if (Array.isArray(arr)) ids.push(...arr.filter((v) => typeof v === "number"));
  };
  const pushIfNumber = (v: unknown) => {
    if (typeof v === "number" && v > 0) ids.push(v);
  };

  const ci = configItems;
  pushIfArray(ci.webApiHost?.serverIds);
  pushIfArray(ci.scheduleServer?.serverIds);
  pushIfArray(ci.webClient?.serverIds);
  pushIfNumber(ci.wpfClient?.serverId);
  pushIfArray(ci.spcMonitor?.serverIds);

  // 去重
  return [...new Set(ids)];
}

/**
 * 从 dllModeValue JSON 中提取引用的 TFS/Git 配置 id
 * @param dllModeValue - SelectTfsType / SelectGitType 的 JSON 字符串
 * @returns 有效 id；dllModeValue 为空、非 JSON、或 id 非正数时返回 null
 */
function extractDllModeId(dllModeValue: string | null): number | null {
  if (!dllModeValue) return null;
  try {
    const parsed = JSON.parse(dllModeValue);
    return typeof parsed?.id === "number" && parsed.id > 0 ? parsed.id : null;
  } catch {
    return null;
  }
}

export function useImportExportDb() {
  return {
    /**
     * 根据 appconfig ID 列表收集导出数据
     * @param appconfigIds - 应用配置 ID 数组
     * @returns ExportItem 数组，跳过已删除/无法查询的记录（调用方根据返回长度与输入对比判断跳过数）
     */
    collectExportData: async (appconfigIds: number[]): Promise<ExportItem[]> => {
      const items: ExportItem[] = [];

      for (const id of appconfigIds) {
        try {
          // 1. 查询 appconfig
          const appconfigRows = await (
            await db()
          ).select<RowAppconfigType[]>(
            "SELECT id, project_id projectId, environment, ms_build_path msBuildPath, dll_mode dllMode, dll_mode_value dllModeValue, build_mode buildMode, config_items_json configItemsJson FROM t_app_config WHERE id = $1",
            [id]
          );
          if (!appconfigRows || appconfigRows.length === 0) {
            console.warn(`[import-export] appconfig id=${id} not found, skipped`);
            continue;
          }
          const ac = appconfigRows[0];

          // 2. 查询 project
          const projectRows = await (
            await db()
          ).select<RowProjectType[]>(
            "SELECT id, code, name, description, is_default isDefault, assembly_out_path assemblyOutPath FROM t_project WHERE id = $1",
            [ac.projectId]
          );
          if (!projectRows || projectRows.length === 0) {
            console.warn(`[import-export] project id=${ac.projectId} not found for appconfig ${id}, skipped`);
            continue;
          }
          const proj = projectRows[0];

          // 3. 提取 serverIds
          let configItems: ConfigItemsType = { webApiHost: {} as any, scheduleServer: {} as any, webClient: {} as any, wpfClient: {} as any, spcMonitor: {} as any, isRebuild: null, isBackup: null, isNewVersion: null };
          if (ac.configItemsJson) {
            try {
              configItems = JSON.parse(String(ac.configItemsJson));
            } catch {
              console.warn(`[import-export] parse configItemsJson failed for appconfig ${id}`);
            }
          }
          const serverIds = extractServerIds(configItems);

          // 2.5 解析获取DLL方式：TFS/Git 模式收集引用的配置记录；悬空引用回退「当天」
          let dllMode = ac.dllMode;
          let dllModeValue = ac.dllModeValue;
          const tfsConfigs: ExportTfsConfig[] = [];
          const gitConfigs: ExportGitConfig[] = [];

          const fallbackToToday = () => {
            console.warn(
              `[import-export] appconfig ${id} 的获取DLL方式引用无效（dllMode=${ac.dllMode}），回退为「当天」`
            );
            dllMode = "当天";
            dllModeValue = null;
          };

          if (dllMode === "TFS") {
            const tfsId = extractDllModeId(dllModeValue);
            if (tfsId) {
              const tfsRows = await (
                await db()
              ).select<RowTfsType[]>(
                "SELECT id, tfs_name tfsName, tfs_server_url tfsServerUrl, tfs_source_path tfsSourcePath, tfs_local_path tfsLocalPath, tfvc_path tfvcPath, remark FROM t_team_foundation_server WHERE id = $1",
                [tfsId]
              );
              if (tfsRows && tfsRows.length > 0) {
                const tfs = tfsRows[0];
                tfsConfigs.push({
                  oldTfsId: tfs.id ?? 0,
                  tfsName: tfs.tfsName,
                  tfsServerUrl: tfs.tfsServerUrl,
                  tfsSourcePath: tfs.tfsSourcePath,
                  tfsLocalPath: tfs.tfsLocalPath,
                  tfvcPath: tfs.tfvcPath,
                  remark: tfs.remark,
                });
              } else {
                fallbackToToday();
              }
            } else {
              fallbackToToday();
            }
          } else if (dllMode === "Git") {
            const gitId = extractDllModeId(dllModeValue);
            if (gitId) {
              const gitRows = await (
                await db()
              ).select<RowGitType[]>(
                "SELECT id, git_name gitName, git_repository gitRepository, git_path gitPath, branch_name branchName, remark FROM t_git WHERE id = $1",
                [gitId]
              );
              if (gitRows && gitRows.length > 0) {
                const git = gitRows[0];
                gitConfigs.push({
                  oldGitId: git.id ?? 0,
                  gitName: git.gitName,
                  gitRepository: git.gitRepository,
                  gitPath: git.gitPath,
                  branchName: git.branchName,
                  remark: git.remark,
                });
              } else {
                fallbackToToday();
              }
            } else {
              fallbackToToday();
            }
          }

          // 4. 查询 servers
          const servers: ExportServer[] = [];
          for (const sid of serverIds) {
            const serverRows = await (
              await db()
            ).select<RowServerType[]>(
              "SELECT id, name, os, ip, port, account, pwd, description FROM t_server WHERE id = $1",
              [sid]
            );
            if (serverRows && serverRows.length > 0) {
              const srv = serverRows[0];
              servers.push({
                oldServerId: srv.id ?? 0,
                name: srv.name,
                os: srv.os,
                ip: srv.ip,
                port: srv.port,
                account: srv.account,
                pwd: srv.pwd,
                description: srv.description,
              });
            } else {
              console.warn(`[import-export] server id=${sid} referenced but not found`);
            }
          }

          // 原样保留获取DLL方式；TFS/Git 引用的配置记录随导出，悬空引用已回退「当天」
          items.push({
            project: {
              code: proj.code ?? "",
              name: proj.name ?? "",
              description: proj.description,
              isDefault: proj.isDefault,
              assemblyOutPath: proj.assemblyOutPath,
            },
            appconfig: {
              environment: ac.environment ?? 0,
              msBuildPath: ac.msBuildPath,
              dllMode,
              dllModeValue,
              buildMode: ac.buildMode ?? "Debug",
              configItemsJson: ac.configItemsJson ?? "{}",
            },
            servers,
            tfsConfigs: tfsConfigs.length > 0 ? tfsConfigs : undefined,
            gitConfigs: gitConfigs.length > 0 ? gitConfigs : undefined,
          });
        } catch (err) {
          console.error(`[import-export] collectExportData error for appconfig id=${id}:`, err);
          // 跳过该条，继续下一条
        }
      }

      return items;
    },

    /**
     * 执行导入。采用「先插新 -> 全部成功后删旧 -> 失败补偿」策略，不使用显式事务。
     *
     * 背景：plugin-sql 底层为 sqlx 连接池（默认 max_connections=10），每次 execute/select
     * 落在不同连接上；前端 BEGIN/COMMIT 跨连接无法绑定同一连接，会导致写锁互斥超时
     * 报 "database is locked" (code 5)。故改用补偿式保证业务一致性：
     *   1. 记录冲突的旧 projectId（先不删）
     *   2. 插入新 project / appconfig / servers，并做 serverId 重映射
     *   3. 新数据全部成功后，才删除旧数据（删旧失败不影响新数据，仅记录警告）
     *   4. 任一步骤失败 -> 补偿删除本次新插入的数据（按 newProjectId 级联），旧数据保持不动
     *
     * 单条失败回滚该条（补偿清理），继续下一条。
     *
     * @param items - 导入项数组
     * @returns ImportResult[] 每条结果
     */
    executeImport: async (items: ExportItem[]): Promise<ImportResult[]> => {
      const results: ImportResult[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const result: ImportResult = {
          index: i,
          success: false,
          projectCode: item.project.code,
          environment: item.appconfig.environment,
          message: "",
        };

        // 声明在外层，供 catch 中失败补偿清理使用
        let newProjectId = 0;
        const newTfsIds: number[] = []; // 本次插入的 TFS 配置 id，失败时补偿删除
        const newGitIds: number[] = []; // 本次插入的 Git 配置 id，失败时补偿删除

        try {
          const database = await db();

          // 1. 冲突检测：记录所有同 code 的旧 projectId（先不删，确保新数据插入成功后再删）
          //    收集全部，避免历史残留的重复记录累积
          const existRows = await database.select<{ id: number }[]>(
            "SELECT id FROM t_project WHERE code = $1",
            [item.project.code]
          );
          const oldProjectIds = (existRows || []).map((r) => r.id);

          // 1.5 插入 TFS/Git 配置（先于 project；总是插入新记录，不做同名匹配）
          //     直接 SQL 插入，绕过 insertTfs 业务层的重名校验（t_git 的 insertGit 无校验，统一走直接 SQL）
          const tfsIdMap: Record<number, number> = {};
          for (const tfs of item.tfsConfigs ?? []) {
            const insertTfsResult = await database.execute(
              "INSERT INTO t_team_foundation_server (tfs_name, tfs_server_url, tfs_source_path, tfs_local_path, tfvc_path, remark) VALUES($1, $2, $3, $4, $5, $6) RETURNING id;",
              [
                tfs.tfsName,
                tfs.tfsServerUrl,
                tfs.tfsSourcePath,
                tfs.tfsLocalPath,
                tfs.tfvcPath,
                tfs.remark,
              ]
            );
            const newTfsId = insertTfsResult.lastInsertId ?? 0;
            if (!newTfsId || newTfsId <= 0) {
              throw new Error("插入 TFS 配置失败，未获取到新 ID");
            }
            newTfsIds.push(newTfsId);
            tfsIdMap[tfs.oldTfsId] = newTfsId;
          }

          const gitIdMap: Record<number, number> = {};
          for (const git of item.gitConfigs ?? []) {
            const insertGitResult = await database.execute(
              "INSERT INTO t_git (git_name, git_repository, git_path, branch_name, remark) VALUES($1, $2, $3, $4, $5) RETURNING id;",
              [
                git.gitName,
                git.gitRepository,
                git.gitPath,
                git.branchName,
                git.remark,
              ]
            );
            const newGitId = insertGitResult.lastInsertId ?? 0;
            if (!newGitId || newGitId <= 0) {
              throw new Error("插入 Git 配置失败，未获取到新 ID");
            }
            newGitIds.push(newGitId);
            gitIdMap[git.oldGitId] = newGitId;
          }

          // 2. 插入新 project（isDefault 不导入旧值，固定为 0）
          const insertProjectResult = await database.execute(
            "INSERT INTO t_project (code, name, description, is_default, assembly_out_path) VALUES($1, $2, $3, $4, $5) RETURNING id;",
            [
              item.project.code,
              item.project.name,
              item.project.description,
              0, // 不导入旧的 isDefault
              item.project.assemblyOutPath,
            ]
          );
          newProjectId = insertProjectResult.lastInsertId ?? 0;
          if (!newProjectId || newProjectId <= 0) {
            throw new Error("插入 project 失败，未获取到新 ID");
          }

          // 3. 插入新 appconfig（buildMode 默认 Debug）
          //    TFS/Git 模式：把 dllModeValue 中的配置 id 重映射为本次插入的新 id（精确替换 id 字段，不用正则）
          let dllModeValue = item.appconfig.dllModeValue;
          if (
            (item.appconfig.dllMode === "TFS" || item.appconfig.dllMode === "Git") &&
            dllModeValue
          ) {
            try {
              const parsed = JSON.parse(dllModeValue);
              const idMap = item.appconfig.dllMode === "TFS" ? tfsIdMap : gitIdMap;
              if (typeof parsed?.id === "number" && !idMap[parsed.id]) {
                console.warn(
                  `[import-export] item ${i} 的配置 id=${parsed.id} 未在导出文件中找到，原样保留`
                );
              }
              if (typeof parsed?.id === "number" && idMap[parsed.id]) {
                parsed.id = idMap[parsed.id];
                dllModeValue = JSON.stringify(parsed);
              }
            } catch {
              // dllModeValue 非 JSON 时原样写入（仅手工构造的文件可能出现，使用时报错由业务层提示）
              console.warn(
                `[import-export] item ${i} 的 dllModeValue 无法解析为 JSON，原样写入`
              );
            }
          }
          const insertAppconfigResult = await database.execute(
            "INSERT INTO t_app_config (project_id, environment, ms_build_path, dll_mode, dll_mode_value, build_mode, config_items_json) VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING id;",
            [
              newProjectId,
              item.appconfig.environment,
              item.appconfig.msBuildPath,
              item.appconfig.dllMode,
              dllModeValue,
              item.appconfig.buildMode || "Debug",
              item.appconfig.configItemsJson,
            ]
          );
          const newAppconfigId = insertAppconfigResult.lastInsertId ?? 0;
          if (!newAppconfigId || newAppconfigId <= 0) {
            throw new Error("插入 appconfig 失败，未获取到新 ID");
          }

          // 4. 插入 servers，记录 oldId -> newId 映射
          const serverIdMap: Record<number, number> = {};

          // 先从 configItemsJson 中提取原始 serverIds 作为 oldId
          let configItems: ConfigItemsType | null = null;
          try {
            configItems = JSON.parse(item.appconfig.configItemsJson);
          } catch {
            configItems = null;
          }

          if (configItems) {
            const oldServerIds = extractServerIds(configItems);
            for (let si = 0; si < item.servers.length; si++) {
              const srv = item.servers[si];
              const insertServerResult = await database.execute(
                "INSERT INTO t_server (project_id, name, os, ip, port, account, pwd, description) VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id;",
                [
                  newProjectId,
                  srv.name,
                  srv.os,
                  srv.ip,
                  srv.port,
                  srv.account,
                  srv.pwd,
                  srv.description,
                ]
              );
              const newServerId = insertServerResult.lastInsertId ?? 0;
              if (newServerId && newServerId > 0 && si < oldServerIds.length) {
                serverIdMap[oldServerIds[si]] = newServerId;
              }
            }

            // 5. serverId 重映射：更新 configItemsJson 中的 serverId 引用
            if (Object.keys(serverIdMap).length > 0) {
              let updatedJson = item.appconfig.configItemsJson;
              for (const [oldIdStr, newId] of Object.entries(serverIdMap)) {
                const oldId = Number(oldIdStr);
                // 替换 JSON 中所有出现的数字 literal
                // 匹配 "serverIds": [..., oldId, ...] 或 "serverId": oldId
                // 使用正则精确替换：确保 oldId 前后是 JSON 边界符
                const regex = new RegExp(
                  `(?<=[^\\d])${oldId}(?=[^\\d])`,
                  "g"
                );
                updatedJson = updatedJson.replace(regex, String(newId));
              }
              await database.execute(
                "UPDATE t_app_config SET config_items_json = $1 WHERE id = $2",
                [updatedJson, newAppconfigId]
              );
            }
          }

          // 6. 新数据全部插入成功后，删除旧数据（放最后，确保"删旧"不会先于"插新"导致数据丢失）
          //    删旧失败不影响新数据可用性，仅记录警告
          let cleanupWarning = "";
          for (const oldId of oldProjectIds) {
            try {
              await database.execute(
                "DELETE FROM t_server WHERE project_id = $1",
                [oldId]
              );
              await database.execute(
                "DELETE FROM t_app_config WHERE project_id = $1",
                [oldId]
              );
              await database.execute(
                "DELETE FROM t_project WHERE id = $1",
                [oldId]
              );
            } catch (cleanErr) {
              cleanupWarning += ` 旧记录 id=${oldId} 清理失败: ${(cleanErr as Error).message};`;
            }
          }

          result.success = true;
          result.message = cleanupWarning
            ? `导入成功，但存在清理警告:${cleanupWarning}`
            : "导入成功";
        } catch (err: any) {
          // 失败补偿：删除本次已插入的新数据（按 newProjectId 级联清理），保证不留半成品
          if (newProjectId) {
            try {
              const database = await db();
              await database.execute(
                "DELETE FROM t_server WHERE project_id = $1",
                [newProjectId]
              );
              await database.execute(
                "DELETE FROM t_app_config WHERE project_id = $1",
                [newProjectId]
              );
              await database.execute(
                "DELETE FROM t_project WHERE id = $1",
                [newProjectId]
              );
            } catch (cleanErr) {
              // 补偿清理失败需上报，不吞掉
              console.error(
                `[import-export] 补偿清理失败 item ${i}, newProjectId=${newProjectId}:`,
                cleanErr
              );
            }
          }
          // 失败补偿：删除本次已插入的 TFS/Git 配置记录（只删本次插入的，不影响目标库原有记录）
          for (const tid of newTfsIds) {
            try {
              const database = await db();
              await database.execute(
                "DELETE FROM t_team_foundation_server WHERE id = $1",
                [tid]
              );
            } catch (cleanErr) {
              // 补偿清理失败需上报，不吞掉
              console.error(
                `[import-export] 补偿清理失败 TFS id=${tid}:`,
                cleanErr
              );
            }
          }
          for (const gid of newGitIds) {
            try {
              const database = await db();
              await database.execute("DELETE FROM t_git WHERE id = $1", [gid]);
            } catch (cleanErr) {
              // 补偿清理失败需上报，不吞掉
              console.error(
                `[import-export] 补偿清理失败 Git id=${gid}:`,
                cleanErr
              );
            }
          }
          result.success = false;
          result.message = `导入失败: ${err?.message || JSON.stringify(err)}`;
          console.error(`[import-export] executeImport error for item ${i}:`, err);
        }

        results.push(result);
      }

      return results;
    },

    /**
     * 检测导入冲突：返回冲突的 project.code 列表
     */
    checkImportConflicts: async (items: ExportItem[]): Promise<ImportPreviewItem[]> => {
      const previewItems: ImportPreviewItem[] = [];
      const database = await db();

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const existRows = await database.select<{ id: number }[]>(
          "SELECT id FROM t_project WHERE code = $1",
          [item.project.code]
        );
        previewItems.push({
          index: i,
          projectCode: item.project.code,
          projectName: item.project.name,
          environment: item.appconfig.environment,
          serverCount: item.servers.length,
          conflict: existRows && existRows.length > 0,
        });
      }

      return previewItems;
    },
  };
}

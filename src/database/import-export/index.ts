// src/database/import-export/index.ts
import { db } from "@/database/sqlite";
import type { RowProjectType } from "@/types/project";
import type { RowAppconfigType } from "@/types/appconfig";
import type { RowServerType } from "@/types/server";

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
              dllMode: ac.dllMode,
              dllModeValue: ac.dllModeValue,
              buildMode: ac.buildMode ?? "Debug",
              configItemsJson: ac.configItemsJson ?? "{}",
            },
            servers,
          });
        } catch (err) {
          console.error(`[import-export] collectExportData error for appconfig id=${id}:`, err);
          // 跳过该条，继续下一条
        }
      }

      return items;
    },

    /**
     * 执行导入。每条 ExportItem 独立事务：冲突时级联删除旧数据 -> 插入新数据 -> serverId 重映射。
     * 单条失败回滚该条事务，继续下一条。
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

        try {
          const database = await db();

          // 开启事务
          await database.execute("BEGIN TRANSACTION");

          // 1. 冲突检测
          const existRows = await database.select<{ id: number }[]>(
            "SELECT id FROM t_project WHERE code = $1",
            [item.project.code]
          );

          let oldProjectId: number | null = null;
          if (existRows && existRows.length > 0) {
            oldProjectId = existRows[0].id;
          }

          // 2. 级联删除旧数据
          if (oldProjectId !== null) {
            await database.execute(
              "DELETE FROM t_server WHERE project_id = $1",
              [oldProjectId]
            );
            await database.execute(
              "DELETE FROM t_app_config WHERE project_id = $1",
              [oldProjectId]
            );
            await database.execute(
              "DELETE FROM t_project WHERE id = $1",
              [oldProjectId]
            );
          }

          // 3. 插入新 project（isDefault 不导入旧值，固定为 0）
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
          const newProjectId = insertProjectResult.lastInsertId;
          if (!newProjectId || newProjectId <= 0) {
            throw new Error("插入 project 失败，未获取到新 ID");
          }

          // 4. 插入新 appconfig（buildMode 默认 Debug）
          const insertAppconfigResult = await database.execute(
            "INSERT INTO t_app_config (project_id, environment, ms_build_path, dll_mode, dll_mode_value, build_mode, config_items_json) VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING id;",
            [
              newProjectId,
              item.appconfig.environment,
              item.appconfig.msBuildPath,
              item.appconfig.dllMode,
              item.appconfig.dllModeValue,
              item.appconfig.buildMode || "Debug",
              item.appconfig.configItemsJson,
            ]
          );
          const newAppconfigId = insertAppconfigResult.lastInsertId;
          if (!newAppconfigId || newAppconfigId <= 0) {
            throw new Error("插入 appconfig 失败，未获取到新 ID");
          }

          // 5. 插入 servers，记录 oldId -> newId 映射
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
              const newServerId = insertServerResult.lastInsertId;
              if (newServerId && newServerId > 0 && si < oldServerIds.length) {
                serverIdMap[oldServerIds[si]] = newServerId;
              }
            }

            // 6. serverId 重映射：更新 configItemsJson 中的 serverId 引用
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

          // 提交事务
          await database.execute("COMMIT");

          result.success = true;
          result.message = "导入成功";
        } catch (err: any) {
          // 回滚事务
          try {
            const database = await db();
            await database.execute("ROLLBACK");
          } catch {
            // 忽略回滚错误
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

import { db } from '@/database/sqlite';
import { formatDate } from "@/utils/formatTime";

export function useSettingsDb() {
    return {
        /**
         * 读取全局设置（id=1）。若无行则插入默认行后重查。
         */
        getSettings: async () => {
            const selectSql = "select id, one_click_publish_enabled oneClickPublishEnabled, win_service_retry_count winServiceRetryCount, win_service_retry_interval winServiceRetryInterval, win_copy_retry_count winCopyRetryCount, win_copy_retry_interval winCopyRetryInterval, ssh_mcp_url sshMcpUrl, ssh_mcp_auto_sync sshMcpAutoSync, startup_menu startupMenu, update_time updateTime from t_settings where id = 1";

            let dataResult: DataResultType<RowSettingsType> = {
                code: 0,
                msg: "",
                data: {} as RowSettingsType,
            };
            try {
                let rows = await (await db()).select<RowSettingsType[]>(selectSql);
                if (!rows || rows.length < 1) {
                    // 插入默认行（走 schema DEFAULT），再重查
                    await (await db()).execute("INSERT INTO t_settings (id) VALUES (1);");
                    rows = await (await db()).select<RowSettingsType[]>(selectSql);
                }
                dataResult.data = rows[0];
                dataResult.msg = "查询设置成功";
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "查询设置出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },

        /**
         * 保存全局设置（upsert id=1）。
         */
        saveSettings: async (data: RowSettingsType) => {
            const updateSql = "UPDATE t_settings SET one_click_publish_enabled = $1, win_service_retry_count = $2, win_service_retry_interval = $3, win_copy_retry_count = $4, win_copy_retry_interval = $5, ssh_mcp_url = $6, ssh_mcp_auto_sync = $7, startup_menu = $8, update_time = $9 WHERE id = 1";
            const insertSql = "INSERT INTO t_settings (id, one_click_publish_enabled, win_service_retry_count, win_service_retry_interval, win_copy_retry_count, win_copy_retry_interval, ssh_mcp_url, ssh_mcp_auto_sync, startup_menu, update_time) VALUES(1, $1, $2, $3, $4, $5, $6, $7, $8, $9)";
            const bindValues = [
                data.oneClickPublishEnabled,
                data.winServiceRetryCount,
                data.winServiceRetryInterval,
                data.winCopyRetryCount,
                data.winCopyRetryInterval,
                data.sshMcpUrl || "http://127.0.0.1:61823",
                data.sshMcpAutoSync ?? 0,
                data.startupMenu || "workstation",
                formatDate(new Date(), "YYYY-mm-dd HH:MM:SS"),
            ];

            let dataResult: DataResultType<number> = { code: 1, msg: "", data: 0 };
            try {
                let rowResult = await (await db()).execute(updateSql, bindValues);
                if (rowResult.rowsAffected < 1) {
                    rowResult = await (await db()).execute(insertSql, bindValues);
                }
                if (rowResult.rowsAffected > 0) {
                    dataResult.code = 0;
                    dataResult.data = 1;
                    dataResult.msg = "保存设置成功！";
                } else {
                    dataResult.msg = "保存设置失败！";
                }
            } catch (error) {
                dataResult.code = -1;
                dataResult.msg = "保存设置出错：" + JSON.stringify(error);
                console.error(error);
            }
            return dataResult;
        },
    };
}

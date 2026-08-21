import { db } from '@/database/sqlite';

export function useDiscoveryPrefixDb() {
  return {
    getPrefixes: async () => {
      const rows = await (await db()).select<DiscoveryPrefix[]>(
        "select id, prefix, enabled, is_default isDefault from t_discovery_prefix order by is_default desc, prefix asc"
      );
      return { code: 0, msg: "ok", data: rows } as DataResultType<DiscoveryPrefix[]>;
    },
    upsertPrefix: async (row: DiscoveryPrefix) => {
      if (!row.prefix?.trim()) return { code: 1, msg: "前缀不能为空", data: 0 } as DataResultType<number>;
      // 存在则 update enabled，否则 insert
      // prefix 唯一键，冲突时 update
      const r = await (await db()).execute(
        "INSERT INTO t_discovery_prefix (prefix, enabled, is_default) VALUES ($1,$2,$3) ON CONFLICT(prefix) DO UPDATE SET enabled=$2",
        [row.prefix.trim(), row.enabled ?? 1, row.isDefault ?? 0]
      );
      return { code: 0, msg: "ok", data: r.rowsAffected } as DataResultType<number>;
    },
    deletePrefix: async (id: number) => {
      const rows = await (await db()).select<DiscoveryPrefix[]>("select is_default isDefault from t_discovery_prefix where id=$1", [id]);
      if (rows[0]?.isDefault === 1) return { code: 1, msg: "默认前缀不可删除，可禁用", data: null } as any;
      await (await db()).execute("delete from t_discovery_prefix where id=$1", [id]);
      return { code: 0, msg: "ok", data: null } as unknown as DataResultType<void>;
    },
    seedDefaults: async () => {
      const defaults = ["SIE.", "SIE.WebApiHost", "SIE.ScheduleServer", "WebClient", "SpcMonitor"];
      for (const p of defaults) {
        await (await db()).execute(
          "INSERT OR IGNORE INTO t_discovery_prefix (prefix, enabled, is_default) VALUES ($1,1,1)", [p]
        );
      }
    },
  };
}

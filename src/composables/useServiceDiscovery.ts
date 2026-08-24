import { ref } from 'vue';
import { cmdInvoke } from '@/utils/command';
import { useDiscoveryPrefixDb } from '@/database/discoveryPrefix';

export function useServiceDiscovery() {
  const prefixes = ref<DiscoveryPrefix[]>([]);
  const scanning = ref(false);
  const results = ref<DiscoveryItem[]>([]);
  const error = ref<string | null>(null);

  const loadPrefixes = async () => {
    const db = useDiscoveryPrefixDb();
    await db.seedDefaults();
    const r = await db.getPrefixes();
    prefixes.value = (r.data || []).filter((p) => p.enabled === 1);
  };

  const scanLocal = async () => {
    scanning.value = true;
    error.value = null;
    results.value = [];
    try {
      const ps = prefixes.value.map((p) => p.prefix);
      const r = await cmdInvoke<DiscoveryItem[]>('discover_local_services', { prefixes: ps });
      if (r.code === 0) results.value = r.data || [];
      else error.value = r.msg;
    } catch (e: any) {
      error.value = e.message;
    } finally {
      scanning.value = false;
    }
    return results.value;
  };

  const scanRemote = async (server: { ip: string; account: string; pwd: string }) => {
    scanning.value = true;
    error.value = null;
    results.value = [];
    try {
      const ps = prefixes.value.map((p) => p.prefix);
      const [w, d] = await Promise.all([
        cmdInvoke<DiscoveryItem[]>('discover_remote_windows_services', {
          username: server.account,
          password: server.pwd,
          server: server.ip,
          prefixes: ps,
        }),
        cmdInvoke<DiscoveryItem[]>('discover_remote_docker_containers', {
          username: server.account,
          password: server.pwd,
          server: server.ip,
          prefixes: ps,
        }),
      ]);
      const merged: DiscoveryItem[] = [];
      if (w.code === 0 && Array.isArray(w.data)) merged.push(...w.data);
      if (d.code === 0 && Array.isArray(d.data)) merged.push(...d.data);
      if (w.code !== 0 && d.code !== 0) error.value = w.msg || d.msg;
      else if (merged.length === 0) error.value = null; // 零匹配由 UI 引导改前缀
      results.value = merged;
    } catch (e: any) {
      error.value = e?.message ?? String(e);
    } finally {
      scanning.value = false;
    }
    return results.value;
  };

  return { prefixes, scanning, results, error, loadPrefixes, scanLocal, scanRemote };
}

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

  /**
   * 扫描单台远端服务器,返回结果与错误,不写共享状态
   * 供多选多台逐台扫描(每台一份结果)使用
   */
  const scanRemoteOne = async (server: {
    ip: string;
    account: string;
    pwd: string;
  }): Promise<{ items: DiscoveryItem[]; error: string | null }> => {
    const ps = prefixes.value.map((p) => p.prefix);
    try {
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
      const items: DiscoveryItem[] = [];
      if (w.code === 0 && Array.isArray(w.data)) items.push(...w.data);
      if (d.code === 0 && Array.isArray(d.data)) items.push(...d.data);
      // 两侧都失败才算扫描失败;单侧失败(如无 Docker)不影响结果
      const error = w.code !== 0 && d.code !== 0 ? w.msg || d.msg : null;
      return { items, error };
    } catch (e: any) {
      return { items: [], error: e?.message ?? String(e) };
    }
  };

  const scanRemote = async (server: { ip: string; account: string; pwd: string }) => {
    scanning.value = true;
    error.value = null;
    results.value = [];
    try {
      const r = await scanRemoteOne(server);
      results.value = r.items;
      // 零匹配由 UI 引导改前缀,不算错误
      error.value = r.error;
    } finally {
      scanning.value = false;
    }
    return results.value;
  };

  return { prefixes, scanning, results, error, loadPrefixes, scanLocal, scanRemote, scanRemoteOne };
}

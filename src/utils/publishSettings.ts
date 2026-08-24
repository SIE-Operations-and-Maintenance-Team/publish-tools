import { useSettingsDb } from '@/database/settings/index';

const _default: RowSettingsType = {
    id: 1,
    oneClickPublishEnabled: 0,
    winServiceRetryCount: 3,
    winServiceRetryInterval: 2,
    winCopyRetryCount: 3,
    winCopyRetryInterval: 2,
    sshMcpUrl: 'http://127.0.0.1:61823',
    sshMcpAutoSync: 0,
    updateTime: '',
};

export function defaultSettings(): RowSettingsType {
    return { ..._default };
}

let cached: RowSettingsType | null = null;

/**
 * 查 DB 并刷新模块级缓存。
 * 设置页保存后经 mittBus 'settingsChanged' 触发重载；发布/还原流程入口也会调用。
 */
export async function loadPublishSettings(): Promise<RowSettingsType> {
    const r = await useSettingsDb().getSettings();
    cached = r.code === 0 && r.data ? r.data : defaultSettings();
    return cached;
}

/**
 * 同步读缓存的重试参数。调用前应已 await loadPublishSettings()。
 * group='service' → Windows 服务启动/关闭命令；group='copy' → copy_path。
 *
 * 键名必须是 camelCase：Tauri command 参数按 camelCase 键取值（Rust 端 retry_count → 前端 retryCount），
 * 传 snake_case 键时 Option 参数会静默取 None（不报错），导致重试设置失效、恒走默认值。
 */
export function getRetryArgs(group: 'service' | 'copy'): {
    retryCount: number;
    retryIntervalSecs: number;
} {
    const s = cached ?? defaultSettings();
    return group === 'service'
        ? { retryCount: s.winServiceRetryCount, retryIntervalSecs: s.winServiceRetryInterval }
        : { retryCount: s.winCopyRetryCount, retryIntervalSecs: s.winCopyRetryInterval };
}

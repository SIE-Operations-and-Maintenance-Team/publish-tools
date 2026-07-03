import { useSettingsDb } from '@/database/settings/index';

const _default: RowSettingsType = {
    id: 1,
    oneClickPublishEnabled: 0,
    winServiceStopRetryCount: 3,
    winServiceStopRetryInterval: 2,
    winCopyRetryCount: 3,
    winCopyRetryInterval: 2,
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
 * group='serviceStop' → 服务关闭/启动命令；group='copy' → copy_path。
 */
export function getRetryArgs(group: 'serviceStop' | 'copy'): {
    retry_count: number;
    retry_interval_secs: number;
} {
    const s = cached ?? defaultSettings();
    return group === 'serviceStop'
        ? { retry_count: s.winServiceStopRetryCount, retry_interval_secs: s.winServiceStopRetryInterval }
        : { retry_count: s.winCopyRetryCount, retry_interval_secs: s.winCopyRetryInterval };
}

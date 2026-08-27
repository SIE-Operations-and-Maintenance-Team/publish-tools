/**
 * SSH MCP 配置同步（ssh-mcp-server ⇄ 发布工具）
 *
 * 模型：ssh-mcp-server 是服务器配置的唯一管理入口，发布工具本地 t_server 作为同步缓存。
 * 纳管判据：t_server.source_key（值 = SSH MCP 的「项目/环境/主机」平铺键）。
 *   - 有 source_key：已纳管，由远端下行同步覆盖（本地改名/改密会被覆盖）
 *   - 无 source_key：本地自建，可选上行迁移到 SSH MCP（首次迁移），上传成功后回写 source_key
 *
 * 接口（ssh-mcp-server 管理端，仅绑定 127.0.0.1、免鉴权）：
 *   - GET  {base}/admin/api/config/export → { projects, connections: { "项目/环境/主机": SSH配置 } }
 *   - POST {base}/admin/api/config/import → 按名合并导入，返回 { ok, addedHosts, warnings, ... }
 *
 * 注：与 import-export 模块一致，不使用显式事务（plugin-sql 底层 sqlx 连接池，
 * BEGIN/COMMIT 跨连接无法绑定同一连接），同步为幂等操作，中断后重跑即可自愈。
 */
import { fetch } from "@tauri-apps/plugin-http";
import { db } from "@/database/sqlite";

// 暂停命名规则校验：规则常量与上行校验逻辑一并注释保留，恢复时同步解开即可
// /** SSH MCP 项目/环境/主机名命名规则（字母数字_-中文，1-64 位，不含斜杠和空白） */
// const SSH_MCP_NAME_RE = /^[a-zA-Z0-9_\-一-龥]{1,64}$/;

/** 上行迁移目标环境名：发布工具服务器无环境维度，统一进「导入」环境后再在 SSH MCP 界面归类 */
const IMPORT_ENV_NAME = "导入";

/** 无项目归属的本地服务器上行时归入的项目名 */
const UNGROUPED_PROJECT_NAME = "未分组";

/** 同步跳过项 */
export interface SshMcpSyncSkip {
    name: string;
    reason: string;
}

/** 同步结果（供结果弹窗分类展示） */
export interface SshMcpSyncResult {
    ok: boolean;
    message: string; // ok=false 时的失败原因
    added: string[]; // 下行新增的本地服务器名
    updated: string[]; // 下行更新（含认领关联）的本地服务器名
    adopted: string[]; // 本地未纳管但与远端同机（ip/端口/账户一致）直接关联纳管的
    uploaded: string[]; // 上行迁移到 SSH MCP 的本地服务器名
    skipped: SshMcpSyncSkip[]; // 下行跳过（非密码认证等）
    uploadSkipped: SshMcpSyncSkip[]; // 上行跳过（名称不合法/远端已存在同名）
    conflicts: SshMcpSyncSkip[]; // 命名冲突无法消歧的
    orphans: string[]; // 远端已移除的纳管服务器（仅报告，不删本地）
    projectsCreated: string[]; // 本次下行新建的本地项目名
}

/** SSH MCP export 接口中单台主机的 SSH 配置（仅取本模块关心的字段） */
interface SshMcpHostConfig {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    privateKey?: string;
    agent?: string;
}

interface LocalServerRow {
    id: number;
    project_id: number | null;
    name: string;
    os: number;
    ip: string;
    port: number;
    account: string;
    pwd: string | null;
    source_key: string | null;
}

function emptyResult(): SshMcpSyncResult {
    return {
        ok: false,
        message: "",
        added: [],
        updated: [],
        adopted: [],
        uploaded: [],
        skipped: [],
        uploadSkipped: [],
        conflicts: [],
        orphans: [],
        projectsCreated: [],
    };
}

function normalizeBaseUrl(baseUrl: string): string {
    return (baseUrl || "http://127.0.0.1:61823").trim().replace(/\/+$/, "");
}

/** 解析平铺键「项目/环境/主机」（SSH MCP 名称规则保证不含斜杠） */
function parseFlatKey(flatKey: string): { project: string; environment: string; host: string } | null {
    const parts = flatKey.split("/");
    if (parts.length !== 3 || parts.some((p) => !p)) return null;
    return { project: parts[0], environment: parts[1], host: parts[2] };
}

/** 拉取 SSH MCP 完整导出配置（含明文凭据，仅本机回环传输） */
async function fetchSshMcpExport(baseUrl: string): Promise<{ connections: Record<string, SshMcpHostConfig> }> {
    const url = `${normalizeBaseUrl(baseUrl)}/admin/api/config/export`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
        const resp = await fetch(url, { method: "GET", signal: controller.signal });
        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
        }
        const data = await resp.json();
        if (!data || typeof data !== "object" || !data.connections || typeof data.connections !== "object") {
            throw new Error("返回数据缺少 connections 字段");
        }
        return data;
    } catch (e: any) {
        const reason = e?.name === "AbortError" ? "请求超时（8 秒）" : String(e?.message || e);
        throw new Error(
            `无法连接 SSH MCP 管理服务（${url}），${reason}。请确认 ssh-mcp-server 已以 --admin 模式启动，且端口与设置中的 API 地址一致。`
        );
    } finally {
        clearTimeout(timer);
    }
}

/** 查询未纳管（本地自建）服务器数量，供同步确认弹窗展示 */
export async function getUnmanagedServerCount(): Promise<number> {
    const rows = await (await db()).select<{ totalCount: number }[]>(
        "select COUNT(*) totalCount from t_server where source_key is null or source_key = ''"
    );
    return rows && rows.length > 0 ? Number(rows[0].totalCount || 0) : 0;
}

/** 确保本地存在同名 t_project，返回其 id（不存在则新建，不动 is_default 等已有字段） */
async function ensureProjectId(name: string, created: string[], database: Awaited<ReturnType<typeof db>>): Promise<number> {
    const found = await database.select<{ id: number }[]>("select id from t_project where name = $1", [name]);
    if (found && found.length > 0 && found[0].id) return found[0].id;
    const inserted = await database.execute(
        "INSERT INTO t_project (code, name) VALUES($1, $2) RETURNING id;",
        [name, name]
    );
    created.push(name);
    return inserted.lastInsertId ?? 0;
}

/**
 * 执行同步。
 * @param baseUrl SSH MCP 管理服务 API 地址（如 http://127.0.0.1:61823）
 * @param options.uploadUnmanaged 为 true 时，把本地未纳管服务器上行迁移到 SSH MCP（首次迁移用）
 */
export async function syncServersFromSshMcp(
    baseUrl: string,
    options: { uploadUnmanaged?: boolean } = {}
): Promise<SshMcpSyncResult> {
    const result = emptyResult();
    let exportData: { connections: Record<string, SshMcpHostConfig> };
    try {
        exportData = await fetchSshMcpExport(baseUrl);
    } catch (e: any) {
        result.message = String(e?.message || e);
        return result;
    }

    const database = await db();
    // 两阶段共用同一份本地快照：下行新建的行不会被误判为「未纳管」而再上行
    const localRows = await database.select<LocalServerRow[]>(
        "select id, project_id, name, os, ip, port, account, pwd, source_key from t_server"
    );
    const remoteConnections = exportData.connections || {};
    const remoteKeys = new Set(Object.keys(remoteConnections));

    // ============ 阶段一：下行（SSH MCP → 本地 t_server） ============
    const managedByKey = new Map<string, LocalServerRow>();
    const namesTaken = new Set<string>();
    for (const row of localRows) {
        if (row.source_key) managedByKey.set(row.source_key, row);
        namesTaken.add(row.name);
    }
    const unmanagedRows = localRows.filter((r) => !r.source_key);

    const descriptionOf = (env: string) => `环境: ${env} · SSH MCP 同步`;

    for (const [flatKey, cfg] of Object.entries(remoteConnections)) {
        const parsed = parseFlatKey(flatKey);
        if (!parsed) {
            result.skipped.push({ name: flatKey, reason: "平铺键格式不合法" });
            continue;
        }
        const { project, environment, host } = parsed;
        if (!cfg?.host || !cfg?.username) {
            result.skipped.push({ name: flatKey, reason: "缺少 host/username" });
            continue;
        }
        if (!cfg.password) {
            // 发布工具 SSH 仅密码认证，私钥/agent 主机只留在 SSH MCP 管理
            result.skipped.push({ name: flatKey, reason: "非密码认证（私钥/agent），发布工具暂不支持" });
            continue;
        }

        const projectId = await ensureProjectId(project, result.projectsCreated, database);
        const port = Number(cfg.port || 22);
        const existing = managedByKey.get(flatKey);

        if (existing) {
            // 已纳管：以远端为准更新（保留本地 id/os/name，发布配置的 serverIds 引用不受影响）
            await database.execute(
                "UPDATE t_server SET project_id = $1, ip = $2, port = $3, account = $4, pwd = $5, description = $6 WHERE id = $7",
                [projectId, cfg.host, port, cfg.username, cfg.password, descriptionOf(environment), existing.id]
            );
            result.updated.push(existing.name);
            continue;
        }

        // 未纳管：尝试命名并新增。名称被占用时优先「认领」同机（ip/端口/账户一致）的本地自建行
        // （防重：认领后立即写回 source_key，同一台机器在多个环境重复配置时不会被二次认领）
        const sameMachine = unmanagedRows.find(
            (r) => !r.source_key && r.ip === cfg.host && Number(r.port) === port && r.account === cfg.username
        );
        let targetName = host;
        if (sameMachine) {
            await database.execute(
                "UPDATE t_server SET project_id = $1, ip = $2, port = $3, account = $4, pwd = $5, description = $6, source_key = $7 WHERE id = $8",
                [projectId, cfg.host, port, cfg.username, cfg.password, descriptionOf(environment), flatKey, sameMachine.id]
            );
            result.adopted.push(sameMachine.name);
            sameMachine.source_key = flatKey; // 防止阶段二重复上传
            managedByKey.set(flatKey, sameMachine);
            namesTaken.add(sameMachine.name);
            continue;
        }
        if (namesTaken.has(targetName)) {
            targetName = `${environment}-${host}`;
            if (namesTaken.has(targetName)) {
                targetName = `${project}-${environment}-${host}`;
                if (namesTaken.has(targetName)) {
                    result.conflicts.push({ name: flatKey, reason: "与本地已有服务器重名，自动消歧后仍冲突" });
                    continue;
                }
            }
        }
        await database.execute(
            "INSERT INTO t_server (project_id, name, os, ip, port, account, pwd, description, source_key) VALUES($1, $2, 1, $3, $4, $5, $6, $7, $8)",
            [projectId, targetName, cfg.host, port, cfg.username, cfg.password, descriptionOf(environment), flatKey]
        );
        result.added.push(targetName);
        namesTaken.add(targetName);
    }

    // 远端已删除的纳管行：仅报告，不删本地（发布配置可能仍引用其 id）
    for (const row of managedByKey.values()) {
        if (row.source_key && !remoteKeys.has(row.source_key)) {
            result.orphans.push(row.name);
        }
    }

    // ============ 阶段二：上行（本地未纳管 → SSH MCP「导入」环境） ============
    if (options.uploadUnmanaged) {
        const projects = await database.select<{ id: number; name: string | null }[]>("select id, name from t_project");
        const projectNameById = new Map<number, string>();
        for (const p of projects) if (p.name) projectNameById.set(p.id, p.name);

        const payload: Record<string, { environments: Record<string, { hosts: Record<string, any> }> }> = {};
        const uploadTargets: { row: LocalServerRow; flatKey: string }[] = [];

        for (const row of localRows) {
            if (row.source_key) continue; // 仅上传未纳管行（含阶段一被认领的）
            const projectName = (row.project_id ? projectNameById.get(row.project_id) : null) || UNGROUPED_PROJECT_NAME;
            // if (!SSH_MCP_NAME_RE.test(projectName)) {
            //     result.uploadSkipped.push({
            //         name: row.name,
            //         reason: `所属项目名「${projectName}」不满足 SSH MCP 命名规则（仅字母数字_-中文）`,
            //     });
            //     continue;
            // }
            // if (!SSH_MCP_NAME_RE.test(row.name)) {
            //     result.uploadSkipped.push({
            //         name: row.name,
            //         reason: "服务器名不满足 SSH MCP 命名规则（仅字母数字_-中文，1-64 位）",
            //     });
            //     continue;
            // }
            const flatKey = `${projectName}/${IMPORT_ENV_NAME}/${row.name}`;
            if (remoteKeys.has(flatKey)) {
                // SSH MCP 已存在同名主机：跳过，绝不覆盖远端已有配置
                result.uploadSkipped.push({ name: row.name, reason: `SSH MCP 已存在 ${flatKey}，跳过避免覆盖` });
                continue;
            }
            if (!payload[projectName]) payload[projectName] = { environments: {} };
            if (!payload[projectName].environments[IMPORT_ENV_NAME]) {
                payload[projectName].environments[IMPORT_ENV_NAME] = { hosts: {} };
            }
            payload[projectName].environments[IMPORT_ENV_NAME].hosts[row.name] = {
                host: row.ip,
                port: Number(row.port || 22),
                username: row.account,
                password: row.pwd ?? "",
                transportMode: "exec",
            };
            uploadTargets.push({ row, flatKey });
        }

        if (uploadTargets.length > 0) {
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 8000);
                let respJson: any;
                try {
                    const resp = await fetch(`${normalizeBaseUrl(baseUrl)}/admin/api/config/import`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ projects: payload }),
                        signal: controller.signal,
                    });
                    respJson = await resp.json();
                } finally {
                    clearTimeout(timer);
                }
                if (!respJson?.ok) {
                    result.uploadSkipped.push({
                        name: "(批量上传)",
                        reason: `SSH MCP 导入接口返回失败: ${respJson?.message || "未知错误"}`,
                    });
                } else {
                    for (const w of respJson.warnings || []) {
                        result.uploadSkipped.push({ name: "(SSH MCP 端)", reason: String(w) });
                    }
                    // 上传成功：回写 source_key 完成纳管，此后该行由远端管理
                    for (const { row, flatKey } of uploadTargets) {
                        await database.execute("UPDATE t_server SET source_key = $1 WHERE id = $2", [flatKey, row.id]);
                        result.uploaded.push(row.name);
                    }
                }
            } catch (e: any) {
                const reason = e?.name === "AbortError" ? "请求超时" : String(e?.message || e);
                result.uploadSkipped.push({ name: "(批量上传)", reason: `上传到 SSH MCP 失败: ${reason}` });
            }
        }
    }

    result.ok = true;
    return result;
}

/** 启动时自动同步（仅下行，不上传），App.vue 静默调用 */
export async function autoSyncFromSshMcp(baseUrl: string): Promise<SshMcpSyncResult> {
    return syncServersFromSshMcp(baseUrl, { uploadUnmanaged: false });
}

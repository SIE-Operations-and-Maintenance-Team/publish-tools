// 发布前预检（Pre-flight Check）
//
// 目的：把「跑到哪错到哪」变成「发布前一次性体检」。检查项均为只读操作，
// 复用已有命令（exists / server_connection / execute_remote_command），
// 不修改任何配置与服务器状态。
import { cmdInvoke } from "@/utils/command";

// 预检项级别
export type PreflightLevel = "ok" | "warn" | "error";

// 单个预检项
export type PreflightItem = {
    // 唯一标识（服务类型或检查项名）
    id: string;
    // 检查项名称
    title: string;
    // 级别
    level: PreflightLevel;
    // 结果说明
    detail: string;
};

// 预检报告
export type PreflightReport = {
    items: PreflightItem[];
    errorCount: number;
    warnCount: number;
    passed: boolean;
    durationMs: number;
};

// 预检参数
export type PreflightOptions = {
    // 当前发布所用的应用配置
    appconfig: RowAppconfigType;
    // 按服务器ID解析服务器信息
    resolveServer: (serverId: number) => Promise<RowServerType | null>;
    // 是否检查远端服务是否存在（会产生一次远程命令，稍慢）
    checkRemoteService: boolean;
};

// 服务实例检查信息
type ServiceInstance = {
    key: string;
    serverId: number;
    identity: string;
};

// 已启用的服务及其配置问题
type EnabledService = {
    key: string;
    title: string;
    serverIds: number[];
    instances: ServiceInstance[];
    problem: string;
};

// 多服务器 + 多实例的服务清单
const MULTI_SERVER_SERVICES: {
    key: string;
    get: (configItems: ConfigItemsType) => {
        clientPath: string | null;
        serverArr: SelectServerType[];
    };
}[] = [
    { key: "WebApiHost", get: (items) => items.webApiHost },
    { key: "SpcMonitor", get: (items) => items.spcMonitor },
    { key: "WebClient", get: (items) => items.webClient },
];

/**
 * 执行发布前预检
 * @param options 预检参数
 * @returns 预检报告
 */
export async function runPreflight(options: PreflightOptions): Promise<PreflightReport> {
    const startedAt = Date.now();
    const { appconfig } = options;
    const configItems = appconfig.configItems;
    const items: PreflightItem[] = [];

    // 1. 配置完整性检查
    const enabledServices = collectServices(configItems);
    if (enabledServices.length === 0) {
        items.push({
            id: "config",
            title: "发布配置",
            level: "error",
            detail: "未配置任何要发布的服务，请先在应用配置中填写发布路径。",
        });
    }
    for (const service of enabledServices) {
        items.push({
            id: `config-${service.key}`,
            title: `${service.title} 配置`,
            level: service.problem ? "error" : "ok",
            detail: service.problem || "配置完整",
        });
    }

    // 2. MSBuild 路径检查
    const msBuildPath = (appconfig.msBuildPath ?? "").replace(/[\\/]+$/, "");
    if (!msBuildPath) {
        items.push({
            id: "msbuild",
            title: "MSBuild 路径",
            level: "error",
            detail: "MSBuild 路径为空，请先在应用配置中设置。",
        });
    } else {
        const existsResult = await cmdInvoke<boolean>("exists", { path: msBuildPath });
        items.push({
            id: "msbuild",
            title: "MSBuild 路径",
            level: existsResult.code === 0 ? "ok" : "error",
            detail:
                existsResult.code === 0 ? msBuildPath : `路径不存在：${msBuildPath}`,
        });
    }

    // 3. 发布前备份开关（未开启时提示无法一键回滚）
    items.push({
        id: "backup",
        title: "发布前备份",
        level: configItems.isBackup === 1 ? "ok" : "warn",
        detail:
            configItems.isBackup === 1
                ? "已开启发布前备份，支持一键回滚。"
                : "未开启发布前备份，发布失败后无法一键回滚。",
    });

    // 4. 服务器连通性检查（同一服务器只测一次）
    const serverIds = Array.from(
        new Set(enabledServices.flatMap((service) => service.serverIds))
    );
    const serverMap = new Map<number, RowServerType>();
    for (const serverId of serverIds) {
        const server = await options.resolveServer(serverId);
        if (server) serverMap.set(serverId, server);
    }

    await Promise.all(
        Array.from(serverMap.values()).map(async (server) => {
            const address = `${server.ip}:${server.port}`;
            const connectResult = await cmdInvoke<boolean>("server_connection", {
                username: server.account,
                password: server.pwd,
                server: address,
            });
            const serverName = server.name ?? address;
            items.push({
                id: `ssh-${server.id}`,
                title: `服务器连通性[${serverName}]`,
                level: connectResult.code === 0 ? "ok" : "error",
                detail:
                    connectResult.code === 0
                        ? address
                        : `连接 ${serverName} 失败：${String(connectResult.data)}`,
            });
        })
    );

    // 5. 远端服务存在性检查
    if (options.checkRemoteService) {
        const targets = enabledServices.flatMap((service) =>
            service.instances.map((instance) => ({ ...instance, serviceTitle: service.title }))
        );
        await Promise.all(
            targets.map(async (target) => {
                const server = serverMap.get(target.serverId);
                if (!server) return;
                const address = `${server.ip}:${server.port}`;
                const serverName = server.name ?? address;
                const command =
                    server.os === 2
                        ? `docker inspect "${target.identity}"`
                        : `sc query "${target.identity}"`;
                const result = await cmdInvoke<string>("execute_remote_command", {
                    username: server.account,
                    password: server.pwd,
                    server: address,
                    command,
                });
                const output = String(result.data ?? "");
                const exists =
                    result.code === 0 &&
                    (server.os === 2
                        ? !output.includes("No such object")
                        : output.includes("SERVICE_NAME"));
                items.push({
                    id: `service-${target.key}`,
                    title: `${target.serviceTitle} 服务[${target.identity}]（${serverName}）`,
                    level: exists ? "ok" : "warn",
                    detail: exists
                        ? "服务存在"
                        : "未检测到该服务，发布时将无法启停。",
                });
            })
        );
    }

    const errorCount = items.filter((item) => item.level === "error").length;
    const warnCount = items.filter((item) => item.level === "warn").length;
    return {
        items,
        errorCount,
        warnCount,
        passed: errorCount === 0,
        durationMs: Date.now() - startedAt,
    };
}

/**
 * 汇总当前配置下已启用的服务，并检查其配置完整性
 * @param configItems 应用配置项
 */
function collectServices(configItems: ConfigItemsType): EnabledService[] {
    const services: EnabledService[] = [];

    // 多服务器 + 多路径实例的服务
    for (const item of MULTI_SERVER_SERVICES) {
        const config = item.get(configItems);
        if (!config?.clientPath) continue;
        services.push(
            buildService(item.key, item.key, config.serverArr ?? [])
        );
    }

    // ScheduleServer：与其他服务同为多服务器结构
    const scheduleServer = configItems.scheduleServer;
    if (scheduleServer?.clientPath) {
        services.push(
            buildService("ScheduleServer", "ScheduleServer", scheduleServer.serverArr ?? [])
        );
    }

    // WpfClient：发布走客户端生成目录，不涉及服务启停，只检查服务器与路径配置
    const wpfClient = configItems.wpfClient;
    if (wpfClient?.clientPath) {
        const wpfServerArr = normalizeWpfServerArr(wpfClient);
        const wpfService = buildService("WpfClient", "WpfClient", wpfServerArr);
        // 客户端与服务端不同：没有「服务标识」，剔除标识相关的误报
        services.push({
            ...wpfService,
            problem: wpfService.problem
                .split("；")
                .filter((text) => text && !text.includes("服务标识"))
                .join("；"),
            instances: [],
        });
    }

    return services;
}

/**
 * 归一化 WpfClient 的服务器配置（兼容旧单服务器结构）
 * @param wpfClient WpfClient 配置
 */
function normalizeWpfServerArr(wpfClient: WpfClientConfigType): SelectServerType[] {
    if (wpfClient.serverArr && wpfClient.serverArr.length > 0) return wpfClient.serverArr;
    if (!wpfClient.serverId && !wpfClient.serverPath) return [];
    return [
        {
            id: wpfClient.serverId ?? null,
            name: wpfClient.serverName ?? null,
            serverPathArr: [
                {
                    label: "",
                    value: [{ identity: "", path: wpfClient.serverPath || "" }],
                },
            ],
        },
    ];
}

/**
 * 按服务器配置生成服务检查项
 * @param key 服务键
 * @param title 服务标题
 * @param serverArr 服务器配置
 */
function buildService(
    key: string,
    title: string,
    serverArr: SelectServerType[]
): EnabledService {
    const serverIds: number[] = [];
    const instances: ServiceInstance[] = [];
    const localProblems: string[] = [];

    if (serverArr.length < 1) localProblems.push("未选择发布服务器");
    for (const server of serverArr) {
        const serverName = server.name ?? "";
        if (!server.id) {
            localProblems.push("存在未选择服务器的配置项");
            continue;
        }
        serverIds.push(server.id);
        const pathArr = server.serverPathArr ?? [];
        const pathValues = pathArr.flatMap((p) => p.value ?? []);
        if (pathValues.length < 1) {
            localProblems.push(`服务器[${serverName}]未配置发布路径`);
        }
        for (const pathValue of pathValues) {
            const publishPath = pathValue.path;
            const identity = pathValue.identity;
            if (!publishPath) {
                localProblems.push(`服务器[${serverName}]存在发布路径为空的配置`);
                continue;
            }
            if (!identity) {
                localProblems.push(`服务器[${serverName}]存在服务标识为空的配置`);
                continue;
            }
            instances.push({
                key: `${key}|${server.id}|${identity}|${publishPath}`,
                serverId: server.id,
                identity,
            });
        }
    }

    return {
        key,
        title,
        serverIds,
        instances,
        problem: localProblems.join("；"),
    };
}

/**
 * 服务发现结果 → 应用配置 config_items 的映射与合并
 *
 * 工作台「服务器」步骤（StepServers）与服务器页「扫描本机/扫描远端」共用，
 * 保证服务名归类规则与合并语义只有一份。
 */

// 服务名 → 应用配置模块映射(按关键字包含匹配,顺序即优先级)
export const SERVICE_MODULE_RULES = [
  { key: "webApiHost", label: "WebApiHost", match: "webapihost" },
  { key: "scheduleServer", label: "调度(ScheduleServer)", match: "scheduleserver" },
  { key: "webClient", label: "WebClient", match: "webclient" },
  { key: "wpfClient", label: "WpfClient", match: "wpfclient" },
  { key: "spcMonitor", label: "SpcMonitor", match: "spcmonitor" },
] as const;

export type ServiceModuleKey = (typeof SERVICE_MODULE_RULES)[number]["key"];

/** 服务名匹配所属模块；无法识别时返回 null（不允许导入） */
export const matchModule = (
  serviceName: string
): { key: ServiceModuleKey; label: string } | null => {
  const n = (serviceName || "").toLowerCase();
  return SERVICE_MODULE_RULES.find((r) => n.includes(r.match)) || null;
};

/** 空白模块默认结构(与 CommonAppconfigType + serverIds/serverArr 对齐) */
export const emptyModule = () => ({
  clientPath: "",
  serverPath: "",
  serverIds: [] as number[],
  serverArr: [] as SelectServerType[],
});

/**
 * 完整的空白 config_items 骨架
 * 字段与取值对齐 appconfigDialog.vue 的初始 ruleForm.configItems：
 * 应用配置弹窗打开时会直接读取 wpfClient.generateDirJson 等字段，
 * 缺字段会导致「修改」弹窗报错，因此新建配置必须写入完整骨架。
 */
export const createEmptyConfigItems = (): Record<string, any> => ({
  webApiHost: emptyModule(),
  webClient: emptyModule(),
  wpfClient: {
    ...emptyModule(),
    serverId: null,
    serverName: null,
    isCompress: 1,
    generateDirJson: "",
    compressFileJson: "",
  },
  scheduleServer: emptyModule(),
  spcMonitor: emptyModule(),
  isRebuild: 1,
  isBackup: 0,
  isNewVersion: false,
  isPullLatest: 1,
  isPreflight: 1,
});

/**
 * 把发现的服务合并进一份 configItems:模块勾选目标服务器 + 该服务器下追加服务条目(服务标识+发布路径)
 * 返回实际新增的服务条数;同名服务标识已存在时跳过,不覆盖
 */
export const mergeServicesIntoConfigItems = (
  ci: Record<string, any>,
  targetId: number,
  targetName: string,
  picked: { item: DiscoveryItem; module: { key: ServiceModuleKey; label: string } }[]
): number => {
  let added = 0;
  for (const { item, module: m } of picked) {
    if (!ci[m.key]) ci[m.key] = emptyModule();
    const mod = ci[m.key];
    if (!Array.isArray(mod.serverIds)) mod.serverIds = [];
    if (!Array.isArray(mod.serverArr)) mod.serverArr = [];
    if (!mod.serverIds.includes(targetId)) mod.serverIds.push(targetId);
    let arr = mod.serverArr.find(
      (x: SelectServerType) => Number(x.id) === Number(targetId)
    );
    if (!arr) {
      arr = { id: targetId, name: targetName, serverPathArr: [] };
      mod.serverArr.push(arr);
    }
    if (!Array.isArray(arr.serverPathArr)) arr.serverPathArr = [];
    const exists = arr.serverPathArr.some((sp: ServerOptionType) =>
      (sp.value || []).some((v) => v.identity === item.serviceName)
    );
    if (exists) continue;
    arr.serverPathArr.push({
      label: "",
      value: [
        {
          identity: item.serviceName,
          path: item.suggestedPublishPath || item.rawPath || "",
        },
      ],
    });
    added++;
  }
  return added;
};

// 服务名末尾的环境标记 → 环境值(Dev=1/Uat=2/Pro=3/Other=4)
const ENV_TOKENS: Record<string, number> = {
  dev: 1,
  development: 1,
  test: 2,
  testing: 2,
  uat: 2,
  pro: 3,
  prod: 3,
  production: 3,
  online: 3,
  other: 4,
};

/**
 * 从服务名末尾推断所属环境(仅用于结果列表提示与默认勾选,不参与过滤)
 * 例：SIE.WebApiHost$_SMOM_WebApiHost_uat → 2
 */
export const inferServiceEnvironment = (serviceName: string): number | null => {
  const parts = (serviceName || "").toLowerCase().split(/[_.]/).filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last) return null;
  return ENV_TOKENS[last] ?? null;
};

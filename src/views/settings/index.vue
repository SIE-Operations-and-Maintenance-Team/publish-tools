<template>
  <div class="settings-container">
    <el-card shadow="never">
      <el-form ref="formRef" :model="form" label-width="180px" size="default" v-loading="loading">
        <!-- 开机自启 -->
        <el-divider content-position="left">{{ $t('message.settings.autoStart') }}</el-divider>
        <el-form-item :label="$t('message.settings.autoStart')">
          <el-switch v-model="autoStartEnabled" :loading="autoStartLoading" @change="onAutoStartChange" />
          <span class="settings-tip">{{ $t('message.settings.autoStartTip') }}</span>
        </el-form-item>

        <!-- 一键发布 -->
        <el-divider content-position="left">{{ $t('message.settings.oneClickPublish') }}</el-divider>
        <el-form-item :label="$t('message.settings.oneClickPublish')">
          <el-switch v-model="form.oneClickPublishEnabled" :active-value="1" :inactive-value="0" />
          <span class="settings-tip">{{ $t('message.settings.oneClickPublishTip') }}</span>
        </el-form-item>

        <!-- 服务关闭重试 -->
        <el-divider content-position="left">{{ $t('message.settings.winServiceStopRetry') }}</el-divider>
        <el-form-item :label="$t('message.settings.retryCount')">
          <el-input-number v-model="form.winServiceStopRetryCount" :min="1" :max="99" :step="1" />
        </el-form-item>
        <el-form-item :label="$t('message.settings.retryInterval')">
          <el-input-number v-model="form.winServiceStopRetryInterval" :min="1" :max="60" :step="1" />
        </el-form-item>

        <!-- 复制重试 -->
        <el-divider content-position="left">{{ $t('message.settings.winCopyRetry') }}</el-divider>
        <el-form-item :label="$t('message.settings.retryCount')">
          <el-input-number v-model="form.winCopyRetryCount" :min="1" :max="99" :step="1" />
        </el-form-item>
        <el-form-item :label="$t('message.settings.retryInterval')">
          <el-input-number v-model="form.winCopyRetryInterval" :min="1" :max="60" :step="1" />
        </el-form-item>

        <!-- MCP 服务配置 -->
        <el-divider content-position="left">{{ $t('message.settings.mcp') }}</el-divider>
        <el-form-item :label="$t('message.settings.mcpEnabled')">
          <el-switch v-model="mcpConfig.mcp_enabled" @change="onMcpEnabledChange" />
          <span class="settings-tip">{{ $t('message.settings.mcpEnabledTip') }}</span>
        </el-form-item>
        <el-form-item :label="$t('message.settings.mcpPort')">
          <el-input-number v-model="mcpConfig.mcp_port" :min="1024" :max="65535" :step="1" :disabled="mcpConfig.mcp_enabled" />
        </el-form-item>
        <el-form-item :label="$t('message.settings.mcpStatus')">
          <el-tag :type="mcpStatusTagType">{{ $t(mcpStatusI18nKey) }}</el-tag>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="saving" @click="onSave">{{ $t('message.settings.save') }}</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts" name="settings">
import { reactive, ref, onMounted, onUnmounted, computed } from "vue";
import { ElMessage, type FormInstance } from "element-plus";
import { useSettingsDb } from "@/database/settings/index";
import { defaultSettings } from "@/utils/publishSettings";
import { cmdInvoke } from "@/utils/command";
import mittBus from "@/utils/mitt";
import { listen } from "@tauri-apps/api/event";

const settingsDb = useSettingsDb();
const formRef = ref<FormInstance>();
const loading = ref(false);
const saving = ref(false);

const form = reactive<RowSettingsType>(defaultSettings());

// 开机自启（状态以注册表为唯一真实源，切换立即生效，不落库）
const autoStartEnabled = ref(false);
const autoStartLoading = ref(false);

// MCP 配置
const mcpConfig = reactive({
  mcp_enabled: true,
  mcp_port: 17541,
});
const mcpStatus = ref<string>("unknown");
// 保存前的 MCP 配置快照（用于判断配置是否实际变化）
let mcpConfigSnapshot = { mcp_enabled: true, mcp_port: 17541 };
// 轮询计时器（加载/启用时轮询真实状态，避免依赖事件时序）
let mcpStatusTimer: number | null = null;
// 轮询代次令牌：stopMcpStatusPolling()/新轮询会递增，作废飞行中的旧轮询请求
let mcpPollToken = 0;

let unlisten: (() => void) | null = null;

// 监听 MCP 状态事件
onMounted(async () => {
  load();
  try {
    unlisten = await listen<{ status: string; message?: string; port?: number }>("mcp-status", (event) => {
      mcpStatus.value = event.payload.status;
      stopMcpStatusPolling();
    });
  } catch (e) {
    console.warn("监听 mcp-status 事件失败:", e);
  }
});

onUnmounted(() => {
  if (unlisten) unlisten();
  stopMcpStatusPolling();
});

// 轮询真实状态，直到获得确定状态（ok/error/disabled/stopped）或超时
const pollMcpStatus = async (timeoutMs: number = 8000) => {
  // 先作废旧轮询（令牌 + 计时器），再取本轮令牌
  stopMcpStatusPolling();
  const startedAt = Date.now();
  const token = mcpPollToken;
  mcpStatus.value = "starting";
  const tick = async () => {
    if (token !== mcpPollToken) return; // 已被停止/新轮询取代，作废
    const statusR = await cmdInvoke<string>("get_mcp_status");
    if (token !== mcpPollToken) return; // 请求期间被取代，丢弃结果
    const status = statusR.code === 0 && statusR.data ? statusR.data : "unknown";
    if (status !== "unknown") {
      mcpStatus.value = status;
      stopMcpStatusPolling();
      return;
    }
    if (Date.now() - startedAt >= timeoutMs) {
      // 超时仍未获得真实状态：按配置回退，避免无限等待
      mcpStatus.value = mcpConfig.mcp_enabled ? "starting" : "disabled";
      stopMcpStatusPolling();
      return;
    }
    mcpStatusTimer = window.setTimeout(tick, 500);
  };
  mcpStatusTimer = window.setTimeout(tick, 0);
};

const stopMcpStatusPolling = () => {
  mcpPollToken++;
  if (mcpStatusTimer !== null) {
    clearTimeout(mcpStatusTimer);
    mcpStatusTimer = null;
  }
};

const mcpStatusTagType = computed(() => {
  switch (mcpStatus.value) {
    case "ok": return "success";
    case "error": return "danger";
    case "disabled": return "info";
    case "stopped": return "warning";
    case "starting": return "warning";
    default: return "info";
  }
});

const mcpStatusI18nKey = computed(() => {
  const key = mcpStatus.value;
  if (key === "ok") return "message.settings.mcpStatusOk";
  if (key === "error") return "message.settings.mcpStatusError";
  if (key === "disabled") return "message.settings.mcpStatusDisabled";
  if (key === "stopped") return "message.settings.mcpStatusStopped";
  if (key === "starting") return "message.settings.mcpStatusStarting";
  return "message.settings.mcpStatusDisabled";
});

const validate = (): boolean => {
  if (form.winServiceStopRetryCount < 1 || form.winServiceStopRetryCount > 99) {
    ElMessage.warning('重试次数需在 1-99 之间，间隔需在 1-60 之间');
    return false;
  }
  if (form.winServiceStopRetryInterval < 1 || form.winServiceStopRetryInterval > 60) return false;
  if (form.winCopyRetryCount < 1 || form.winCopyRetryCount > 99) return false;
  if (form.winCopyRetryInterval < 1 || form.winCopyRetryInterval > 60) return false;
  return true;
};

// 开机自启开关：立即写注册表，失败回滚开关状态
const onAutoStartChange = async (val: boolean) => {
  autoStartLoading.value = true;
  try {
    const r = await cmdInvoke<boolean>("set_auto_start", { enabled: val });
    if (r.code === 0) {
      autoStartEnabled.value = val;
      ElMessage.success(val ? '开机自启已开启' : '开机自启已关闭');
    } else {
      autoStartEnabled.value = !val;
      ElMessage.error('开机自启设置失败: ' + r.msg);
    }
  } catch (e) {
    autoStartEnabled.value = !val;
    ElMessage.error('开机自启设置失败: ' + e);
  } finally {
    autoStartLoading.value = false;
  }
};

const onMcpEnabledChange = async (val: boolean) => {
  // 立即保存并生效，不等保存按钮
  try {
    const r = await cmdInvoke<{ mcp_enabled: boolean; mcp_port: number }>("update_mcp_config", {
      mcpEnabled: val,
      mcpPort: mcpConfig.mcp_port,
    });
    if (r.code === 0 && r.data) {
      mcpConfig.mcp_enabled = r.data.mcp_enabled;
      mcpConfig.mcp_port = r.data.mcp_port;
      mcpConfigSnapshot = { ...mcpConfig };
      // 服务启停由 Rust 端异步执行，先同步占位状态，再轮询真实状态
      mcpStatus.value = val ? "starting" : "disabled";
      if (val) pollMcpStatus();
    } else {
      // 回滚开关状态
      mcpConfig.mcp_enabled = !val;
      ElMessage.error('MCP 启用状态保存失败: ' + r.msg);
    }
  } catch (e) {
    mcpConfig.mcp_enabled = !val;
    ElMessage.error('MCP 启用状态保存失败: ' + e);
  }
};

const onSave = async () => {
  if (!validate()) {
    ElMessage.warning('重试次数需在 1-99 之间，间隔需在 1-60 之间');
    return;
  }
  saving.value = true;
  const r = await settingsDb.saveSettings(form);
  if (r.code === 0) {
    // 保存 MCP 配置（端口变更时重启服务使新端口生效）
    const mcpR = await cmdInvoke<{ mcp_enabled: boolean; mcp_port: number }>("update_mcp_config", {
      mcpEnabled: mcpConfig.mcp_enabled,
      mcpPort: mcpConfig.mcp_port,
    });
    if (mcpR.code === 0 && mcpR.data) {
      const mcpChanged =
        mcpR.data.mcp_enabled !== mcpConfigSnapshot.mcp_enabled ||
        mcpR.data.mcp_port !== mcpConfigSnapshot.mcp_port;
      mcpConfig.mcp_enabled = mcpR.data.mcp_enabled;
      mcpConfig.mcp_port = mcpR.data.mcp_port;
      mcpConfigSnapshot = { ...mcpConfig };
      if (mcpChanged) {
        // 配置实际变化：服务启停/重启由 Rust 端异步执行，先同步占位状态，再轮询真实状态
        mcpStatus.value = mcpConfig.mcp_enabled ? "starting" : "disabled";
        if (mcpConfig.mcp_enabled) pollMcpStatus();
      }
      ElMessage.success('设置保存成功');
      mittBus.emit('settingsChanged');
    } else {
      ElMessage.warning('设置保存成功，但 MCP 配置保存失败: ' + mcpR.msg);
    }
  } else {
    ElMessage.error(r.msg || '设置保存失败');
  }
  saving.value = false;
};

const load = async () => {
  loading.value = true;
  // 加载业务设置
  const r = await settingsDb.getSettings();
  if (r.code === 0 && r.data) Object.assign(form, r.data);
  // 加载开机自启状态（以注册表实际状态回显，与系统保持一致）
  const autoR = await cmdInvoke<boolean>("get_auto_start");
  if (autoR.code === 0) autoStartEnabled.value = !!autoR.data;
  // 加载 MCP 配置
  const mcpR = await cmdInvoke<{ mcp_enabled: boolean; mcp_port: number }>("get_mcp_config");
  if (mcpR.code === 0 && mcpR.data) {
    mcpConfig.mcp_enabled = mcpR.data.mcp_enabled;
    mcpConfig.mcp_port = mcpR.data.mcp_port;
    mcpConfigSnapshot = { ...mcpConfig };
  }
  // 加载 MCP 运行状态（mcp-status 事件在启动时已发射，页面挂载后可能收不到）
  // 轮询真实状态；若为 unknown（服务仍在启动）则显示"启动中"并在超时后按配置回退
  await pollMcpStatus();
  loading.value = false;
};
</script>

<style scoped lang="scss">
.settings-container {
  padding: 15px;
  .settings-tip {
    margin-left: 10px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
}
</style>
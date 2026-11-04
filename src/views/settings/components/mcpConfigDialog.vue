<template>
  <el-dialog
    v-model="visible"
    :title="$t('message.settings.mcpConfigTitle')"
    width="620px"
    draggable
    :close-on-click-modal="false"
  >
    <div class="config-tip">{{ $t('message.settings.mcpConfigTip') }}</div>
    <pre class="config-content">{{ configJson }}</pre>
    <template #footer>
      <el-button @click="visible = false">{{ $t('message.settings.mcpConfigClose') }}</el-button>
      <el-button type="primary" @click="onCopy">{{ $t('message.settings.mcpConfigCopyBtn') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts" name="mcpConfigDialog">
import { computed, ref } from "vue";
import commonFunction from "@/utils/commonFunction";

// MCP Server 为 Streamable HTTP 传输，接入 agent 时使用 url 形式
const MCP_SERVER_NAME = "smom-publish";
const DEFAULT_MCP_PORT = 17541;

const visible = ref(false);
const port = ref(DEFAULT_MCP_PORT);
const { copyText } = commonFunction();

const configJson = computed(() =>
  JSON.stringify(
    {
      mcpServers: {
        [MCP_SERVER_NAME]: {
          type: "http",
          url: `http://127.0.0.1:${port.value}/mcp`,
        },
      },
    },
    null,
    2
  )
);

// 打开弹窗时以设置中的当前端口生成配置，避免与实际监听端口不一致
const open = (currentPort: number) => {
  port.value = Number(currentPort) || DEFAULT_MCP_PORT;
  visible.value = true;
};

const onCopy = async () => {
  try {
    await copyText(configJson.value);
  } catch {
    // 失败提示已由 copyText 内部弹出，此处仅消化拒绝，避免未处理异常
  }
};

defineExpose({ open });
</script>

<style scoped lang="scss">
.config-tip {
  margin-bottom: 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.config-content {
  margin: 0;
  padding: 12px;
  max-height: 320px;
  overflow: auto;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: "Courier New", Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-primary);
}
</style>

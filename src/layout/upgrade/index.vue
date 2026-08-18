<template>
  <div class="upgrade-dialog">
    <el-dialog
      v-model="state.isUpgrade"
      width="350px"
      destroy-on-close
      :show-close="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
    >
      <div class="upgrade-title">
        <div class="upgrade-title-warp">
          <span class="upgrade-title-warp-txt">{{ $t("message.upgrade.title") }}</span>
          <span class="upgrade-title-warp-version">v{{ props.version }}</span>
        </div>
      </div>
      <div class="upgrade-content">
        更新内容如下：<br />
        <div v-html="props.body"></div>
      </div>
      <div class="upgrade-btn">
        <el-button
          round
          size="default"
          type="info"
          :disabled="state.isLoading"
          text
          @click="onCancel"
          >{{ $t("message.upgrade.btnOne") }}</el-button
        >
        <el-button
          type="primary"
          round
          size="default"
          @click="onUpgrade"
          :loading="state.isLoading"
          >{{ state.btnTxt }}</el-button
        >
      </div>
      <div class="download-progress-box" v-show="state.isLoading">
        <el-progress
          :text-inside="true"
          :stroke-width="20"
          :percentage="currPercentage"
          status="success"
        />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="layoutUpgrade">
import { reactive, ref, defineProps, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { DownloadEvent } from "@tauri-apps/plugin-updater";

// 定义父组件传过来的值
const props = defineProps({
  version: {
    type: String,
    default: () => "",
  },
  date: {
    type: String,
    default: () => "",
  },
  body: {
    type: String,
    default: () => "",
  },
});
const emit = defineEmits(["confirm-updater", "download-finished"]);

// 定义变量内容
const { t } = useI18n();
let downloaded = ref(0);
let contentLength = ref(0);
const state = reactive({
  isUpgrade: false,
  isLoading: false,
  btnTxt: "",
});

// 稍后更新
const onCancel = () => {
  state.isUpgrade = false;
};

// 马上更新
const onUpgrade = async () => {
  state.isLoading = true;
  state.btnTxt = `更新中`;
  downloaded.value = 0;
  contentLength.value = 0;
  emit("confirm-updater", state.isLoading);
};

// 监听下载事件
const downloadEvent = async (event: DownloadEvent) => {
  switch (event.event) {
    case "Started":
      if (event.data.contentLength) contentLength.value = event.data.contentLength;
      break;
    case "Progress":
      downloaded.value += event.data.chunkLength;
      break;
    case "Finished":
      emit("download-finished");
      state.isLoading = false;
      state.btnTxt = t("message.upgrade.btnTwo");
      break;
  }
};

// 当前进度
const currPercentage = computed(() => {
  let percentage = 0;
  if (contentLength.value > 0) {
    percentage = (downloaded.value / contentLength.value) * 100;
  }
  return percentage.toFixed(2);
});

// 暴露变量
defineExpose({
  downloadEvent,
});

// 延迟显示，防止刷新时界面显示太快
const delayShow = () => {
  setTimeout(() => {
    state.isUpgrade = true;
  }, 2000);
};

// 页面加载完时
onMounted(() => {
  delayShow();
  setTimeout(() => {
    state.btnTxt = t("message.upgrade.btnTwo");
  }, 200);
});
</script>

<style scoped lang="scss">
.upgrade-dialog {
  :deep(.el-dialog) {
    .el-dialog__body {
      padding: 0 !important;
    }
    .el-dialog__header {
      display: none !important;
    }
    .upgrade-title {
      text-align: center;
      height: 130px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      &::after {
        content: "";
        position: absolute;
        background-color: var(--el-color-primary-light-1);
        width: 130%;
        height: 130px;
        border-bottom-left-radius: 100%;
        border-bottom-right-radius: 100%;
      }
      .upgrade-title-warp {
        z-index: 1;
        position: relative;
        .upgrade-title-warp-txt {
          color: var(--next-color-white);
          font-size: 22px;
          letter-spacing: 3px;
        }
        .upgrade-title-warp-version {
          color: var(--next-color-white);
          background-color: var(--el-color-primary-light-4);
          font-size: 12px;
          position: absolute;
          display: flex;
          top: -2px;
          right: -50px;
          padding: 2px 4px;
          border-radius: 2px;
        }
      }
    }
    .upgrade-content {
      padding: 20px;
      line-height: 22px;
      max-height: 320px;
      overflow-y: auto;
      word-break: break-word;
      .upgrade-content-desc {
        color: var(--el-color-info-light-5);
        font-size: 12px;
      }
    }
    .upgrade-btn {
      border-top: 1px solid var(--el-border-color-lighter, #ebeef5);
      display: flex;
      justify-content: space-around;
      padding: 15px 20px;
      .el-button {
        width: 100%;
      }
    }
    .download-progress-box {
      text-align: center;
    }
  }
}
</style>

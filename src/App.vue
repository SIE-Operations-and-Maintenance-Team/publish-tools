<template>
  <el-config-provider :size="getGlobalComponentSize" :locale="getGlobalI18n">
    <router-view v-show="setLockScreen" />
    <lock-screen v-if="themeConfig.isLockScreen" />
    <setings ref="setingsRef" v-show="setLockScreen" />
    <close-full v-if="!themeConfig.isLockScreen" />
    <upgrade
      v-if="getVersion"
      ref="layoutUpgradeRef"
      :date="smomUpdate?.date"
      :version="smomUpdate?.version"
      :body="upgradeBody"
      @confirm-updater="onConfirmUpdater"
      @download-finished="onDownloadFinished"
    />
    <!-- <Sponsors /> -->
  </el-config-provider>
</template>

<script setup lang="ts" name="app">
import {
  defineAsyncComponent,
  computed,
  ref,
  onBeforeMount,
  onMounted,
  onUnmounted,
  nextTick,
  watch,
} from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useTagsViewRoutes } from "@/stores/tagsViewRoutes";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { useThemeConfig } from "@/stores/themeConfig";
import other from "@/utils/other";
import { Local, Session } from "@/utils/storage";
import mittBus from "@/utils/mitt";
import setIntroduction from "@/utils/setIconfont";
import { fetchGithubReleaseNotes } from "@/utils/githubRelease";
import { loadPublishSettings } from "@/utils/publishSettings";
import { autoSyncFromSshMcp } from "@/database/servers/sshMcpSync";
import { ElMessage } from "element-plus";

// 引入组件
const LockScreen = defineAsyncComponent(() => import("@/layout/lockScreen/index.vue"));
const Setings = defineAsyncComponent(() => import("@/layout/navBars/topBar/setings.vue"));
const CloseFull = defineAsyncComponent(
  () => import("@/layout/navBars/topBar/closeFull.vue")
);
const Upgrade = defineAsyncComponent(() => import("@/layout/upgrade/index.vue"));
// const Sponsors = defineAsyncComponent(() => import('@/layout/sponsors/index.vue'));

// 定义变量内容
let smomUpdate: Update | null = null;
const getVersion = ref(false);
// 升级弹窗展示内容：先用 update.json notes 兜底，拉到 GitHub Release 说明后替换
const upgradeBody = ref("");
const layoutUpgradeRef = ref();
const { messages, locale } = useI18n();
const setingsRef = ref();
const route = useRoute();
const stores = useTagsViewRoutes();
const storesThemeConfig = useThemeConfig();
const { themeConfig } = storeToRefs(storesThemeConfig);

// 设置锁屏时组件显示隐藏
const setLockScreen = computed(() => {
  // 防止锁屏后，刷新出现不相关界面
  return themeConfig.value.isLockScreen
    ? themeConfig.value.lockScreenTime > 1
    : themeConfig.value.lockScreenTime >= 0;
});

// 获取全局组件大小
const getGlobalComponentSize = computed(() => {
  return other.globalComponentSize();
});
// 获取全局 i18n
const getGlobalI18n = computed(() => {
  return messages.value[locale.value];
});

// 设置初始化，防止刷新时恢复默认
onBeforeMount(async () => {
  // 设置批量第三方 icon 图标
  setIntroduction.cssCdn();

  // 设置批量第三方 js
  setIntroduction.jsCdn();

  // 获取版本号
  smomUpdate = await check();
  if (smomUpdate) {
    upgradeBody.value = smomUpdate.body ?? "";
    getVersion.value = true;
    // 异步拉取当前版本 GitHub Release 说明替换弹窗内容；失败（限流/Release 未建/断网）保持 update.json notes
    const version = smomUpdate.version;
    fetchGithubReleaseNotes(version).then((notes) => {
      // 仅当仍是同一次更新时再替换，防止竞态覆盖
      if (notes && smomUpdate?.version === version) upgradeBody.value = notes;
    });
  }
});

// 确认更新
const onConfirmUpdater = async (isUpdater: boolean) => {
  if (!isUpdater || !smomUpdate) return;
  await smomUpdate.downloadAndInstall((event) => {
    layoutUpgradeRef.value.downloadEvent(event);
  });
};

// 下载完成
const onDownloadFinished = () => {
  ElMessage.success({
    duration: 5 * 1000,
    message: "更新成功，正在重启！",
    onClose: async () => {
      await relaunch();
    },
  });
};

// 页面加载完时
onMounted(() => {
  nextTick(() => {
    // 初始化窗口标题（启动时 route watch 尚未触发，标题默认不含版本号）
    other.useTitle();
    // 监听布局配'置弹窗点击打开
    mittBus.on("openSetingsDrawer", () => {
      setingsRef.value.openDrawer();
    });
    // 获取缓存中的布局配置
    if (Local.get("themeConfig")) {
      storesThemeConfig.setThemeConfig({ themeConfig: Local.get("themeConfig") });
      document.documentElement.style.cssText = Local.get("themeConfigStyle");
    }
    // 获取缓存中的全屏配置
    if (Session.get("isTagsViewCurrenFull")) {
      stores.setCurrenFullscreen(Session.get("isTagsViewCurrenFull"));
    }

    // SSH MCP 启动自动同步（仅下行、不上传）：延迟 3 秒避开启动期数据库/窗口初始化，失败静默不影响使用
    window.setTimeout(async () => {
      try {
        const settings = await loadPublishSettings();
        if (settings.sshMcpAutoSync !== 1) return;
        const result = await autoSyncFromSshMcp(settings.sshMcpUrl);
        if (!result.ok) {
          console.warn("SSH MCP 自动同步失败:", result.message);
          ElMessage.warning(`SSH MCP 自动同步失败：${result.message}`);
        }
      } catch (e) {
        console.warn("SSH MCP 自动同步失败:", e);
      }
    }, 3000);
  });
});
// 页面销毁时，关闭监听布局配置/i18n监听
onUnmounted(() => {
  mittBus.off("openSetingsDrawer", () => {});
});
// 监听路由的变化，设置网站标题
watch(
  () => route.path,
  () => {
    other.useTitle();
  },
  {
    deep: true,
  }
);
</script>

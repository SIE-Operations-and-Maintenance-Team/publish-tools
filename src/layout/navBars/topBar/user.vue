<template>
  <div class="layout-navbars-breadcrumb-user pr15" :style="{ flex: layoutUserFlexNum }">
    <el-dropdown
      :show-timeout="70"
      :hide-timeout="50"
      trigger="click"
      @command="onComponentSizeChange"
    >
      <div class="layout-navbars-breadcrumb-user-icon">
        <i
          class="smom-icon smom-icon-zujiandaxiao"
          :title="$t('message.user.title0')"
        ></i>
      </div>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="large" :disabled="state.disabledSize === 'large'">{{
            $t("message.user.dropdownLarge")
          }}</el-dropdown-item>
          <el-dropdown-item
            command="default"
            :disabled="state.disabledSize === 'default'"
            >{{ $t("message.user.dropdownDefault") }}</el-dropdown-item
          >
          <el-dropdown-item command="small" :disabled="state.disabledSize === 'small'">{{
            $t("message.user.dropdownSmall")
          }}</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    <el-dropdown
      :show-timeout="70"
      :hide-timeout="50"
      trigger="click"
      @command="onLanguageChange"
    >
      <div class="layout-navbars-breadcrumb-user-icon">
        <i
          class="smom-icon"
          :class="
            state.disabledI18n === 'en'
              ? 'smom-icon-qiehuan-yingwen'
              : 'smom-icon-qiehuan-zhongwen'
          "
          :title="$t('message.user.title1')"
        ></i>
      </div>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="zh-cn" :disabled="state.disabledI18n === 'zh-cn'"
            >简体中文</el-dropdown-item
          >
          <el-dropdown-item command="en" :disabled="state.disabledI18n === 'en'"
            >English</el-dropdown-item
          >
          <el-dropdown-item command="zh-tw" :disabled="state.disabledI18n === 'zh-tw'"
            >繁體中文</el-dropdown-item
          >
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    <div class="layout-navbars-breadcrumb-user-icon" @click="onSearchClick">
      <el-icon :title="$t('message.user.title2')">
        <ele-Search />
      </el-icon>
    </div>
    <div class="layout-navbars-breadcrumb-user-icon" @click="onLayoutSetingClick">
      <i class="smom-icon-peizhi smom-icon" :title="$t('message.user.title3')"></i>
    </div>
    <div
      class="layout-navbars-breadcrumb-user-icon"
      title="打开smom数据库文件"
      @click="onOpenDatabase"
    >
      <svg-icon name="smom-icon smom-icon-database" />
    </div>
    <div
      class="layout-navbars-breadcrumb-user-icon"
      title="新手指引"
      @click="onOpenOnboarding"
    >
      <el-icon><QuestionFilled /></el-icon>
    </div>
    <div
      v-show="showScreenfull"
      class="layout-navbars-breadcrumb-user-icon"
      @click="onScreenfullClick"
    >
      <i
        class="smom-icon"
        :title="
          state.isScreenfull ? $t('message.user.title6') : $t('message.user.title5')
        "
        :class="
          !state.isScreenfull ? 'smom-icon-zhankaiquanping' : 'smom-icon-guanbiquanping'
        "
      ></i>
    </div>
    <el-dropdown
      class="ml10"
      :show-timeout="70"
      :hide-timeout="50"
      @command="onHandleCommandClick"
    >
      <span class="layout-navbars-breadcrumb-user-link user-name">
        <img
          src="/src/assets/logo.png"
          class="layout-navbars-breadcrumb-user-link-photo mr5"
        />
        SMOM
        <el-icon class="el-icon--right">
          <ele-ArrowDown />
        </el-icon>
      </span>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item divided command="repo">{{
            $t("message.user.dropdownRepo")
          }}</el-dropdown-item>
          <el-dropdown-item command="logOut">{{
            $t("message.user.dropdown5")
          }}</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    <Search ref="searchRef" />
  </div>
</template>

<script setup lang="ts" name="layoutBreadcrumbUser">
import { defineAsyncComponent, ref, computed, reactive, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { QuestionFilled } from "@element-plus/icons-vue";
// import { exit } from "@tauri-apps/api/process";
import { ElMessageBox, ElMessage } from "element-plus";
import screenfull from "screenfull";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useThemeConfig } from "@/stores/themeConfig";
import other from "@/utils/other";
import mittBus from "@/utils/mitt";
import { Local } from "@/utils/storage";
import { cmdInvoke } from "@/utils/command";
import { path } from "@tauri-apps/api";
import { openUrl } from "@tauri-apps/plugin-opener";

// 引入组件
const Search = defineAsyncComponent(() => import("@/layout/navBars/topBar/search.vue"));
const SvgIcon = defineAsyncComponent(() => import("@/components/svgIcon/index.vue"));

// 定义变量内容
const showScreenfull = ref(false);
const { locale, t } = useI18n();
const router = useRouter();
const route = useRoute();
const storesThemeConfig = useThemeConfig();
const { themeConfig } = storeToRefs(storesThemeConfig);
const searchRef = ref();
const state = reactive({
  isScreenfull: false,
  disabledI18n: "zh-cn",
  disabledSize: "large",
});

// 设置分割样式
const layoutUserFlexNum = computed(() => {
  let num: string | number = "";
  const { layout, isClassicSplitMenu } = themeConfig.value;
  const layoutArr: string[] = ["defaults", "columns"];
  if (layoutArr.includes(layout) || (layout === "classic" && !isClassicSplitMenu))
    num = "1";
  else num = "";
  return num;
});
// 全屏点击时
const onScreenfullClick = () => {
  if (!screenfull.isEnabled) {
    ElMessage.warning("暂不不支持全屏");
    return false;
  }
  screenfull.toggle();
  screenfull.on("change", () => {
    if (screenfull.isFullscreen) state.isScreenfull = true;
    else state.isScreenfull = false;
  });
};
// 打开数据库
const onOpenDatabase = async () => {
  let openPath = await path.appDataDir();
  cmdInvoke("open_dir", { path: openPath });
};
// 布局配置 icon 点击时
const onLayoutSetingClick = () => {
  mittBus.emit("openSetingsDrawer");
};
// 下拉菜单点击时
const onHandleCommandClick = (path: string) => {
  if (path === "repo") {
    // 打开项目地址（默认浏览器）
    openUrl("https://github.com/SIE-Operations-and-Maintenance-Team/publish-tools/").catch((e) => {
      ElMessage.error("打开项目地址失败：" + e);
    });
    return;
  }
  if (path === "logOut") {
    ElMessageBox({
      closeOnClickModal: false,
      closeOnPressEscape: false,
      title: t("message.user.logOutTitle"),
      message: t("message.user.logOutMessage"),
      showCancelButton: true,
      confirmButtonText: t("message.user.logOutConfirm"),
      cancelButtonText: t("message.user.logOutCancel"),
      buttonSize: "default",
      beforeClose: (action, instance, done) => {
        if (action === "confirm") {
          instance.confirmButtonLoading = true;
          instance.confirmButtonText = t("message.user.logOutExit");
          setTimeout(() => {
            done();
            setTimeout(() => {
              instance.confirmButtonLoading = false;
            }, 300);
          }, 700);
        } else {
          done();
        }
      },
    })
      .then(async () => {
        // Session.clear(); // 清除缓存、token等
        // await exit(1);
        await cmdInvoke("exit_app", {
          code: 0,
        });
      })
      .catch(() => {});
  } else {
    router.push(path);
  }
};
// 菜单搜索点击
const onSearchClick = () => {
  searchRef.value.openSearch();
};
// 新手指引点击
const onOpenOnboarding = () => {
  if (route.path !== "/workstation") {
    router.push("/workstation").then(() => {
      mittBus.emit("openOnboarding");
      // 兜底：工作台为 keep-alive，首启时监听可能晚于 emit，补一次延迟触发
      setTimeout(() => mittBus.emit("openOnboarding"), 120);
    });
    return;
  }
  mittBus.emit("openOnboarding");
};
// 组件大小改变
const onComponentSizeChange = (size: string) => {
  Local.remove("themeConfig");
  themeConfig.value.globalComponentSize = size;
  Local.set("themeConfig", themeConfig.value);
  initI18nOrSize("globalComponentSize", "disabledSize");
  window.location.reload();
};
// 语言切换
const onLanguageChange = (lang: string) => {
  Local.remove("themeConfig");
  themeConfig.value.globalI18n = lang;
  Local.set("themeConfig", themeConfig.value);
  locale.value = lang;
  other.useTitle();
  initI18nOrSize("globalI18n", "disabledI18n");
};
// 初始化组件大小/i18n
const initI18nOrSize = (value: string, attr: string) => {
  (<any>state)[attr] = Local.get("themeConfig")[value];
};
// 页面加载完时
onMounted(async () => {
  if (Local.get("themeConfig")) {
    initI18nOrSize("globalComponentSize", "disabledSize");
    initI18nOrSize("globalI18n", "disabledI18n");
  }
});
</script>

<style scoped lang="scss">
.layout-navbars-breadcrumb-user {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  &-link {
    height: 100%;
    display: flex;
    align-items: center;
    white-space: nowrap;
    &-photo {
      width: 25px;
      height: 25px;
      border-radius: 100%;
    }
  }
  &-icon {
    padding: 0 10px;
    cursor: pointer;
    color: var(--next-bg-topBarColor);
    height: 50px;
    line-height: 50px;
    display: flex;
    align-items: center;
    &:hover {
      background: var(--next-color-user-hover);
      i {
        display: inline-block;
        animation: logoAnimation 0.3s ease-in-out;
      }
    }
  }
  :deep(.el-dropdown) {
    color: var(--next-bg-topBarColor);
  }
  :deep(.el-badge) {
    height: 40px;
    line-height: 40px;
    display: flex;
    align-items: center;
  }
  :deep(.el-badge__content.is-fixed) {
    top: 12px;
  }
  .user-name {
    cursor: default;
  }
}

.code-link {
  text-decoration: none;
  font-size: 14px;
  color: var(--el-text-color-regular);
}
</style>

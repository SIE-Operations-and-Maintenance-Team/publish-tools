<template>
  <div class="settings-container">
    <el-card shadow="never">
      <el-form ref="formRef" :model="form" label-width="180px" size="default" v-loading="loading">
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

        <el-form-item>
          <el-button type="primary" :loading="saving" @click="onSave">{{ $t('message.settings.save') }}</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts" name="settings">
import { reactive, ref, onMounted } from "vue";
import { ElMessage, type FormInstance } from "element-plus";
import { useSettingsDb } from "@/database/settings/index";
import { defaultSettings } from "@/utils/publishSettings";
import mittBus from "@/utils/mitt";

const settingsDb = useSettingsDb();
const formRef = ref<FormInstance>();
const loading = ref(false);
const saving = ref(false);

const form = reactive<RowSettingsType>(defaultSettings());

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

const onSave = async () => {
  if (!validate()) {
    ElMessage.warning('重试次数需在 1-99 之间，间隔需在 1-60 之间');
    return;
  }
  saving.value = true;
  const r = await settingsDb.saveSettings(form);
  saving.value = false;
  if (r.code === 0) {
    ElMessage.success('设置保存成功');
    mittBus.emit('settingsChanged');
  } else {
    ElMessage.error(r.msg || '设置保存失败');
  }
};

const load = async () => {
  loading.value = true;
  const r = await settingsDb.getSettings();
  loading.value = false;
  if (r.code === 0 && r.data) Object.assign(form, r.data);
};

onMounted(load);
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

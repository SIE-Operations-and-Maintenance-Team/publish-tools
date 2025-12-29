<template>
  <div class="backup-container">
    <el-dialog
      :title="state.dialog.title"
      v-model="state.dialog.show"
      :close-on-click-modal="false"
      :show-close="false"
      modal-class="backup-dialog"
      draggable
      width="680px"
    >
      <el-form
        ref="backupDialogFormRef"
        size="default"
        label-width="90px"
        :model="state.ruleForm"
        :rules="formRules"
        :disabled="state.dialog.type == 'viewer'"
      >
        <el-row :gutter="10">
          <el-col :span="24" class="mb20">
            <el-form-item label="项目名称" prop="projectName">
              <el-input
                v-model="state.ruleForm.projectName"
                maxlength="50"
                :disabled="true"
              ></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="12" class="mb20">
            <el-form-item label="项目环境" prop="environment">
              <el-select
                v-model="state.ruleForm.environment"
                size="default"
                :disabled="true"
              >
                <el-option label="Dev" :value="1" />
                <el-option label="Uat" :value="2" />
                <el-option label="Pro" :value="3" />
                <el-option label="Other" :value="4" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12" class="mb20">
            <el-form-item label="备份时间">
              <el-input
                v-model="state.ruleForm.backupDate"
                maxlength="50"
                :disabled="true"
              ></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="8" class="mb15">
            <el-form-item label-width="90" label="获取dll方式" prop="dllMode">
              <el-input
                v-model="state.ruleForm.backupItems.dllMode"
                maxlength="50"
                :disabled="true"
              ></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="16" class="mb15">
            <el-form-item label-width="0" prop="dllModeValue">
              {{
                showDllMode(
                  state.ruleForm.backupItems.dllMode,
                  state.ruleForm.backupItems.dllModeValue
                )
              }}
            </el-form-item>
          </el-col>
          <el-col :span="24" class="mb20">
            <el-tabs type="border-card">
              <el-tab-pane label="WebApiHost">
                <el-text
                  type="info"
                  v-if="
                    !state.ruleForm.backupItems.webApiHost ||
                    state.ruleForm.backupItems.webApiHost.length < 1
                  "
                  >该服务未部署！</el-text
                >
                <fieldset
                  class="form-server-fieldset"
                  v-for="(webApiServer, apiIndex) in state.ruleForm.backupItems
                    .webApiHost"
                  :key="apiIndex"
                >
                  <legend class="form-server-legend">
                    {{ webApiServer.serverName }}
                  </legend>
                  <el-row>
                    <template
                      v-for="(backupPath, index) in webApiServer.backupPaths"
                      :key="index"
                    >
                      <el-col
                        :span="24"
                        :class="
                          webApiServer.backupPaths.length - 1 === index ? '' : 'mb15'
                        "
                      >
                        <el-form-item label-width="0" label="">
                          <el-input
                            v-model="backupPath.identity"
                            class="mb5"
                            :readonly="true"
                          >
                            <template #prepend>服务标识</template>
                          </el-input>
                          <el-input
                            v-model="backupPath.publishPath"
                            class="mb5"
                            :readonly="true"
                          >
                            <template #prepend>发布路径</template>
                          </el-input>
                          <el-input
                            v-model="backupPath.backupPath"
                            placeholder="请输入服务备份路径"
                            maxlength="500"
                            clearable
                          >
                            <template #prepend>备份路径</template>
                          </el-input>
                        </el-form-item>
                      </el-col>
                    </template>
                  </el-row>
                </fieldset>
              </el-tab-pane>
              <el-tab-pane label="ScheduleServer">
                <el-text
                  type="info"
                  v-if="
                    !state.ruleForm.backupItems.scheduleServer ||
                    state.ruleForm.backupItems.scheduleServer.length < 1
                  "
                  >该服务未部署！</el-text
                >
                <fieldset
                  class="form-server-fieldset"
                  v-for="(seServer, apiIndex) in state.ruleForm.backupItems
                    .scheduleServer"
                  :key="apiIndex"
                >
                  <legend class="form-server-legend">
                    {{ seServer.serverName }}
                  </legend>
                  <el-row>
                    <template
                      v-for="(backupPath, index) in seServer.backupPaths"
                      :key="index"
                    >
                      <el-col
                        :span="24"
                        :class="seServer.backupPaths.length - 1 === index ? '' : 'mb15'"
                      >
                        <el-form-item label-width="0" label="">
                          <el-input
                            v-model="backupPath.identity"
                            class="mb5"
                            :readonly="true"
                          >
                            <template #prepend>服务标识</template>
                          </el-input>
                          <el-input
                            v-model="backupPath.publishPath"
                            class="mb5"
                            :readonly="true"
                          >
                            <template #prepend>发布路径</template>
                          </el-input>
                          <el-input
                            v-model="backupPath.backupPath"
                            placeholder="请输入服务备份路径"
                            maxlength="500"
                            clearable
                          >
                            <template #prepend>备份路径</template>
                          </el-input>
                        </el-form-item>
                      </el-col>
                    </template>
                  </el-row>
                </fieldset>
              </el-tab-pane>
              <el-tab-pane label="WebClient">
                <el-text
                  type="info"
                  v-if="
                    !state.ruleForm.backupItems.webClient ||
                    state.ruleForm.backupItems.webClient.length < 1
                  "
                  >该服务未部署！</el-text
                >
                <fieldset
                  class="form-server-fieldset"
                  v-for="(webServer, apiIndex) in state.ruleForm.backupItems.webClient"
                  :key="apiIndex"
                >
                  <legend class="form-server-legend">
                    {{ webServer.serverName }}
                  </legend>
                  <el-row>
                    <template
                      v-for="(backupPath, index) in webServer.backupPaths"
                      :key="index"
                    >
                      <el-col
                        :span="24"
                        :class="webServer.backupPaths.length - 1 === index ? '' : 'mb15'"
                      >
                        <el-form-item label-width="0" label="">
                          <el-input
                            v-model="backupPath.identity"
                            class="mb5"
                            :readonly="true"
                          >
                            <template #prepend>服务标识</template>
                          </el-input>
                          <el-input
                            v-model="backupPath.publishPath"
                            class="mb5"
                            :readonly="true"
                          >
                            <template #prepend>发布路径</template>
                          </el-input>
                          <el-input
                            v-model="backupPath.backupPath"
                            placeholder="请输入服务备份路径"
                            maxlength="500"
                            clearable
                          >
                            <template #prepend>备份路径</template>
                          </el-input>
                        </el-form-item>
                      </el-col>
                    </template>
                  </el-row>
                </fieldset>
              </el-tab-pane>
              <el-tab-pane label="WpfClient">
                <el-text
                  type="info"
                  v-if="
                    !state.ruleForm.backupItems.wpfClient ||
                    state.ruleForm.backupItems.wpfClient.length < 1
                  "
                  >该服务未部署！</el-text
                >
                <fieldset
                  class="form-server-fieldset"
                  v-for="(wpfServer, apiIndex) in state.ruleForm.backupItems.wpfClient"
                  :key="apiIndex"
                >
                  <legend class="form-server-legend">
                    {{ wpfServer.serverName }}
                  </legend>
                  <el-row>
                    <template
                      v-for="(backupPath, index) in wpfServer.backupPaths"
                      :key="index"
                    >
                      <el-col
                        :span="24"
                        :class="wpfServer.backupPaths.length - 1 === index ? '' : 'mb15'"
                      >
                        <el-form-item label-width="0" label="">
                          <!--
                          <el-input
                            v-model="backupPath.identity"
                            class="mb5"
                            :readonly="true"
                          >
                            <template #prepend>服务标识</template>
                          </el-input>
                          -->
                          <el-input
                            v-model="backupPath.publishPath"
                            class="mb5"
                            :readonly="true"
                          >
                            <template #prepend>发布路径</template>
                          </el-input>
                          <el-input
                            v-model="backupPath.backupPath"
                            placeholder="请输入服务备份路径"
                            maxlength="500"
                            clearable
                          >
                            <template #prepend>备份路径</template>
                          </el-input>
                        </el-form-item>
                      </el-col>
                    </template>
                  </el-row>
                </fieldset>
              </el-tab-pane>
              <el-tab-pane label="SpcMonitor">
                <el-text
                  type="info"
                  v-if="
                    !state.ruleForm.backupItems.spcMonitor ||
                    state.ruleForm.backupItems.spcMonitor.length < 1
                  "
                  >该服务未部署！</el-text
                >
                <fieldset
                  class="form-server-fieldset"
                  v-for="(spcServer, apiIndex) in state.ruleForm.backupItems.spcMonitor"
                  :key="apiIndex"
                >
                  <legend class="form-server-legend">
                    {{ spcServer.serverName }}
                  </legend>
                  <el-row>
                    <template
                      v-for="(backupPath, index) in spcServer.backupPaths"
                      :key="index"
                    >
                      <el-col
                        :span="24"
                        :class="spcServer.backupPaths.length - 1 === index ? '' : 'mb15'"
                      >
                        <el-form-item label-width="0" label="">
                          <el-input
                            v-model="backupPath.identity"
                            class="mb5"
                            :readonly="true"
                          >
                            <template #prepend>服务标识</template>
                          </el-input>
                          <el-input
                            v-model="backupPath.publishPath"
                            class="mb5"
                            :readonly="true"
                          >
                            <template #prepend>发布路径</template>
                          </el-input>
                          <el-input
                            v-model="backupPath.backupPath"
                            placeholder="请输入服务备份路径"
                            maxlength="500"
                            clearable
                          >
                            <template #prepend>备份路径</template>
                          </el-input>
                        </el-form-item>
                      </el-col>
                    </template>
                  </el-row>
                </fieldset>
              </el-tab-pane>
            </el-tabs>
          </el-col>
          <el-col :span="24" class="mb20">
            <el-form-item label-width="0">
              <el-input
                type="textarea"
                v-model="state.ruleForm.remark"
                rows="3"
                placeholder="请输入备注信息…"
                maxlength="150"
                show-word-limit
                clearable
              ></el-input>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button
            @click="onCancel"
            size="default"
            :disabled="state.dialog.submitTxt === '备份中'"
            >取 消</el-button
          >
          <el-button
            v-if="state.dialog.type !== 'viewer'"
            type="primary"
            @click="submitValidate(backupDialogFormRef)"
            size="default"
            :loading="state.dialog.submitTxt === '备份中'"
            >{{ state.dialog.submitTxt }}</el-button
          >
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="backupDialog">
import { nextTick, reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import { ElMessage } from "element-plus";
import { getDefaultSubObject } from "@/utils/other";
import { useBackupDb } from "@/database/backups/index";
import { backupRemoteServer } from "@/utils/backupAppconfig";

// 定义子组件向父组件传值/事件
const emit = defineEmits(["refresh"]);

// 引入项目管理数据库
const backupDb = useBackupDb();

// 定义变量内容
const backupDialogFormRef = ref();
const state = reactive<FormDialogType<RowBackupType>>({
  ruleForm: {
    id: null,
    projectId: null,
    projectName: null,
    environment: null,
    backupDate: null,
    remark: null,
    backupItemsJson: "",
    backupItems: {} as BackupItemsType,
  },
  dialog: {
    show: false,
    type: "add",
    editId: null,
    title: "备份信息",
    submitTxt: "确 定",
  },
});

// 表单验证规则
const formRules = reactive<FormRules>({
  projectName: [{ required: true, message: "请输入项目名称！", trigger: "blur" }],
  environment: [{ required: true, message: "请输入项目环境！", trigger: "blur" }],
});

// 提交验证
const submitValidate = async (formEl: FormInstance | undefined) => {
  if (!formEl) return;
  await formEl.validate((valid, fields) => {
    if (valid) {
      onSubmit();
    } else {
      console.warn("未验证通过!", fields);
    }
  });
};

// 提交
const onSubmit = async () => {
  state.ruleForm.backupItemsJson = JSON.stringify(state.ruleForm.backupItems);
  state.dialog.submitTxt = "备份中";

  // 备份[WebApiHost]
  const backupWebApiHostResult = await backupRemoteServer(
    "WebApiHost",
    state.ruleForm.backupItems.webApiHost
  );
  if (backupWebApiHostResult.code !== 0) {
    ElMessage.error(backupWebApiHostResult.msg);
    state.dialog.submitTxt = "备 份";
    return;
  }

  // 备份[ScheduleServer]
  const backupScheduleServerResult = await backupRemoteServer(
    "ScheduleServer",
    state.ruleForm.backupItems.scheduleServer
  );
  if (backupScheduleServerResult.code !== 0) {
    ElMessage.error(backupScheduleServerResult.msg);
    state.dialog.submitTxt = "备 份";
    return;
  }

  // 备份[WebClient]
  const backupWebClientResult = await backupRemoteServer(
    "WebClient",
    state.ruleForm.backupItems.webClient
  );
  if (backupWebClientResult.code !== 0) {
    ElMessage.error(backupWebClientResult.msg);
    state.dialog.submitTxt = "备 份";
    return;
  }

  // 备份[WpfClient]
  const backupWpfClientResult = await backupRemoteServer(
    "WpfClient",
    state.ruleForm.backupItems.wpfClient
  );
  if (backupWpfClientResult.code !== 0) {
    ElMessage.error(backupWpfClientResult.msg);
    state.dialog.submitTxt = "备 份";
    return;
  }

  // 备份[SpcMonitor]
  const backupSpcMonitorResult = await backupRemoteServer(
    "SpcMonitor",
    state.ruleForm.backupItems.spcMonitor
  );
  if (backupSpcMonitorResult.code !== 0) {
    ElMessage.error(backupSpcMonitorResult.msg);
    state.dialog.submitTxt = "备 份";
    return;
  }

  let insertResult = await backupDb.insertBackup(state.ruleForm);
  if (insertResult.code === 0) {
    ElMessage.success("备份成功！");
    closeDialog(); // 关闭弹窗
    emit("refresh");
  } else {
    ElMessage.error(insertResult.msg);
  }
  state.dialog.submitTxt = "备 份";
};

// 打开弹窗
const openDialog = (type: string, row: RowProjectType) => {
  /* Start: 重置表单内容 */
  state.ruleForm = getDefaultSubObject(state.ruleForm);
  state.dialog.editId = null;
  state.dialog.type = "add";
  /* End: 重置表单内容 */
  nextTick(() => {
    Object.assign(state.ruleForm, row);
    if (type === "viewer") {
      state.dialog.type = "viewer";
      state.dialog.editId = row.id;
      state.dialog.title = "备份信息";
      state.dialog.submitTxt = "确 定";
    } else {
      state.dialog.title = "新增备份";
      state.dialog.submitTxt = "备 份";
    }
    state.dialog.show = true;
  });
};

// 关闭弹窗
const closeDialog = () => {
  state.dialog.show = false;
};

// 取消
const onCancel = () => {
  closeDialog();
};

// 显示dll获取方式
const showDllMode = (
  modelName: string | null | undefined,
  dllModeValue: string | null | undefined
) => {
  if (!modelName) return "";
  if (modelName == "日期范围") {
    let dllModeArr = JSON.parse(String(dllModeValue));
    modelName += `：${dllModeArr[0]} ~ ${dllModeArr[1]}`;
  } else if (modelName == "TFS") {
    const selectTfsItem = JSON.parse(String(dllModeValue)) as SelectTfsType;
    modelName += `：${selectTfsItem.tfsName}；${selectTfsItem.selectModel}：${selectTfsItem.selectValue[0].value} ~ `;
    if (selectTfsItem.selectValue[1].value) {
      modelName += `${selectTfsItem.selectValue[1].value}`;
    } else {
      modelName += "latest";
    }
  }
  return modelName;
};

// 暴露变量
defineExpose({
  openDialog,
});
</script>
<style lang="scss">
.el-overlay .el-overlay-dialog .el-dialog .el-dialog__body {
  padding: 0px !important;
}
</style>

<style lang="scss" scoped>
.form-server-fieldset {
  width: 100%;
  border: 1px #dcdfe6 solid;
  padding-top: 8px;
  padding-left: 10px;
  padding-right: 10px;
  padding-bottom: 10px;
}

.form-server-legend {
  padding: 0px 5px;
  margin-left: 15px;
}
</style>

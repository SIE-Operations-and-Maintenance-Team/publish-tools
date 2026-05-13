<template>
  <div class="generate-publish-container">
    <el-dialog v-model="state.dialog.show" :title="state.dialog.title" :close-on-click-modal="false" :show-close="false"
      modal-class="generate-publish-dialog" draggable width="680px">
      <el-form ref="appconfigDialogFormRef" size="default" label-width="110px" :model="state.ruleForm"
        :rules="formRules">
        <el-row :gutter="10">
          <el-col :span="24">
            <el-form-item label="项目管理" prop="projectId">
              <el-select filterable placeholder="请选择项目管理" size="default" v-model="state.ruleForm.projectId"
                :disabled="true">
                <el-option v-for="project in projectList" :key="project.id" :label="project.name" :value="project.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <div class="form-item-env">
              <el-radio-group :disabled="true" size="default" v-model="state.ruleForm.environment">
                <el-radio border :value="1">Dev</el-radio>
                <el-radio border :value="2">Uat</el-radio>
                <el-radio border :value="3">Pro</el-radio>
                <el-radio border :value="4">Other</el-radio>
              </el-radio-group>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="reset-app-assembly">
              <el-checkbox v-model="resetApplicationAssembly" label="重新获取程序集" size="default" />
            </div>
          </el-col>
          <el-col :span="18">
            <el-form-item label="发布方式" prop="publishMode">
              <el-radio-group size="default" v-model="publishMode" :disabled="state.dialog.submitTxt === '生成中'">
                <el-radio :value="0">远程发布</el-radio>
                <el-radio :value="1">本机发布</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12" v-if="publishMode === 1">
            <el-text type="danger" style="height: 32px; line-height: 32px">* 选择服务配置(建议选择相同的服务器) *</el-text>
          </el-col>
          <template v-if="publishMode === 1">
            <el-col :span="24">
              <fieldset class="form-server-fieldset pr10" v-if="state.ruleForm.configItems.webApiHost.clientPath">
                <legend class="form-server-legend">{{ webApiHostName }}</legend>
                <el-select class="mb10 mr10" placeholder="请选择发布服务器" size="default"
                  v-model="publishLocalServer.webApiHost.serverId" @change="onWebApiHostChange">
                  <el-option v-for="server in state.ruleForm.configItems.webApiHost.serverArr" :key="server.id"
                    :label="server.name" :value="server.id" />
                </el-select>
                <template v-if="publishLocalServer.webApiHost.serverId">
                  <template v-for="serverPath in webApiHostItems">
                    <el-col :span="24">
                      <el-input placeholder="请输入服务标识" maxlength="200" class="mb5"
                        v-if="serverPath.value && serverPath.value.length > 0" :value="serverPath.value[0].identity"
                        :readonly="true">
                        <template #prepend>服务标识</template>
                      </el-input>
                      <el-input placeholder="请输入发布路径" maxlength="200"
                        v-if="serverPath.value && serverPath.value.length > 0" :value="serverPath.value[0].path"
                        :readonly="true">
                        <template #prepend>发布路径</template>
                      </el-input>
                    </el-col>
                  </template>
                </template>
                <view class="form-server-btn">
                  <el-button size="small" type="danger" plain :disabled="state.dialog.submitTxt === '生成中'"
                    @click="clearWebApiHost">移除</el-button>
                </view>
              </fieldset>

              <fieldset class="form-server-fieldset pr10" v-if="state.ruleForm.configItems.scheduleServer.clientPath">
                <legend class="form-server-legend">
                  {{ scheduleServerName }}
                </legend>
                <el-select class="mb10 mr10" placeholder="请选择发布服务器" size="default"
                  v-model="publishLocalServer.scheduleServer.serverId" @change="onScheduleServerChange">
                  <el-option v-for="server in state.ruleForm.configItems.scheduleServer.serverArr" :key="server.id"
                    :label="server.name" :value="server.id" />
                </el-select>
                <template v-if="publishLocalServer.scheduleServer.serverId">
                  <template v-for="serverPath in scheduleServerItems">
                    <el-col :span="24">
                      <el-input placeholder="请输入服务标识" maxlength="200" class="mb5"
                        v-if="serverPath.value && serverPath.value.length > 0" :value="serverPath.value[0].identity"
                        :readonly="true">
                        <template #prepend>服务标识</template>
                      </el-input>
                      <el-input placeholder="请输入发布路径" maxlength="200"
                        v-if="serverPath.value && serverPath.value.length > 0" :value="serverPath.value[0].path"
                        :readonly="true">
                        <template #prepend>发布路径</template>
                      </el-input>
                    </el-col>
                  </template>
                </template>
                <view class="form-server-btn">
                  <el-button size="small" type="danger" plain :disabled="state.dialog.submitTxt === '生成中'"
                    @click="clearScheduleServer">移除</el-button>
                </view>
              </fieldset>

              <fieldset class="form-server-fieldset pr10" v-if="state.ruleForm.configItems.webClient.clientPath">
                <legend class="form-server-legend">{{ webClientName }}</legend>
                <el-select class="mb10 mr10" placeholder="请选择发布服务器" size="default"
                  v-model="publishLocalServer.webClient.serverId" @change="onWebClientChange">
                  <el-option v-for="server in state.ruleForm.configItems.webClient.serverArr" :key="server.id"
                    :label="server.name" :value="server.id" />
                </el-select>
                <template v-if="publishLocalServer.webClient.serverId">
                  <template v-for="serverPath in webClientItems">
                    <el-col :span="24">
                      <el-input placeholder="请输入服务标识" maxlength="200" class="mb5"
                        v-if="serverPath.value && serverPath.value.length > 0" :value="serverPath.value[0].identity"
                        :readonly="true">
                        <template #prepend>服务标识</template>
                      </el-input>
                      <el-input placeholder="请输入发布路径" maxlength="200"
                        v-if="serverPath.value && serverPath.value.length > 0" :value="serverPath.value[0].path"
                        :readonly="true">
                        <template #prepend>发布路径</template>
                      </el-input>
                    </el-col>
                  </template>
                </template>
                <view class="form-server-btn">
                  <el-button size="small" type="danger" plain :disabled="state.dialog.submitTxt === '生成中'"
                    @click="clearWebClient">移除</el-button>
                </view>
              </fieldset>

              <fieldset class="form-server-fieldset pr10" v-if="state.ruleForm.configItems.spcMonitor.clientPath">
                <legend class="form-server-legend">{{ spcMonitorName }}</legend>
                <el-select class="mb10 mr10" placeholder="请选择发布服务器" size="default"
                  v-model="publishLocalServer.spcMonitor.serverId" @change="onSpcMonitorChange">
                  <el-option v-for="server in state.ruleForm.configItems.spcMonitor.serverArr" :key="server.id"
                    :label="server.name" :value="server.id" />
                </el-select>
                <template v-if="publishLocalServer.spcMonitor.serverId">
                  <template v-for="serverPath in spcMonitorItems">
                    <el-col :span="24">
                      <el-input placeholder="请输入服务标识" maxlength="200" class="mb5"
                        v-if="serverPath.value && serverPath.value.length > 0" :value="serverPath.value[0].identity"
                        :readonly="true">
                        <template #prepend>服务标识</template>
                      </el-input>
                      <el-input placeholder="请输入发布路径" maxlength="200"
                        v-if="serverPath.value && serverPath.value.length > 0" :value="serverPath.value[0].path"
                        :readonly="true">
                        <template #prepend>发布路径</template>
                      </el-input>
                    </el-col>
                  </template>
                </template>
                <view class="form-server-btn">
                  <el-button size="small" type="danger" plain :disabled="state.dialog.submitTxt === '生成中'"
                    @click="clearSpcMonitor">移除</el-button>
                </view>
              </fieldset>

              <fieldset class="form-server-fieldset pr10" v-if="state.ruleForm.configItems.wpfClient.clientPath">
                <legend class="form-server-legend">{{ wpfClientName }}</legend>
                <el-select class="mb10 mr10" placeholder="请选择发布服务器" size="default"
                  v-model="publishLocalServer.wpfClient.serverId">
                  <el-option :key="state.ruleForm.configItems.wpfClient.serverId"
                    :label="state.ruleForm.configItems.wpfClient.serverName"
                    :value="state.ruleForm.configItems.wpfClient.serverId" />
                </el-select>
                <template v-if="publishLocalServer.wpfClient.serverId">
                  <el-col :span="24">
                    <el-input placeholder="请选择生成目录" maxlength="200" class="mb5"
                      v-if="state.ruleForm.configItems.wpfClient.generateDirJson" :value="JSON.parse(
                        state.ruleForm.configItems.wpfClient.generateDirJson
                      ).join('、')
                        " :readonly="true">
                      <template #prepend>生成目录</template>
                    </el-input>
                    <el-input placeholder="请输入发布路径" maxlength="200"
                      :value="state.ruleForm.configItems.wpfClient.serverPath" :readonly="true">
                      <template #prepend>发布路径</template>
                    </el-input>
                  </el-col>
                </template>

                <view class="form-server-btn">
                  <el-button size="small" type="danger" plain :disabled="state.dialog.submitTxt === '生成中'"
                    @click="clearWpfClient">移除</el-button>
                </view>
              </fieldset>
            </el-col>
          </template>
        </el-row>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="onCancel" size="default" :disabled="state.dialog.submitTxt === '生成中'">取 消</el-button>
          <el-button type="primary" size="default" :loading="state.dialog.submitTxt === '生成中'"
            @click="submitValidate(appconfigDialogFormRef)">{{ state.dialog.submitTxt }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="appconfigDialog">
import { nextTick, reactive, ref, watch } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import { ElMessage } from "element-plus";
import { path } from "@tauri-apps/api";
import { open } from "@tauri-apps/plugin-dialog";
import _ from "lodash";
import { cmdInvoke } from "@/utils/command";
import { aesEncrypt } from "@/utils/other";
import { useServerDb } from "@/database/servers/index";
import { useProjectDb } from "@/database/project/index";
import { formatDate } from "@/utils/formatTime";
import { outPublishContents } from "@/utils/outPublishInfo";
import { getDefaultSubObject, removeSlash, displayEnvironment } from "@/utils/other";
import { getTfsDllFiles, getGitDllFiles, getReadAllDlls } from "@/utils/backupAppconfig";

// 定义子组件向父组件传值/事件
const emit = defineEmits(["refresh", "exec-application-assembly", "exec-done"]);

const props = defineProps({
  done: Boolean,
});

// 引入应用配置管理数据库
const projectDb = useProjectDb();
const serverDb = useServerDb();

// 定义变量内容
const appconfigDialogFormRef = ref();
const webApiHostName = ref("WebApiHost");
const scheduleServerName = ref("ScheduleServer");
const webClientName = ref("WebClient");
const wpfClientName = ref("WpfClient");
const spcMonitorName = ref("SpcMonitor");
const projectList = ref<RowProjectType[]>();
const publishMode = ref<number>(0);
const tfsData = ref<string>("");
const publishLocalServer = ref({
  webApiHost: {
    serverId: 0 as number | null,
    // activeIndex: 0,
  },
  webClient: {
    serverId: 0 as number | null,
    // activeIndex: 0,
  },
  wpfClient: {
    serverId: 0 as number | null,
    // activeIndex: 0,
  },
  scheduleServer: {
    serverId: 0 as number | null,
    // activeIndex: 0,
  },
  spcMonitor: {
    serverId: 0 as number | null,
    // activeIndex: 0,
  },
});
const resetApplicationAssembly = ref<boolean>(true);
const scheduleServerItems = ref<ServerOptionType[]>();
const state = reactive<FormDialogType<RowAppconfigType>>({
  ruleForm: {
    id: null,
    projectId: null,
    projectName: null,
    environment: 1,
    msBuildPath: null,
    dllMode: "全部",
    dllModeValue: null,
    buildMode: "Debug",
    configItemsJson: "",
    configItems: {
      webApiHost: {
        clientPath: "",
        serverPath: "",
        serverIds: [],
        serverArr: [],
      },
      webClient: {
        clientPath: "",
        serverPath: "",
        serverIds: [],
        serverArr: [],
      },
      wpfClient: {
        clientPath: "",
        serverId: null,
        serverName: null,
        serverPath: "",
        isCompress: 1,
        generateDirJson: "",
        compressFileJson: "",
      },
      scheduleServer: {
        clientPath: "",
        serverPath: "",
        serverIds: [],
        serverArr: [],
      },
      spcMonitor: {
        clientPath: "",
        serverPath: "",
        serverIds: [],
        serverArr: [],
      },
      isRebuild: 1,
      isBackup: 0,
      isNewVersion: false,
    },
  },
  dialog: {
    show: false,
    type: "edit",
    editId: null,
    title: "提示",
    submitTxt: "确定",
  },
});

// 清除【wpfClient】
const clearWpfClient = () => {
  state.ruleForm.configItems.wpfClient.clientPath = null;
  state.ruleForm.configItems.wpfClient.serverId = null;
  state.ruleForm.configItems.wpfClient.serverName = null;
  state.ruleForm.configItems.wpfClient.serverPath = null;
  state.ruleForm.configItems.wpfClient.isCompress = 1;
  state.ruleForm.configItems.wpfClient.generateDirJson = "";
  state.ruleForm.configItems.wpfClient.compressFileJson = "";

  publishLocalServer.value.wpfClient.serverId = null;
};

// 清除【spcMonitor】
const clearSpcMonitor = () => {
  state.ruleForm.configItems.spcMonitor.clientPath = null;
  state.ruleForm.configItems.spcMonitor.serverPath = null;
  state.ruleForm.configItems.spcMonitor.serverIds = [];
  state.ruleForm.configItems.spcMonitor.serverArr = [];

  publishLocalServer.value.spcMonitor.serverId = null;
};

// 清除【webClient】
const clearWebClient = () => {
  state.ruleForm.configItems.webClient.clientPath = null;
  state.ruleForm.configItems.webClient.serverPath = null;
  state.ruleForm.configItems.webClient.serverIds = [];
  state.ruleForm.configItems.webClient.serverArr = [];

  publishLocalServer.value.webClient.serverId = null;
};

// 清除【scheduleServer】
const clearScheduleServer = () => {
  state.ruleForm.configItems.scheduleServer.clientPath = null;
  state.ruleForm.configItems.scheduleServer.serverIds = [];
  state.ruleForm.configItems.scheduleServer.serverArr = [];

  publishLocalServer.value.scheduleServer.serverId = null;
};

// 清除【webApiHost】
const clearWebApiHost = () => {
  state.ruleForm.configItems.webApiHost.clientPath = null;
  state.ruleForm.configItems.webApiHost.serverPath = null;
  state.ruleForm.configItems.webApiHost.serverIds = [];
  state.ruleForm.configItems.webApiHost.serverArr = [];

  publishLocalServer.value.webApiHost.serverId = null;
};

// 表单验证规则
const formRules = reactive<FormRules>({
  projectId: [{ required: true, message: "请选择项目管理！", trigger: "change" }],
  dllMode: [{ required: true, message: "请选择获取dll方式！", trigger: "change" }],
  dllModeValue: [
    {
      validator: (rule: any, value: any, callback: any) => {
        if (!value && state.ruleForm.dllMode === "日期范围") {
          callback(new Error("请选择日期范围！"));
        } else {
          callback();
        }
        console.log(rule);
      },
      trigger: "blur",
    },
  ],
});

// WebApi切换监听
const webApiHostItems = ref<ServerOptionType[]>();
const onWebApiHostChange = (serverId: number) => {
  const serverPaths = state.ruleForm.configItems.webApiHost.serverArr.find(
    (x) => x.id === serverId
  )?.serverPathArr;
  webApiHostItems.value = serverPaths;
};

// WebClient切换监听
const webClientItems = ref<ServerOptionType[]>();
const onWebClientChange = (serverId: number) => {
  const serverPaths = state.ruleForm.configItems.webClient.serverArr.find(
    (x) => x.id === serverId
  )?.serverPathArr;
  webClientItems.value = serverPaths;
};

// SpcMonitor切换监听
const spcMonitorItems = ref<ServerOptionType[]>();
const onSpcMonitorChange = (serverId: number) => {
  const serverPaths = state.ruleForm.configItems.spcMonitor.serverArr.find(
    (x) => x.id === serverId
  )?.serverPathArr;
  spcMonitorItems.value = serverPaths;
};

// ScheduleServer切换监听
const onScheduleServerChange = (serverId: number) => {
  const serverPaths = state.ruleForm.configItems.scheduleServer.serverArr.find(
    (x) => x.id === serverId
  )?.serverPathArr;
  scheduleServerItems.value = serverPaths;
};

// 提交验证
const submitValidate = async (formEl: FormInstance | undefined) => {
  if (!formEl) return;
  await formEl.validate((valid, fields) => {
    if (valid) {
      if (resetApplicationAssembly.value) {
        emit("exec-application-assembly");
        return;
      }
      onSubmit();
    } else {
      ElMessage.warning("未验证通过，请检查！");
      console.warn("未验证通过!", fields);
    }
  });
};

// 表单重置
const formReset = () => {
  state.ruleForm = getDefaultSubObject(state.ruleForm);
  state.ruleForm.configItems.wpfClient.isCompress = null;
  state.ruleForm.dllMode = "全部";
  if (state.ruleForm.projectId == 0) state.ruleForm.projectId = null;
  if (state.ruleForm.environment == 0) state.ruleForm.environment = 1;
  publishMode.value = 0;
  state.dialog.editId = null;
  state.dialog.type = "add";
  state.ruleForm.configItems.wpfClient.generateDirJson = "";
  state.ruleForm.configItems.webApiHost.serverIds = [];
  state.ruleForm.configItems.webApiHost.serverArr = [];
  state.ruleForm.configItems.webClient.serverIds = [];
  state.ruleForm.configItems.webClient.serverArr = [];
  state.ruleForm.configItems.scheduleServer.serverIds = [];
  state.ruleForm.configItems.scheduleServer.serverArr = [];
  state.ruleForm.configItems.wpfClient.serverId = null;
  state.ruleForm.configItems.spcMonitor.serverIds = [];
  state.ruleForm.configItems.spcMonitor.serverArr = [];
  state.ruleForm.configItems.isRebuild = 1;

  publishLocalServer.value.webApiHost.serverId = null;
  publishLocalServer.value.webClient.serverId = null;
  publishLocalServer.value.wpfClient.serverId = null;
  publishLocalServer.value.scheduleServer.serverId = null;
  publishLocalServer.value.spcMonitor.serverId = null;
  webApiHostItems.value = [];
  webClientItems.value = [];
  spcMonitorItems.value = [];
};

// 打开弹窗
const openDialog = async (type: string, row: RowAppconfigType | undefined) => {
  /* Start: 重置表单内容 */
  formReset();
  tfsData.value = "";
  /* End: 重置表单内容 */
  await getProjectList();
  nextTick(() => {
    state.dialog.editId = row?.id;
    Object.assign(state.ruleForm, row);
    initPublishLocalServer();
    state.dialog.title = "生成发布文件";
    state.dialog.submitTxt = "生 成";
    state.dialog.show = true;
    console.log("应用配置数据：", state.ruleForm);
  });
  console.log(type);
};

// 本机发布初始数据
const initPublishLocalServer = () => {
  if (
    state.ruleForm.configItems.webApiHost.serverArr &&
    state.ruleForm.configItems.webApiHost.serverArr.length > 0
  ) {
    if (!state.ruleForm.configItems.webApiHost.serverArr[0].id) return;
    publishLocalServer.value.webApiHost.serverId =
      state.ruleForm.configItems.webApiHost.serverArr[0].id;
    onWebApiHostChange(state.ruleForm.configItems.webApiHost.serverArr[0].id);
  }

  if (
    state.ruleForm.configItems.webClient.serverArr &&
    state.ruleForm.configItems.webClient.serverArr.length > 0
  ) {
    if (!state.ruleForm.configItems.webClient.serverArr[0].id) return;
    publishLocalServer.value.webClient.serverId =
      state.ruleForm.configItems.webClient.serverArr[0].id;
    onWebClientChange(state.ruleForm.configItems.webClient.serverArr[0].id);
  }

  if (
    state.ruleForm.configItems.spcMonitor.serverArr &&
    state.ruleForm.configItems.spcMonitor.serverArr.length > 0
  ) {
    if (!state.ruleForm.configItems.spcMonitor.serverArr[0].id) return;
    publishLocalServer.value.spcMonitor.serverId =
      state.ruleForm.configItems.spcMonitor.serverArr[0].id;
    onSpcMonitorChange(state.ruleForm.configItems.spcMonitor.serverArr[0].id);
  }

  if (state.ruleForm.configItems.wpfClient.serverId) {
    publishLocalServer.value.wpfClient.serverId =
      state.ruleForm.configItems.wpfClient.serverId;
  }

  if (
    state.ruleForm.configItems.scheduleServer.serverArr &&
    state.ruleForm.configItems.scheduleServer.serverArr.length > 0
  ) {
    if (!state.ruleForm.configItems.scheduleServer.serverArr[0].id) return;
    publishLocalServer.value.scheduleServer.serverId =
      state.ruleForm.configItems.scheduleServer.serverArr[0].id;
    onScheduleServerChange(state.ruleForm.configItems.scheduleServer.serverArr[0].id);
  }
};

// 关闭弹窗
const closeDialog = () => {
  state.dialog.show = false;
};

// 取消
const onCancel = () => {
  closeDialog();
};

watch(
  () => props.done,
  (newVal) => {
    if (newVal) {
      onSubmit();
    }
  }
);

// 提交
const onSubmit = async () => {
  state.dialog.submitTxt = "生成中";
  let generateResult = false;
  switch (publishMode.value) {
    case 0:
      generateResult = await generateRemotePublish();
      break;
    case 1:
      generateResult = await generateLocalPublish();
      break;
    default:
      break;
  }
  emit("exec-done");
  state.dialog.submitTxt = "生 成";
  if (generateResult) {
    ElMessage.success("生成成功！");
    onCancel();
    return;
  }
  ElMessage.error("生成失败，重新编译试试！");
};

// 生成本地发布
const generateLocalPublish = async () => {
  // 创建一个临时操作目录
  const tempLocalPublishDir = await path.appDataDir();
  const rPublishDir = `${removeSlash(tempLocalPublishDir)}/tempLocalPublish`;
  let createTempPathResult = await createDir(rPublishDir);
  if (!createTempPathResult) {
    ElMessage.warning(`创建临时远程发布目录失败：${rPublishDir}`);
    return false;
  }
  let isSuccess = true;
  let zipFilePaths = new Array<string>();

  // 复制[WebApiHost]服务文件到临时目录
  if (state.ruleForm.configItems.webApiHost.clientPath) {
    const outPath = `${rPublishDir}/WebApiHost`;
    await createDir(outPath);
    isSuccess = await copyAssemblyFile(
      "WebApiHost",
      outPath,
      state.ruleForm.configItems.webApiHost.clientPath
    );
    zipFilePaths.push(outPath);
  }

  // 复制[ScheduleServer]服务文件到临时目录
  if (state.ruleForm.configItems.scheduleServer.clientPath) {
    const outPath = `${rPublishDir}/ScheduleServer`;
    await createDir(outPath);
    isSuccess = await copyAssemblyFile(
      "ScheduleServer",
      outPath,
      state.ruleForm.configItems.scheduleServer.clientPath
    );
    zipFilePaths.push(outPath);
  }

  // 复制[WebClient]服务文件到临时目录
  if (state.ruleForm.configItems.webClient.clientPath) {
    const outPath = `${rPublishDir}/WebClient`;
    await createDir(outPath);
    isSuccess = await copyAssemblyFile(
      "WebClient",
      outPath,
      state.ruleForm.configItems.webClient.clientPath
    );
    zipFilePaths.push(outPath);
  }

  // 复制[SpcMonitor]服务文件到临时目录
  if (state.ruleForm.configItems.spcMonitor.clientPath) {
    const outPath = `${rPublishDir}/SpcMonitor`;
    await createDir(outPath);
    isSuccess = await copyAssemblyFile(
      "SpcMonitor",
      outPath,
      state.ruleForm.configItems.spcMonitor.clientPath
    );
    zipFilePaths.push(outPath);
  }

  // 复制[WpfClient]服务文件到临时目录
  if (state.ruleForm.configItems.wpfClient.clientPath) {
    const outPath = `${rPublishDir}/WpfClient`;
    await createDir(outPath);
    isSuccess = await copyWpfAssemblyFile(
      outPath,
      state.ruleForm.configItems.wpfClient.clientPath,
      String(state.ruleForm.configItems.wpfClient.generateDirJson)
    );
    zipFilePaths.push(outPath);
  }
  if (!isSuccess) return false;

  let localPublishConfig = {} as LocalPublishType;
  localPublishConfig.projectName = String(state.ruleForm.projectName);
  localPublishConfig.environment = Number(state.ruleForm.environment);
  localPublishConfig.publishMode = publishMode.value;
  localPublishConfig.generateDate = formatDate(new Date(), "YYYY-mm-dd HH:MM:SS");
  localPublishConfig.isNewVersion = state.ruleForm.configItems.isNewVersion;
  localPublishConfig.webApiHost = {} as PublishServerType;

  if (
    state.ruleForm.configItems.webApiHost.clientPath &&
    webApiHostItems.value &&
    publishLocalServer.value.webApiHost.serverId
  ) {
    const serverInfo = await getServerDetail(
      publishLocalServer.value.webApiHost.serverId
    );
    if (serverInfo) {
      localPublishConfig.webApiHost.serverName = serverInfo.name;
      localPublishConfig.webApiHost.serverOs = serverInfo.os;
      /*
      localPublishConfig.webApiHost.serverIp = serverInfo.ip;
      localPublishConfig.webApiHost.serverPort = serverInfo.port;
      localPublishConfig.webApiHost.serverAccount = serverInfo.account;
      localPublishConfig.webApiHost.serverPwd = await aesEncrypt(serverInfo.pwd);
      */
    }

    localPublishConfig.webApiHost.serverConfigs = [] as PublishServerConfigType[];
    const webApiHostFiles = await getReadAllDlls(`${rPublishDir}/WebApiHost`);
    let pFiles = new Array<string>();
    for (let k = 0; k < webApiHostFiles.length; k++) {
      const webApiHostFile = webApiHostFiles[k];
      if (!webApiHostFile) continue;
      const pathFile = removeSlash(webApiHostFile);
      pFiles.push(pathFile.substring(pathFile.lastIndexOf("/") + 1));
    }
    for (let i = 0; i < webApiHostItems.value.length; i++) {
      const webApiHostServer = webApiHostItems.value[i];
      if (!webApiHostServer.value || webApiHostServer.value.length === 0) continue;
      localPublishConfig.webApiHost.serverConfigs.push({
        serverIdentity: String(webApiHostServer.value[0].identity),
        publishPath: String(webApiHostServer.value[0].path),
        publishFiles: pFiles,
      });
    }
  }

  localPublishConfig.webClient = {} as PublishServerType;
  if (
    state.ruleForm.configItems.webClient.clientPath &&
    webClientItems.value &&
    publishLocalServer.value.webClient.serverId
  ) {
    const serverInfo = await getServerDetail(publishLocalServer.value.webClient.serverId);
    if (serverInfo) {
      localPublishConfig.webClient.serverName = serverInfo.name;
      localPublishConfig.webClient.serverOs = serverInfo.os;
      /*
      localPublishConfig.webClient.serverIp = serverInfo.ip;
      localPublishConfig.webClient.serverPort = serverInfo.port;
      localPublishConfig.webClient.serverAccount = serverInfo.account;
      localPublishConfig.webClient.serverPwd = await aesEncrypt(serverInfo.pwd);
      */
    }

    localPublishConfig.webClient.serverConfigs = [] as PublishServerConfigType[];
    const webClientFiles = await getReadAllDlls(`${rPublishDir}/WebClient`);
    let pFiles = new Array<string>();
    for (let k = 0; k < webClientFiles.length; k++) {
      const webClientFile = webClientFiles[k];
      if (!webClientFile) continue;
      const pathFile = removeSlash(webClientFile);
      pFiles.push(pathFile.substring(pathFile.lastIndexOf("/") + 1));
    }
    for (let i = 0; i < webClientItems.value.length; i++) {
      const webClientServer = webClientItems.value[i];
      if (webClientServer && webClientServer.value && webClientServer.value.length > 0) {
        localPublishConfig.webClient.serverConfigs.push({
          serverIdentity: String(webClientServer.value[0].identity),
          publishPath: String(webClientServer.value[0].path),
          publishFiles: pFiles,
        });
      }
    }
  }

  localPublishConfig.scheduleServer = {} as PublishServerType;
  if (
    state.ruleForm.configItems.scheduleServer.clientPath &&
    publishLocalServer.value.scheduleServer.serverId
  ) {
    const scheduleServer = state.ruleForm.configItems.scheduleServer.serverArr.find(
      x => x.id === publishLocalServer.value.scheduleServer.serverId
    );
    if (scheduleServer && scheduleServer.serverPathArr && scheduleServer.serverPathArr.length > 0) {
      const scheduleServerPath = scheduleServer.serverPathArr[0]; // 使用第一个路径配置
      if (scheduleServerPath && scheduleServerPath.value && scheduleServerPath.value.length > 0) {
        // 获取服务器详细信息
        const serverInfo = await getServerDetail(Number(scheduleServer.id));
        if (serverInfo) {
          localPublishConfig.scheduleServer.serverName = serverInfo.name;
          localPublishConfig.scheduleServer.serverOs = serverInfo.os;
          localPublishConfig.scheduleServer.serverIp = serverInfo.ip;
          localPublishConfig.scheduleServer.serverPort = serverInfo.port;
          localPublishConfig.scheduleServer.serverAccount = serverInfo.account;
          localPublishConfig.scheduleServer.serverPwd = await aesEncrypt(serverInfo.pwd);
        }

        localPublishConfig.scheduleServer.serverConfigs = [] as PublishServerConfigType[];
        const scheduleServerFiles = await getReadAllDlls(`${rPublishDir}/ScheduleServer`);
        let sFiles = new Array<string>();
        for (let k = 0; k < scheduleServerFiles.length; k++) {
          const scheduleServerFile = scheduleServerFiles[k];
          if (!scheduleServerFile) continue;
          const pathFile = removeSlash(scheduleServerFile);
          sFiles.push(pathFile.substring(pathFile.lastIndexOf("/") + 1));
        }
        localPublishConfig.scheduleServer.serverConfigs.push({
          serverIdentity: String(scheduleServerPath.value[0].identity),
          publishPath: String(scheduleServerPath.value[0].path),
          publishFiles: sFiles,
        });
      }
    }
  }

  localPublishConfig.spcMonitor = {} as PublishServerType;
  if (
    state.ruleForm.configItems.spcMonitor.clientPath &&
    spcMonitorItems.value &&
    publishLocalServer.value.spcMonitor.serverId
  ) {
    const serverInfo = await getServerDetail(
      publishLocalServer.value.spcMonitor.serverId
    );
    if (serverInfo) {
      localPublishConfig.spcMonitor.serverName = serverInfo.name;
      localPublishConfig.spcMonitor.serverOs = serverInfo.os;
      /*
      localPublishConfig.spcMonitor.serverIp = serverInfo.ip;
      localPublishConfig.spcMonitor.serverPort = serverInfo.port;
      localPublishConfig.spcMonitor.serverAccount = serverInfo.account;
      localPublishConfig.spcMonitor.serverPwd = await aesEncrypt(serverInfo.pwd);
      */
    }

    localPublishConfig.spcMonitor.serverConfigs = [] as PublishServerConfigType[];
    const spcMonitorFiles = await getReadAllDlls(`${rPublishDir}/SpcMonitor`);
    let pFiles = new Array<string>();
    for (let k = 0; k < spcMonitorFiles.length; k++) {
      const spcMonitorFile = spcMonitorFiles[k];
      if (!spcMonitorFile) continue;
      const pathFile = removeSlash(spcMonitorFile);
      pFiles.push(pathFile.substring(pathFile.lastIndexOf("/") + 1));
    }
    for (let i = 0; i < spcMonitorItems.value.length; i++) {
      const spcMonitorServer = spcMonitorItems.value[i];
      if (
        spcMonitorServer &&
        spcMonitorServer.value &&
        spcMonitorServer.value.length > 0
      ) {
        localPublishConfig.spcMonitor.serverConfigs.push({
          serverIdentity: String(spcMonitorServer.value[0].identity),
          publishPath: String(spcMonitorServer.value[0].path),
          publishFiles: pFiles,
        });
      }
    }
  }

  localPublishConfig.wpfClient = {} as PublishWpfType;
  if (
    state.ruleForm.configItems.wpfClient.clientPath &&
    publishLocalServer.value.wpfClient.serverId
  ) {
    const wpfServerInfo = await getServerDetail(
      publishLocalServer.value.wpfClient.serverId
    );
    if (wpfServerInfo) {
      localPublishConfig.wpfClient.serverName = wpfServerInfo.name;
      localPublishConfig.wpfClient.serverOs = wpfServerInfo.os;
      /*
      localPublishConfig.wpfClient.serverIp = wpfServerInfo.ip;
      localPublishConfig.wpfClient.serverPort = wpfServerInfo.port;
      localPublishConfig.wpfClient.serverAccount = wpfServerInfo.account;
      localPublishConfig.wpfClient.serverPwd = await aesEncrypt(wpfServerInfo.pwd);
      */
    }
    localPublishConfig.wpfClient.publishPath = String(
      state.ruleForm.configItems.wpfClient.serverPath
    );
    localPublishConfig.wpfClient.publishFiles = [];
    if (state.ruleForm.configItems.wpfClient.generateDirJson) {
      let generateDirArr = JSON.parse(
        state.ruleForm.configItems.wpfClient.generateDirJson
      );
      for (let i = 0; i < generateDirArr.length; i++) {
        const generateDir = generateDirArr[i];
        const wpfFiles = await getReadAllDlls(`${rPublishDir}/WpfClient/${generateDir}`);
        let pFiles = new Array<string>();
        for (let k = 0; k < wpfFiles.length; k++) {
          const wpfFilesFile = wpfFiles[k];
          if (!wpfFilesFile) continue;
          const pathFile = removeSlash(wpfFilesFile);
          pFiles.push(pathFile.substring(pathFile.lastIndexOf("/") + 1));
        }
        localPublishConfig.wpfClient.publishFiles.push({
          dirName: generateDir,
          files: pFiles,
        });
      }
    }
  }

  // 得到发布信息
  if (tfsData.value) {
    let notesResult = await outPublishContents(tfsData.value, rPublishDir);
    if (notesResult.code === 0) localPublishConfig.notes = notesResult.data;
  }

  // 保存发布配置
  const filePath = `${rPublishDir}/publish.config.json`;
  const saveResult = await cmdInvoke("save_content_to_file", {
    content: JSON.stringify(localPublishConfig, null, 2),
    filePath,
  });
  if (saveResult.code !== 0) {
    ElMessage.error(`保存发布配置信息失败：${saveResult.data}`);
    return false;
  }
  zipFilePaths.push(filePath);

  // 压缩发布配置
  const pMode = publishMode.value === 0 ? "远程发布" : "本机发布";
  const zipFileName = `${state.ruleForm.projectName}_${displayEnvironment(
    Number(state.ruleForm.environment)
  )}_${pMode}_${formatDate(new Date(), "YYYYmmddHHMMSS")}.smom`;
  const generateZipFilePath = `${removeSlash(tempLocalPublishDir)}/${zipFileName}`;
  const zipResult = await cmdInvoke("zip_dir", {
    srcDir: rPublishDir,
    dstFile: generateZipFilePath,
  });
  if (zipResult.code !== 0) {
    ElMessage.error(`压缩发布配置失败：${zipResult.data}`);
    return false;
  }

  // 删除临时发布目录
  await cmdInvoke("delete_paths", {
    paths: [rPublishDir],
  });

  // 打开保存文件对话框
  const saveFileDir = await open({
    directory: true,
    multiple: false,
    title: "保存发布文件",
  });
  if (!saveFileDir) {
    ElMessage.info("您已取消保存文件！");
  } else {
    const saveFilePath = `${saveFileDir}/${zipFileName}`;
    const moveResult = await cmdInvoke("move_file", {
      source: generateZipFilePath,
      destination: saveFilePath,
    });
    if (moveResult.code !== 0) {
      ElMessage.error(`保存发布文件失败：${moveResult.data}`);
      return false;
    }
  }
  return true;
};

// 生成远程发布
const generateRemotePublish = async () => {
  // 创建一个临时操作目录
  const tempRemotePublishDir = await path.appDataDir();
  const rPublishDir = `${removeSlash(tempRemotePublishDir)}/tempRemotePublish`;
  let createTempPathResult = await createDir(rPublishDir);
  if (!createTempPathResult) {
    ElMessage.warning(`创建临时远程发布目录失败：${rPublishDir}`);
    return false;
  }
  let isSuccess = true;
  let zipFilePaths = new Array<string>();

  // 复制[WebApiHost]服务文件到临时目录
  if (state.ruleForm.configItems.webApiHost.clientPath) {
    const outPath = `${rPublishDir}/WebApiHost`;
    await createDir(outPath);
    isSuccess = await copyAssemblyFile(
      "WebApiHost",
      outPath,
      state.ruleForm.configItems.webApiHost.clientPath
    );
    zipFilePaths.push(outPath);
  }

  // 复制[ScheduleServer]服务文件到临时目录
  if (state.ruleForm.configItems.scheduleServer.clientPath) {
    const outPath = `${rPublishDir}/ScheduleServer`;
    await createDir(outPath);
    isSuccess = await copyAssemblyFile(
      "ScheduleServer",
      outPath,
      state.ruleForm.configItems.scheduleServer.clientPath
    );
    zipFilePaths.push(outPath);
  }

  // 复制[WebClient]服务文件到临时目录
  if (state.ruleForm.configItems.webClient.clientPath) {
    const outPath = `${rPublishDir}/WebClient`;
    await createDir(outPath);
    isSuccess = await copyAssemblyFile(
      "WebClient",
      outPath,
      state.ruleForm.configItems.webClient.clientPath
    );
    zipFilePaths.push(outPath);
  }

  // 复制[SpcMonitor]服务文件到临时目录
  if (state.ruleForm.configItems.spcMonitor.clientPath) {
    const outPath = `${rPublishDir}/SpcMonitor`;
    await createDir(outPath);
    isSuccess = await copyAssemblyFile(
      "SpcMonitor",
      outPath,
      state.ruleForm.configItems.spcMonitor.clientPath
    );
    zipFilePaths.push(outPath);
  }

  // 复制[WpfClient]服务文件到临时目录
  if (state.ruleForm.configItems.wpfClient.clientPath) {
    const outPath = `${rPublishDir}/WpfClient`;
    await createDir(outPath);
    isSuccess = await copyWpfAssemblyFile(
      outPath,
      state.ruleForm.configItems.wpfClient.clientPath,
      String(state.ruleForm.configItems.wpfClient.generateDirJson)
    );
    zipFilePaths.push(outPath);
  }
  if (!isSuccess) return false;

  let remotePublishConfig = {} as RemotePublishType;
  remotePublishConfig.projectName = String(state.ruleForm.projectName);
  remotePublishConfig.environment = Number(state.ruleForm.environment);
  remotePublishConfig.isBackup = Number(state.ruleForm.configItems.isBackup);
  remotePublishConfig.publishMode = publishMode.value;
  remotePublishConfig.generateDate = formatDate(new Date(), "YYYY-mm-dd HH:MM:SS");
  remotePublishConfig.isNewVersion = state.ruleForm.configItems.isNewVersion;

  remotePublishConfig.webApiHost = [] as PublishServerType[];
  if (state.ruleForm.configItems.webApiHost.clientPath) {
    const webApiHostFiles = await getReadAllDlls(`${rPublishDir}/WebApiHost`);
    let webApiFiles = new Array<string>();
    for (let k = 0; k < webApiHostFiles.length; k++) {
      const webApiHostFile = webApiHostFiles[k];
      if (!webApiHostFile) continue;
      const pathFile = removeSlash(webApiHostFile);
      webApiFiles.push(pathFile.substring(pathFile.lastIndexOf("/") + 1));
    }
    for (let i = 0; i < state.ruleForm.configItems.webApiHost.serverArr.length; i++) {
      const server = state.ruleForm.configItems.webApiHost.serverArr[i];
      if (!server.id) continue;
      let serverConfigs = new Array<PublishServerConfigType>();
      for (let j = 0; j < server.serverPathArr.length; j++) {
        const serverPath = server.serverPathArr[j];
        if (!serverPath.value || serverPath.value.length < 1) continue;

        serverConfigs.push({
          serverIdentity: String(serverPath.value[0].identity),
          publishPath: String(serverPath.value[0].path),
          publishFiles: webApiFiles,
        });
      }
      const serverInfo = await getServerDetail(server.id);
      if (!serverInfo) continue;
      remotePublishConfig.webApiHost.push({
        serverName: serverInfo.name,
        serverOs: serverInfo.os,
        serverIp: serverInfo.ip,
        serverPort: serverInfo.port,
        serverAccount: serverInfo.account,
        serverPwd: await aesEncrypt(serverInfo.pwd),
        serverConfigs,
      });
    }
  }

  remotePublishConfig.webClient = [] as PublishServerType[];
  if (state.ruleForm.configItems.webClient.clientPath) {
    const webClientFiles = await getReadAllDlls(`${rPublishDir}/WebClient`);
    let pFiles = new Array<string>();
    for (let k = 0; k < webClientFiles.length; k++) {
      const webClientFile = webClientFiles[k];
      if (!webClientFile) continue;
      const pathFile = removeSlash(webClientFile);
      pFiles.push(pathFile.substring(pathFile.lastIndexOf("/") + 1));
    }
    for (let i = 0; i < state.ruleForm.configItems.webClient.serverArr.length; i++) {
      const server = state.ruleForm.configItems.webClient.serverArr[i];
      if (!server.id) continue;
      let serverConfigs = new Array<PublishServerConfigType>();
      for (let j = 0; j < server.serverPathArr.length; j++) {
        const serverPath = server.serverPathArr[j];
        if (!serverPath.value || serverPath.value.length < 1) continue;

        serverConfigs.push({
          serverIdentity: String(serverPath.value[0].identity),
          publishPath: String(serverPath.value[0].path),
          publishFiles: pFiles,
        });
      }
      const serverInfo = await getServerDetail(server.id);
      if (!serverInfo) continue;
      remotePublishConfig.webClient.push({
        serverName: serverInfo.name,
        serverOs: serverInfo.os,
        serverIp: serverInfo.ip,
        serverPort: serverInfo.port,
        serverAccount: serverInfo.account,
        serverPwd: await aesEncrypt(serverInfo.pwd),
        serverConfigs,
      });
    }
  }

  remotePublishConfig.scheduleServer = [] as PublishServerType[];
  if (state.ruleForm.configItems.scheduleServer.clientPath) {
    for (let i = 0; i < state.ruleForm.configItems.scheduleServer.serverArr.length; i++) {
      const scheduleServer = state.ruleForm.configItems.scheduleServer.serverArr[i];
      if (!scheduleServer.id || !scheduleServer.serverPathArr || scheduleServer.serverPathArr.length < 1) continue;

      let serverConfigs = new Array<PublishServerConfigType>();
      const scheduleServerFiles = await getReadAllDlls(`${rPublishDir}/ScheduleServer`);
      let scheduleFiles = new Array<string>();
      for (let k = 0; k < scheduleServerFiles.length; k++) {
        const scheduleServerFile = scheduleServerFiles[k];
        if (!scheduleServerFile) continue;
        const pathFile = removeSlash(scheduleServerFile);
        scheduleFiles.push(pathFile.substring(pathFile.lastIndexOf("/") + 1));
      }

      // 遍历服务器的所有路径配置
      for (let j = 0; j < scheduleServer.serverPathArr.length; j++) {
        const scheduleServerPath = scheduleServer.serverPathArr[j];
        if (scheduleServerPath && scheduleServerPath.value && scheduleServerPath.value.length > 0) {
          // 为每个路径配置创建一个serverConfig
          for (let l = 0; l < scheduleServerPath.value.length; l++) {
            const pathValue = scheduleServerPath.value[l];
            serverConfigs.push({
              serverIdentity: String(pathValue.identity),
              publishPath: String(pathValue.path),
              publishFiles: scheduleFiles,
            });
          }
        }
      }

      const scheduleServerInfo = await getServerDetail(
        Number(scheduleServer.id)
      );
      if (scheduleServerInfo) {
        remotePublishConfig.scheduleServer.push({
          serverName: String(scheduleServer.name),
          serverOs: scheduleServerInfo.os,
          serverIp: scheduleServerInfo.ip,
          serverPort: scheduleServerInfo.port,
          serverAccount: scheduleServerInfo.account,
          serverPwd: await aesEncrypt(scheduleServerInfo.pwd),
          serverConfigs,
        });
      }
    }
  }

  remotePublishConfig.spcMonitor = [] as PublishServerType[];
  if (state.ruleForm.configItems.spcMonitor.clientPath) {
    const spcMonitorFiles = await getReadAllDlls(`${rPublishDir}/SpcMonitor`);
    let spcFiles = new Array<string>();
    for (let k = 0; k < spcMonitorFiles.length; k++) {
      const spcMonitorFile = spcMonitorFiles[k];
      if (!spcMonitorFile) continue;
      const pathFile = removeSlash(spcMonitorFile);
      spcFiles.push(pathFile.substring(pathFile.lastIndexOf("/") + 1));
    }
    for (let i = 0; i < state.ruleForm.configItems.spcMonitor.serverArr.length; i++) {
      const server = state.ruleForm.configItems.spcMonitor.serverArr[i];
      if (!server.id) continue;
      let serverConfigs = new Array<PublishServerConfigType>();
      for (let j = 0; j < server.serverPathArr.length; j++) {
        const serverPath = server.serverPathArr[j];
        if (!serverPath.value || serverPath.value.length < 1) continue;

        serverConfigs.push({
          serverIdentity: String(serverPath.value[0].identity),
          publishPath: String(serverPath.value[0].path),
          publishFiles: spcFiles,
        });
      }
      const serverInfo = await getServerDetail(server.id);
      if (!serverInfo) continue;
      remotePublishConfig.spcMonitor.push({
        serverName: serverInfo.name,
        serverOs: serverInfo.os,
        serverIp: serverInfo.ip,
        serverPort: serverInfo.port,
        serverAccount: serverInfo.account,
        serverPwd: await aesEncrypt(serverInfo.pwd),
        serverConfigs,
      });
    }
  }

  remotePublishConfig.wpfClient = {} as PublishWpfType;
  if (state.ruleForm.configItems.wpfClient.clientPath) {
    const wpfClientServerInfo = await getServerDetail(
      Number(state.ruleForm.configItems.wpfClient.serverId)
    );
    if (wpfClientServerInfo) {
      remotePublishConfig.wpfClient.serverName = wpfClientServerInfo.name;
      remotePublishConfig.wpfClient.serverOs = wpfClientServerInfo.os;
      remotePublishConfig.wpfClient.serverIp = wpfClientServerInfo.ip;
      remotePublishConfig.wpfClient.serverPort = wpfClientServerInfo.port;
      remotePublishConfig.wpfClient.serverAccount = wpfClientServerInfo.account;
      remotePublishConfig.wpfClient.serverPwd = await aesEncrypt(wpfClientServerInfo.pwd);
    }
    remotePublishConfig.wpfClient.publishPath = String(
      state.ruleForm.configItems.wpfClient.serverPath
    );
    remotePublishConfig.wpfClient.publishFiles = [];
    if (state.ruleForm.configItems.wpfClient.generateDirJson) {
      let generateDirArr = JSON.parse(
        state.ruleForm.configItems.wpfClient.generateDirJson
      );
      for (let i = 0; i < generateDirArr.length; i++) {
        const generateDir = generateDirArr[i];
        const wpfFiles = await getReadAllDlls(`${rPublishDir}/WpfClient/${generateDir}`);
        let pFiles = new Array<string>();
        for (let k = 0; k < wpfFiles.length; k++) {
          const wpfFilesFile = wpfFiles[k];
          if (!wpfFilesFile) continue;
          const pathFile = removeSlash(wpfFilesFile);
          pFiles.push(pathFile.substring(pathFile.lastIndexOf("/") + 1));
        }
        remotePublishConfig.wpfClient.publishFiles.push({
          dirName: generateDir,
          files: pFiles,
        });
      }
    }
  }

  // 得到发布信息
  if (tfsData.value) {
    let notesResult = await outPublishContents(tfsData.value, rPublishDir);
    if (notesResult.code === 0) remotePublishConfig.notes = notesResult.data;
  }

  // 保存发布配置
  const filePath = `${rPublishDir}/publish.config.json`;
  const saveResult = await cmdInvoke("save_content_to_file", {
    content: JSON.stringify(remotePublishConfig, null, 2),
    filePath,
  });
  if (saveResult.code !== 0) {
    ElMessage.error(`保存发布配置信息失败：${saveResult.data}`);
    return false;
  }
  zipFilePaths.push(filePath);

  // 压缩发布配置
  const pMode = publishMode.value === 0 ? "远程发布" : "本机发布";
  const zipFileName = `${state.ruleForm.projectName}_${displayEnvironment(
    Number(state.ruleForm.environment)
  )}_${pMode}_${formatDate(new Date(), "YYYYmmddHHMMSS")}.smom`;
  const generateZipFilePath = `${removeSlash(tempRemotePublishDir)}/${zipFileName}`;
  const zipResult = await cmdInvoke("zip_dir", {
    srcDir: rPublishDir,
    dstFile: generateZipFilePath,
  });
  if (zipResult.code !== 0) {
    ElMessage.error(`压缩发布配置失败：${zipResult.data}`);
    return false;
  }

  // 删除临时发布目录
  await cmdInvoke("delete_paths", {
    paths: [rPublishDir],
  });

  // 打开保存文件对话框
  const saveFileDir = await open({
    directory: true,
    multiple: false,
    title: "保存发布文件",
  });
  if (!saveFileDir) {
    ElMessage.info("您已取消保存文件！");
  } else {
    const saveFilePath = `${saveFileDir}/${zipFileName}`;
    const moveResult = await cmdInvoke("move_file", {
      source: generateZipFilePath,
      destination: saveFilePath,
    });
    if (moveResult.code !== 0) {
      ElMessage.error(`保存发布文件失败：${moveResult.data}`);
      return false;
    }
  }
  return true;
};

// 复制Wpf应用程序集[文件]
const copyWpfAssemblyFile = async (
  outPath: string,
  clientPath: string,
  generateDirJson: string
) => {
  if (!generateDirJson) {
    ElMessage.error(`${wpfClientName.value} 未选择[生成的目录]，请检查.`);
    return false;
  }

  try {
    let dllModeDateRange = getDllModeDateRange();
    let generateDirArr = JSON.parse(generateDirJson);
    for (let i = 0; i < generateDirArr.length; i++) {
      const generateDir = generateDirArr[i];
      // 验证目录是否存在
      const dirPath = `${removeSlash(clientPath)}/${generateDir}`;
      const dirPathExists = await cmdInvoke("exists", { path: dirPath });
      if (dirPathExists.code !== 0) {
        ElMessage.error(`${generateDir}目录不存在，请检查路径或编译项目试试.`);
        return false;
      }

      // 复制目录
      let copyResult = {
        code: 0,
        msg: "success",
        data: null,
      };
      const toGenerateDir = `${removeSlash(outPath)}/${generateDir}`;
      await createDir(toGenerateDir);

      if (state.ruleForm.dllMode == "TFS") {
        if (!state.ruleForm.dllModeValue) {
          ElMessage.error(`未配置TFS获取程序集的相关信息，请检查.`);
          return false;
        }
        const selectTfsItem = JSON.parse(state.ruleForm.dllModeValue) as SelectTfsType;
        const tfsDllFiles = await getTfsDllFiles(selectTfsItem);
        if (!tfsDllFiles || tfsDllFiles.length < 1) return false;

        for (let j = 0; j < tfsDllFiles.length; j++) {
          const tfsDllFile = tfsDllFiles[j];
          const clientPath = removeSlash(dirPath);
          copyResult = await cmdInvoke("copy_path", {
            source: `${clientPath}/${tfsDllFile}`,
            destination: `${toGenerateDir}/${tfsDllFile}`,
          });
          if (copyResult.code !== 0) break;
        }
      } else if (state.ruleForm.dllMode == "Git") {
        if (!state.ruleForm.dllModeValue) {
          ElMessage.error(`未配置Git获取程序集的相关信息，请检查.`);
          return false;
        }
        const selectGitItem = JSON.parse(state.ruleForm.dllModeValue) as SelectGitType;
        const gitDllFiles = await getGitDllFiles(selectGitItem);
        if (!gitDllFiles || gitDllFiles.length < 1) return false;

        for (let j = 0; j < gitDllFiles.length; j++) {
          const gitDllFile = gitDllFiles[j];
          const clientPath = removeSlash(dirPath);
          copyResult = await cmdInvoke("copy_path", {
            source: `${clientPath}/${gitDllFile}`,
            destination: `${toGenerateDir}/${gitDllFile}`,
          });
          if (copyResult.code !== 0) break;
        }
      } else if (state.ruleForm.dllMode == "DLL名称") {
        const patterns = getDllModePatterns();
        if (!patterns) {
          ElMessage.error(`未配置DLL名称获取程序集的相关信息，请检查.`);
          return false;
        }
        copyResult = await cmdInvoke("copy_dll_files_by_name", {
          source: dirPath,
          destination: `${outPath}/${generateDir}`,
          patterns: patterns,
        });
      } else {
        if (dllModeDateRange.length < 1) {
          copyResult = await cmdInvoke("copy_path", {
            source: dirPath,
            destination: `${outPath}/${generateDir}`,
          });
        } else {
          copyResult = await cmdInvoke("copy_path_by_time", {
            source: dirPath,
            destination: `${outPath}/${generateDir}`,
            startTime: dllModeDateRange[0],
            endTime: dllModeDateRange[1],
          });
        }
      }

      if (copyResult.code !== 0) {
        ElMessage.error(`复制[${generateDir}]失败：${copyResult.data}`);
        return false;
      }
    }
  } catch (error) {
    ElMessage.error(`获取程序集 ${wpfClientName.value} 出错：${JSON.stringify(error)}`);
    return false;
  }
  return true;
};

// 复制应用程序集[文件]
const copyAssemblyFile = async (
  appTypeName: "WebApiHost" | "ScheduleServer" | "WebClient" | "SpcMonitor",
  outPath: string,
  clientPath: string
) => {
  try {
    let copyResult = {
      code: 0,
      msg: "success",
      data: null,
    };
    console.log('dhaishdiashd')
    if (state.ruleForm.dllMode == "TFS") {
      if (!state.ruleForm.dllModeValue) {
        ElMessage.error(`未配置TFS获取程序集的相关信息，请检查.`);
        return false;
      }
      const selectTfsItem = JSON.parse(state.ruleForm.dllModeValue) as SelectTfsType;
      const tfsDllFiles = await getTfsDllFiles(selectTfsItem);
      if (!tfsDllFiles || tfsDllFiles.length < 1) return false;
      for (let o = 0; o < tfsDllFiles.length; o++) {
        const tfsDllFile = tfsDllFiles[o];
        copyResult = await cmdInvoke("copy_path", {
          source: `${clientPath}/${tfsDllFile}`,
          destination: `${removeSlash(outPath)}/${tfsDllFile}`,
        });
        if (copyResult.code !== 0) break;
      }
    }
    else if (state.ruleForm.dllMode == "Git") {
      if (!state.ruleForm.dllModeValue) {
        ElMessage.error(`未配置Git获取程序集的相关信息，请检查.`);
        return false;
      }
      console.log('bushibagemen')
      const selectGitItem = JSON.parse(state.ruleForm.dllModeValue) as SelectGitType;
      const tfsDllFiles = await getGitDllFiles(selectGitItem);
      if (!tfsDllFiles || tfsDllFiles.length < 1) return false;
      for (let o = 0; o < tfsDllFiles.length; o++) {
        const tfsDllFile = tfsDllFiles[o];
        copyResult = await cmdInvoke("copy_path", {
          source: `${clientPath}/${tfsDllFile}`,
          destination: `${removeSlash(outPath)}/${tfsDllFile}`,
        });
        if (copyResult.code !== 0) break;
      }
    }
    else if (state.ruleForm.dllMode == "DLL名称") {
      const patterns = getDllModePatterns();
      if (!patterns) {
        ElMessage.error(`未配置DLL名称获取程序集的相关信息，请检查.`);
        return false;
      }
      copyResult = await cmdInvoke("copy_dll_files_by_name", {
        source: clientPath,
        destination: outPath,
        patterns: patterns,
      });
    }
    else {
      let dllModeDateRange = getDllModeDateRange();
      if (dllModeDateRange.length < 1) {
        copyResult = await cmdInvoke("copy_dll_files", {
          source: clientPath,
          destination: outPath,
          delDestination: true,
        });
      } else {
        copyResult = await cmdInvoke("copy_dll_files_by_time", {
          source: clientPath,
          destination: outPath,
          delDestination: true,
          startTime: dllModeDateRange[0],
          endTime: dllModeDateRange[1],
        });
      }
    }
    if (copyResult.code !== 0) {
      ElMessage.error(`获取程序集 ${appTypeName} 失败：${copyResult.data}`);
      return false;
    }
  } catch (error) {
    ElMessage.error(`获取程序集 ${appTypeName} 出错：${JSON.stringify(error)}`);
    return false;
  }
  return true;
};

// 获取Dll日期范围
const getDllModeDateRange = () => {
  let startDate = "";
  let endDate = "";
  if (state.ruleForm.dllMode == "当天") {
    startDate = formatDate(new Date(), "YYYY-mm-dd 00:00:00");
    endDate = formatDate(new Date(), "YYYY-mm-dd 23:59:59");
  }
  if (state.ruleForm.dllMode == "最近3天") {
    const threeDaysAgo = new Date(new Date().getTime() - 3 * 24 * 60 * 60 * 1000);
    startDate = formatDate(threeDaysAgo, "YYYY-mm-dd 00:00:00");
    endDate = formatDate(new Date(), "YYYY-mm-dd 23:59:59");
  }
  if (state.ruleForm.dllMode == "日期范围") {
    const modeDates = JSON.parse(String(state.ruleForm.dllModeValue));
    startDate = modeDates[0];
    endDate = modeDates[1];
  }
  if (!startDate || !endDate) return [];
  return [startDate, endDate];
};

// 获取DLL名称模式
const getDllModePatterns = () => {
  if (state.ruleForm.dllMode == "DLL名称") {
    return String(state.ruleForm.dllModeValue || "");
  }
  return "";
};

// 查询服务信息
const getServerDetail = async (id: number) => {
  let dataResult = await serverDb.getServerById(id);
  if (dataResult.code !== 0) {
    ElMessage.error(dataResult.msg);
    return null;
  }
  return dataResult.data.data;
};

// 创建目录
const createDir = async (path: string) => {
  const pathExists = await cmdInvoke("exists", { path });
  if (pathExists.code === 0) {
    await cmdInvoke("delete_paths", {
      paths: [path],
    });
  }
  return await cmdInvoke("create_dir", { path });
};

// 查询项目信息
const getProjectList = async () => {
  let dataResult = await projectDb.getProjectList({
    code: null,
    name: null,
    sorting: "id DESC",
    skipCount: 0,
    maxResultCount: 1000,
  });
  if (dataResult.code !== 0) {
    ElMessage.error(dataResult.msg);
    return;
  }
  projectList.value = dataResult.data.data;
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
.form-item-env {
  width: 100%;
  margin: 15px 0px;
  text-align: center;
  background-color: #fbfbfb;
  padding: 10px;
}

.reset-app-assembly {
  margin-left: 30px;
}

.server-path-plus {
  text-align: center;
  cursor: pointer;
  align-content: center;
  height: 32px;
  padding-top: 4px;
}

.form-server-fieldset {
  width: 100%;
  border: 1px #dcdfe6 solid;
  padding-top: 8px;
  padding-left: 10px;
  padding-bottom: 10px;
  margin-top: 10px;
}

.form-server-legend {
  padding: 0px 5px;
  margin-left: 15px;
}

.form-select-file {
  text-align: center;
  display: block;
  width: 100%;
  margin: 0px 5px;
  background-color: #fbfbfb;
  height: 32px;
  line-height: 37px;
  cursor: pointer;
}

.range-separator {
  text-align: center;
  height: 32px;
  line-height: 32px;
}

.form-server-btn {
  display: flex;
  justify-content: center;
  margin-top: 10px;
}
</style>

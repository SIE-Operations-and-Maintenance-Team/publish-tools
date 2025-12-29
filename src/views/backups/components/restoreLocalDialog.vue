<template>
  <div class="restore-container">
    <el-dialog
      v-model="state.dialog.show"
      :close-on-click-modal="false"
      :show-close="false"
      center
      modal-class="restore-dialog"
      draggable
      width="680px"
    >
      <template #header> </template>
      <div class="restore-item-box">
        <div class="publish-card-item">
          <div class="card-item-box">
            <div class="card-title">
              <el-row>
                <el-col :span="12">{{ state.dialog.title }}</el-col>
                <el-col :span="12">
                  <div class="refresh-btn">
                    <el-button
                      title="清空日志"
                      size="small"
                      text
                      :icon="CircleClose"
                      @click="onRemoveLogs"
                    ></el-button></div
                ></el-col>
              </el-row>
            </div>
            <div
              ref="restoreLocalLogContentRef"
              class="card-item-content restore-log-content"
            >
              <p v-for="log in logPrintInfo" :class="log.type">
                {{ log.content.value }}
                <el-text
                  :type="
                    log.content.uploadFile.currNumber >=
                    log.content.uploadFile.totalNumber
                      ? 'primary'
                      : 'warning'
                  "
                  size="small"
                  v-if="log.content.uploadFile && log.content.uploadFile.totalNumber > 0"
                  >{{ log.content.uploadFile.prefix
                  }}{{ log.content.uploadFile.currNumber }}/{{
                    log.content.uploadFile.totalNumber
                  }}
                  个文件。</el-text
                >
              </p>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button
            @click="onCancel"
            size="default"
            :disabled="state.dialog.submitTxt === '还原中'"
            >取 消</el-button
          >
          <el-button
            v-if="state.dialog.type !== 'viewer'"
            type="primary"
            @click="onRestore"
            size="default"
            :loading="state.dialog.submitTxt === '还原中'"
            >{{ state.dialog.submitTxt }}</el-button
          >
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="restoreLocalDialog">
import { ref, nextTick, reactive } from "vue";
import { CircleClose } from "@element-plus/icons-vue";
import _ from "lodash";
import { cmdInvoke } from "@/utils/command";
import {
  getDefaultSubObject,
  displayOs,
  removeSlash,
  displayEnvironment,
} from "@/utils/other";
import { useRestoreDb } from "@/database/restore/index";
import { formatDate } from "@/utils/formatTime";
import { ElMessage } from "element-plus";

// 定义子组件向父组件传值/事件
const emit = defineEmits(["refresh"]);

// 引入项目管理数据库
const restoreDb = useRestoreDb();

// 定义变量内容
const logPrintInfo = ref<LogPrintType[]>([]);
const restoreLocalLogContentRef = ref();
const state = reactive<FormDialogType<BackupLocalPublishType>>({
  ruleForm: {
    projectName: "",
    environment: 0,
    publishMode: 0,
    webApiHost: null,
    webClient: null,
    scheduleServer: null,
    spcMonitor: null,
    wpfClient: null,
    isNewVersion: false,
  },
  dialog: {
    show: false,
    type: "edit",
    editId: null,
    title: "还原服务",
    submitTxt: "还 原",
  },
});

// 还原
const onRestore = async () => {
  if (!state.ruleForm.projectName) return;
  state.dialog.submitTxt = "还原中";
  onRemoveLogs();
  printInfoLog("项目名称：" + state.ruleForm.projectName);
  printInfoLog("项目环境：" + displayEnvironment(Number(state.ruleForm.environment)));
  printInfoLog("");

  // 还原结果
  let restoreResult = true;

  // 还原[WebApiHost]
  restoreResult = await restoreLocalServer("WebApiHost", state.ruleForm.webApiHost);

  // 还原[ScheduleServer]
  if (restoreResult) {
    restoreResult = await restoreLocalServer(
      "ScheduleServer",
      state.ruleForm.scheduleServer
    );
  }

  // 还原[WebClient]
  if (restoreResult) {
    restoreResult = await restoreLocalServer("WebClient", state.ruleForm.webClient);
  }

  // 还原[SpcMonitor]
  if (restoreResult) {
    restoreResult = await restoreLocalServer("SpcMonitor", state.ruleForm.spcMonitor);
  }

  // 还原[WpfClient]
  if (restoreResult) {
    restoreResult = await restoreLocalWpfServer(
      "WpfClient",
      state.ruleForm.wpfClient,
      state.ruleForm.isNewVersion
    );
  }

  printInfoLog("");
  state.dialog.submitTxt = "还 原";
  let restoreData: RowRestoreType = {
    id: null,
    backupId: Number(state.dialog.editId),
    restoreDate: formatDate(new Date(), "YYYY-mm-dd HH:MM:SS"),
    result: restoreResult ? 1 : 0,
    logContent: JSON.stringify(logPrintInfo.value),
  };
  let insertResult = await restoreDb.insertRestore(restoreData);
  if (insertResult.code !== 0) {
    ElMessage.error(insertResult.msg);
  }
};

const restoreLocalServer = async (
  serviceName: string,
  restoreServer: BackupPublishServerType | null
) => {
  if (!restoreServer || !restoreServer.serverOs) return true;
  printInfoLog(`正在还原 ${serviceName} 服务.`);
  const osName = displayOs(Number(restoreServer.serverOs));

  for (let j = 0; j < restoreServer.serverConfigs.length; j++) {
    const serverConfig = restoreServer.serverConfigs[j];
    const serviceIdentity = serverConfig.serverIdentity;
    const pPath = removeSlash(serverConfig.publishPath);
    const rPath = removeSlash(serverConfig.backupPath);
    let closeServiceResult = true;
    printInfoLog(`关闭 ${serviceName} 服务中...`);

    if (osName === "Windows") {
      closeServiceResult = await switchWinService(serviceIdentity, "stop");
    } else {
      closeServiceResult = await switchDockerService(serviceIdentity, "stop");
    }
    if (!closeServiceResult) {
      printInfoLog(`服务 ${serviceName} 关闭失败.`, "log-error");
      state.dialog.submitTxt = "还 原";
      return false;
    }
    printInfoLog(`服务 ${serviceName} 已关闭.`, "log-success");
    printInfoLog(`服务 ${serviceName} 还原中.`);
    for (let cp = 0; cp < serverConfig.publishFiles.length; cp++) {
      const dllFile = serverConfig.publishFiles[cp];
      const source = `${rPath}/${dllFile}`;
      const destination = `${pPath}/${dllFile}`;
      const copyResult = await cmdInvoke("copy_path", {
        source,
        destination,
      });
      if (copyResult.code !== 0) {
        printInfoLog(`服务 ${serviceName} 复制失败：${copyResult.data}`, "log-error");
        console.error(copyResult.data);
        state.dialog.submitTxt = "还 原";
        return false;
      }
    }
    printInfoLog(
      `已成功将  ${serviceName} 服务的${serverConfig.publishFiles.length}个备份文件还原到部署路径.`,
      "log-success"
    );
    printInfoLog(`服务 ${serviceName} 正在启动.`);
    let startServiceResult = true;
    if (osName === "Windows") {
      startServiceResult = await switchWinService(serviceIdentity, "start");
    } else {
      startServiceResult = await switchDockerService(serviceIdentity, "start");
    }
    if (!startServiceResult) {
      printInfoLog(`服务 ${serviceName} 启动失败.`, "log-error");
      return false;
    }
    printInfoLog(`服务 ${serviceName} 还原成功.`, "log-success");
    printInfoLog("");
  }
  return true;
};

// 远程Wpf服务还原
const restoreLocalWpfServer = async (
  serviceName: string,
  restoreServer: BackupPublishWpfType | null,
  isNewVersion: boolean | null = false
) => {
  if (!restoreServer || !restoreServer.serverName) return true;

  printInfoLog(`正在还原 ${serviceName} 服务.`);
  const pPath = removeSlash(restoreServer.publishPath);
  const rPath = removeSlash(restoreServer.backupPath);

  // 创建一个临时还原目录
  const tempRestoreDir = `${pPath}/tempRestore`;
  const execRestoreDirResult = await createDir(tempRestoreDir);
  if (!execRestoreDirResult) {
    printInfoLog(`服务 ${serviceName} 创建备份目录失败.`, "log-error");
    return false;
  }

  // 解压到临时还原目录
  let moduleNames = new Array<string>();
  let restoreFileMsg = new Array<string>();
  let unzipPluginsNum = 0;
  for (let bk = 0; bk < restoreServer.publishFiles.length; bk++) {
    const publishFile = restoreServer.publishFiles[bk];
    restoreFileMsg.push(`${publishFile.dirName}：${publishFile.files.length}个`);

    // 创建目录
    let tempRestoreDirPath, zipFileName;
    if (publishFile.dirName == "Domain" || publishFile.dirName == "UI") {
      tempRestoreDirPath = `${tempRestoreDir}/Plugins`;
      zipFileName = `Plugins.zip`;
      moduleNames.push("Plugins");
      unzipPluginsNum++;
    } else {
      tempRestoreDirPath = `${tempRestoreDir}/${publishFile.dirName}`;
      zipFileName = `${publishFile.dirName}.zip`;
      moduleNames.push(publishFile.dirName);
    }

    // 解压
    if (zipFileName != "Plugins.zip" || unzipPluginsNum == 1 || isNewVersion) {
      const execRestoreDirPathResult = await createDir(tempRestoreDirPath);
      if (!execRestoreDirPathResult) {
        printInfoLog(`服务 ${serviceName} 创建一个缓存目录失败.`, "log-error");
        return false;
      }

      const unzipFile = `${pPath}/${zipFileName}`;
      const unzipResult = await cmdInvoke("un_zip", {
        filePaths: [unzipFile],
        destination: tempRestoreDirPath,
      });
      if (unzipResult.code !== 0) {
        printInfoLog(`服务[${serviceName}]解压[${zipFileName}]失败：${unzipResult.data}`);
        return false;
      }
    }

    // 还原文件
    for (let m = 0; m < publishFile.files.length; m++) {
      const source = `${rPath}/${publishFile.dirName}/${publishFile.files[m]}`;
      let destination = `${tempRestoreDirPath}/${publishFile.dirName}/${publishFile.files[m]}`;
      if (
        isNewVersion &&
        (publishFile.dirName == "Plugins" || publishFile.dirName == "Lib")
      ) {
        destination = `${tempRestoreDirPath}/${publishFile.files[m]}`;
      }
      const execCopyResult = await cmdInvoke("copy_path", {
        source,
        destination,
      });
      if (execCopyResult.code !== 0) {
        printInfoLog(`服务[${serviceName}]还原失败：${execCopyResult.data}`);
        return false;
      }
    }
  }

  // 重新压缩
  moduleNames = _.uniq(moduleNames);
  for (let n = 0; n < moduleNames.length; n++) {
    const moduleName = moduleNames[n];
    const zipResult = await cmdInvoke("zip_dir", {
      srcDir: `${tempRestoreDir}/${moduleName}`,
      dstFile: `${pPath}/${moduleName}.zip`,
    });
    if (zipResult.code !== 0) {
      printInfoLog(`压缩发布配置失败：${zipResult.data}`, "log-error");
      return false;
    }

    // 更新版本号
    printInfoLog(`正在更新 ${moduleName} 模块版本号.`);
    const upgradePluginsVersionResult = await cmdInvoke("upgrade_module_version", {
      filePath: `${pPath}/Manifest.xml`,
      moduleName: moduleName,
    });
    if (upgradePluginsVersionResult.code !== 0) {
      printInfoLog(
        `更新 ${moduleName}.zip 版本号失败：${upgradePluginsVersionResult.data}.`,
        "log-error"
      );
      return false;
    }
    printInfoLog(`更新 ${moduleName} 模块版本成功.`, "log-success");
  }

  // 删除一个临时还原目录
  await cmdInvoke("delete_paths", {
    paths: [tempRestoreDir],
  });

  printInfoLog(
    `已成功将备份文件【${restoreFileMsg.join("、")}】还原到部署路径.`,
    "log-success"
  );

  printInfoLog(`服务 ${serviceName} 还原成功.`);
  printInfoLog("");

  return true;
};

// 切换Windows服务
const switchWinService = async (serviceName: string, action: "stop" | "start") => {
  const isStop = await isWinServiceStop(serviceName);
  if (action == "stop" && isStop) return true;
  if (action == "start" && !isStop) return true;
  const switchServerResult = await cmdInvoke("execute_local_command", {
    command: "net",
    args: [action, serviceName],
  });
  if (switchServerResult.code !== 0) printInfoLog(switchServerResult.data, "log-error");
  return switchServerResult.code === 0;
};

// 切换Docker服务
const switchDockerService = async (serviceName: string, action: "stop" | "start") => {
  const switchServerResult = await cmdInvoke("execute_local_command", {
    command: "docker",
    args: [action, serviceName],
  });
  if (switchServerResult.code !== 0) printInfoLog(switchServerResult.data, "log-error");
  return switchServerResult.code === 0;
};

// 验证[Windows]服务是否已关闭
const isWinServiceStop = async (serviceName: string) => {
  const invokeResult = await cmdInvoke<string>("execute_local_command", {
    command: "sc",
    args: ["query", serviceName],
  });
  if (invokeResult.data.includes("STOPPED")) {
    return true;
  }
  return false;
};

/**
 * 打印日志信息
 * @param content 日志内容
 * @param type：log-info、log-warning、log-error、log-success
 */
const printInfoLog = (
  content: string,
  type: "log-info" | "log-warning" | "log-error" | "log-success" = "log-info"
) => {
  let logContent = content
    ? `[${formatDate(new Date(), "YYYY-mm-dd HH:MM:SS")}] ${content}`
    : "　";
  let logInfo: LogPrintType = {
    type,
    content: {
      value: logContent,
      uploadFile: {
        currNumber: 0,
        totalNumber: 0,
      },
    },
  };
  logPrintInfo.value.push(logInfo);
  nextTick(() => {
    restoreLocalLogContentRef.value.scrollTop =
      restoreLocalLogContentRef.value.scrollHeight;
  });
  return logPrintInfo.value.length - 1;
};

// 清空日志
const onRemoveLogs = () => {
  logPrintInfo.value = [];
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

// 打开弹窗
const openDialog = (backupId: number, row: BackupLocalPublishType) => {
  /* Start: 重置表单内容 */
  state.ruleForm = getDefaultSubObject(state.ruleForm);
  state.dialog.editId = backupId;
  state.dialog.type = "edit";
  /* End: 重置表单内容 */
  nextTick(() => {
    state.ruleForm = row;
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
.restore-item-box {
  .publish-card-item {
    width: 100%;
    // height: 130px;
    border-radius: 4px;
    transition: all ease 0.3s;
    overflow: hidden;
    background: var(--el-color-white);
    color: var(--el-text-color-primary);
    border: 1px solid var(--next-border-color-light);
    .card-item-title {
      font-size: 20px;
      color: #506c88;
      text-align: center;
      height: 70px;
      line-height: 70px;
    }
    .card-title {
      padding: 12px 10px 10px 10px;
      height: 45px;
      font-size: 15px;
      border-bottom: 1px #dfdfdf dashed;
      .refresh-btn {
        width: 100%;
        text-align: right;
      }
    }
    .card-item-content {
      height: 260px;
      overflow-y: auto;
      padding: 10px;
      .card-item-env {
        width: 100%;
        text-align: center;
        background-color: #fbfbfb;
        padding: 10px 0px;
      }
      .card-item-appconfig {
        width: 100%;
        margin-top: 15px;
        .table-appconfig {
          width: 100%;
          border-collapse: collapse;
          tr {
            th {
              background-color: #fbfbfb;
              font-weight: 500;
              text-align: right;
              font-size: 14px;
              width: 110px;
              padding: 10px 5px;
              border: 1px solid #eeeeee;
            }
            td {
              font-size: 14px;
              text-align: left;
              padding: 0px 5px;
              border: 1px solid #eeeeee;
              word-wrap: break-word;
              word-break: break-all;
            }
          }
        }
      }
    }
    &:hover {
      box-shadow: 0 2px 12px var(--next-color-dark-hover);
      transition: all ease 0.3s;
    }
    &-icon {
      width: 70px;
      height: 70px;
      border-radius: 100%;
      flex-shrink: 1;
      i {
        color: var(--el-text-color-placeholder);
      }
    }
    .restore-log-content {
      background-color: #545c64;
      counter-reset: line-number;
      padding-right: 1em;
      text-align: left;
      // white-space: nowrap;
    }
  }
}
</style>

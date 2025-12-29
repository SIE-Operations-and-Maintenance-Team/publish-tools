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
              ref="restoreRemoteLogContentRef"
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

<script setup lang="ts" name="restoreRemoteDialog">
import { ref, nextTick, reactive } from "vue";
import { path } from "@tauri-apps/api";
import { CircleClose } from "@element-plus/icons-vue";
import _ from "lodash";
import { cmdInvoke } from "@/utils/command";
import {
  getDefaultSubObject,
  displayOs,
  removeSlash,
  displayEnvironment,
  aesDecrypt,
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
const restoreRemoteLogContentRef = ref();
const state = reactive<FormDialogType<BackupRemotePublishType>>({
  ruleForm: {
    projectName: "",
    environment: 0,
    publishMode: 0,
    webApiHost: [],
    webClient: [],
    scheduleServer: [],
    spcMonitor: [],
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
  restoreResult = await restoreRemoteServer("WebApiHost", state.ruleForm.webApiHost);

  // 还原[ScheduleServer]
  if (restoreResult) {
    restoreResult = await restoreRemoteServer(
      "ScheduleServer",
      state.ruleForm.scheduleServer
    );
  }

  // 还原[WebClient]
  if (restoreResult) {
    restoreResult = await restoreRemoteServer("WebClient", state.ruleForm.webClient);
  }

  // 还原[SpcMonitor]
  if (restoreResult) {
    restoreResult = await restoreRemoteServer("SpcMonitor", state.ruleForm.spcMonitor);
  }

  // 还原[WpfClient]
  if (restoreResult) {
    restoreResult = await restoreRemoteWpfServer(
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

const restoreRemoteServer = async (
  serviceName: string,
  restoreServers: BackupPublishServerType[] | null
) => {
  if (!restoreServers || restoreServers.length < 1) return true;
  printInfoLog(`正在还原 ${serviceName} 服务.`);
  for (let i = 0; i < restoreServers.length; i++) {
    const restoreServer = restoreServers[i];
    const osName = displayOs(Number(restoreServer.serverOs));
    const username = String(restoreServer.serverAccount);
    const password = await aesDecrypt(String(restoreServer.serverPwd));

    const server = `${restoreServer.serverIp}:${restoreServer.serverPort}`;
    for (let j = 0; j < restoreServer.serverConfigs.length; j++) {
      const serverConfig = restoreServer.serverConfigs[j];
      const serviceIdentity = serverConfig.serverIdentity;
      const pPath = removeSlash(serverConfig.publishPath);
      const rPath = removeSlash(serverConfig.backupPath);
      let copyBackFileCommands = new Array<string>();
      let closeServiceResult = true;
      printInfoLog(`关闭 ${serviceName} 服务中...`);
      if (osName === "Windows") {
        closeServiceResult = await switchWinService(
          username,
          password,
          server,
          serviceIdentity,
          "stop"
        );
        for (let bf = 0; bf < serverConfig.publishFiles.length; bf++) {
          const dllFile = serverConfig.publishFiles[bf];
          const copyFile = `${rPath}\\${dllFile}`;
          copyBackFileCommands.push(
            `if exist "${copyFile}" copy "${copyFile}" "${pPath}\\${dllFile}"`.replace(
              /\//g,
              "\\"
            ) + " /Y"
          );
        }
      } else {
        closeServiceResult = await switchDockerService(
          username,
          password,
          server,
          serviceIdentity,
          "stop"
        );
        for (let bf = 0; bf < serverConfig.publishFiles.length; bf++) {
          const dllFile = serverConfig.publishFiles[bf];
          const copyFile = `${rPath}/${dllFile}`;
          copyBackFileCommands.push(
            `[ -e "${copyFile}" ] && cp ${copyFile} ${pPath}/${dllFile}`
          );
        }
      }
      if (!closeServiceResult) {
        printInfoLog(`服务 ${serviceName} 关闭失败.`, "log-error");
        state.dialog.submitTxt = "还 原";
        return false;
      }
      printInfoLog(`服务 ${serviceName} 已关闭.`, "log-success");
      printInfoLog(`服务 ${serviceName} 还原中.`);
      for (let cp = 0; cp < copyBackFileCommands.length; cp++) {
        const copyCommand = copyBackFileCommands[cp];
        const execRemoteCmdResult = await cmdInvoke("execute_remote_command", {
          username,
          password,
          server,
          command: copyCommand,
        });
        if (execRemoteCmdResult.code !== 0) {
          printInfoLog(
            `服务 ${serviceName} 还原失败：${execRemoteCmdResult.data}`,
            "log-error"
          );
          console.error(execRemoteCmdResult.data);
          state.dialog.submitTxt = "还 原";
          return false;
        }
      }
      printInfoLog(
        `已成功将  ${serviceName} 服务的${copyBackFileCommands.length}个备份文件还原到部署路径.`,
        "log-success"
      );
      printInfoLog(`服务 ${serviceName} 正在启动.`);
      let startServiceResult = true;
      if (osName === "Windows") {
        startServiceResult = await switchWinService(
          username,
          password,
          server,
          serviceIdentity,
          "start"
        );
      } else {
        startServiceResult = await switchDockerService(
          username,
          password,
          server,
          serviceIdentity,
          "start"
        );
      }
      if (!startServiceResult) {
        printInfoLog(`服务 ${serviceName} 启动失败.`, "log-error");
        return false;
      }
      printInfoLog(`服务 ${serviceName} 还原成功.`, "log-success");
      printInfoLog("");
    }
  }
  return true;
};

// 远程Wpf服务还原
const restoreRemoteWpfServer = async (
  serviceName: string,
  restoreServer: BackupPublishWpfType | null,
  isNewVersion: boolean | null = false
) => {
  if (!restoreServer || !restoreServer.serverName) return true;

  printInfoLog(`正在还原 ${serviceName} 服务.`);
  const osName = displayOs(Number(restoreServer.serverOs));
  const username = restoreServer.serverAccount;
  const password = await aesDecrypt(String(restoreServer.serverPwd));
  const server = `${restoreServer.serverIp}:${restoreServer.serverPort}`;

  const pPath = removeSlash(restoreServer.publishPath);
  const rPath = removeSlash(restoreServer.backupPath);

  // 创建一个临时还原目录
  const tempRestoreDir = `${pPath}/tempRestore`;
  let tempRestoreDirCmd;
  if (osName == "Windows") {
    tempRestoreDirCmd = `if not exist "${tempRestoreDir}" mkdir "${tempRestoreDir}"`;
    tempRestoreDirCmd = tempRestoreDirCmd.replace(/\//g, "\\");
  } else {
    tempRestoreDirCmd = `mkdir -p ${tempRestoreDir}`;
  }
  await cmdInvoke("execute_remote_command", {
    username,
    password,
    server,
    command: tempRestoreDirCmd,
  });

  // 解压到临时还原目录
  let zipCmds = new Array<string>();
  let moduleNames = new Array<string>();
  let restoreFileMsg = new Array<string>();
  let unzipPluginsNum = 0;
  for (let bk = 0; bk < restoreServer.publishFiles.length; bk++) {
    const publishFile = restoreServer.publishFiles[bk];
    restoreFileMsg.push(`${publishFile.dirName}：${publishFile.files.length}个`);
    // 创建目录
    let createBkDirCmd, zipFileName, tempRestoreDirPath, zipCmd;
    if (publishFile.dirName == "Domain" || publishFile.dirName == "UI") {
      tempRestoreDirPath = `${tempRestoreDir}/Plugins`;
      zipFileName = `Plugins.zip`;

      if (osName == "Windows") {
        createBkDirCmd = `if not exist "${tempRestoreDirPath}" mkdir "${tempRestoreDirPath}"`;
        createBkDirCmd = createBkDirCmd.replace(/\//g, "\\");
        zipCmd = `cd ${tempRestoreDirPath} && tar -acf "${pPath}/${zipFileName}" Domain UI`;
        zipCmd = zipCmd.replace(/\//g, "\\").replace("cd", "cd /d");
      } else {
        createBkDirCmd = `mkdir -p ${tempRestoreDirPath}`;
        zipCmd = `cd ${tempRestoreDirPath} && zip -r ${pPath}/${zipFileName} Domain UI`;
      }

      moduleNames.push("Plugins");
      unzipPluginsNum++;
    } else {
      tempRestoreDirPath = `${tempRestoreDir}/${publishFile.dirName}`;
      zipFileName = `${publishFile.dirName}.zip`;

      if (osName == "Windows") {
        createBkDirCmd = `if not exist "${tempRestoreDirPath}" mkdir "${tempRestoreDirPath}"`;
        createBkDirCmd = createBkDirCmd.replace(/\//g, "\\");
        zipCmd = `cd ${tempRestoreDirPath} && tar -acf "${pPath}/${zipFileName}" ${publishFile.dirName}`;

        if (
          isNewVersion &&
          (publishFile.dirName == "Plugins" || publishFile.dirName == "Lib")
        ) {
          zipCmd = `cd ${tempRestoreDir} && tar -acf "${pPath}/${zipFileName}" ${publishFile.dirName}`;
        }

        zipCmd = zipCmd.replace(/\//g, "\\").replace("cd", "cd /d");
      } else {
        createBkDirCmd = `mkdir -p "${tempRestoreDirPath}"`;

        zipCmd = `cd ${tempRestoreDirPath} && zip -r ${pPath}/${zipFileName} ${publishFile.dirName}`;
        if (
          isNewVersion &&
          (publishFile.dirName == "Plugins" || publishFile.dirName == "Lib")
        ) {
          zipCmd = `cd ${tempRestoreDir} && zip -r ${pPath}/${zipFileName} ${publishFile.dirName}`;
        }
      }

      moduleNames.push(publishFile.dirName);
    }
    zipCmds.push(zipCmd);

    if (zipFileName != "Plugins.zip" || unzipPluginsNum == 1 || isNewVersion) {
      await cmdInvoke("execute_remote_command", {
        username,
        password,
        server,
        command: createBkDirCmd,
      });
    }

    let unZipCmd;
    let copyCmds = new Array<string>();
    if (osName === "Windows") {
      unZipCmd = `tar -xf "${pPath}/${zipFileName}" -C "${tempRestoreDirPath}"`;
      if (
        isNewVersion &&
        (publishFile.dirName == "Plugins" || publishFile.dirName == "Lib")
      ) {
        unZipCmd = `tar -xf "${pPath}/${zipFileName}" -C "${removeSlash(
          tempRestoreDir
        )}/${publishFile.dirName}"`;
      }

      unZipCmd = unZipCmd.replace(/\//g, "\\");
      for (let m = 0; m < publishFile.files.length; m++) {
        const copyFile = `${rPath}/${publishFile.dirName}/${publishFile.files[m]}`;

        let cDirName = `/${publishFile.dirName}`;
        if (
          isNewVersion &&
          (publishFile.dirName == "Plugins" || publishFile.dirName == "Lib")
        ) {
          cDirName = "";
        }

        let copyCmd = `if exist "${copyFile}" copy "${copyFile}" "${tempRestoreDirPath}${cDirName}/${publishFile.files[m]}"`;
        copyCmds.push(copyCmd.replace(/\//g, "\\") + " /Y");
      }
    } else {
      unZipCmd = `unzip -o ${pPath}/${zipFileName} -d ${tempRestoreDirPath}`;
      if (
        isNewVersion &&
        (publishFile.dirName == "Plugins" || publishFile.dirName == "Lib")
      ) {
        unZipCmd = `unzip -o ${pPath}/${zipFileName} -d ${removeSlash(tempRestoreDir)}/${
          publishFile.dirName
        }`;
      }

      for (let m = 0; m < publishFile.files.length; m++) {
        const copyFile = `${rPath}/${publishFile.dirName}/${publishFile.files[m]}`;

        let cDirName = `/${publishFile.dirName}`;
        if (
          isNewVersion &&
          (publishFile.dirName == "Plugins" || publishFile.dirName == "Lib")
        ) {
          cDirName = "";
        }

        let copyCmd = `[ -e "${copyFile}" ] && cp ${copyFile} ${tempRestoreDirPath}${cDirName}/${publishFile.files[m]}`;
        copyCmds.push(copyCmd);
      }
    }

    // 解压
    if (zipFileName != "Plugins.zip" || unzipPluginsNum == 1 || isNewVersion) {
      const unZipCmdResult = await cmdInvoke("execute_remote_command", {
        username,
        password,
        server,
        command: unZipCmd,
      });
      if (unZipCmdResult.code !== 0) {
        printInfoLog(
          `服务[${serviceName}]解压[${zipFileName}]失败：${unZipCmdResult.data}`,
          "log-error"
        );
        return false;
      }
    }

    // 还原文件
    for (let cp = 0; cp < copyCmds.length; cp++) {
      const execRemoteCmdResult = await cmdInvoke("execute_remote_command", {
        username,
        password,
        server,
        command: copyCmds[cp],
      });
      if (execRemoteCmdResult.code !== 0) {
        printInfoLog(
          `服务[${serviceName}]还原失败：${execRemoteCmdResult.data}`,
          "log-error"
        );
        return false;
      }
    }
  }

  // 重新压缩
  zipCmds = [...new Set(zipCmds)];
  for (let z = 0; z < zipCmds.length; z++) {
    const zipCmd = zipCmds[z];
    const execRemoteCmdResult = await cmdInvoke("execute_remote_command", {
      username,
      password,
      server,
      command: zipCmd,
    });
    if (execRemoteCmdResult.code !== 0) {
      printInfoLog(
        `服务[${serviceName}]压缩失败：${execRemoteCmdResult.data}`,
        "log-error"
      );
      return false;
    }
  }

  // 删除一个临时还原目录
  let delTempRestoreDirCmd;
  if (osName === "Windows") {
    const rmPath = tempRestoreDir.replace(/\//g, "\\");
    delTempRestoreDirCmd = `if exist "${rmPath}" rd /s /q "${rmPath}"`;
  } else {
    delTempRestoreDirCmd = `rm -rf ${tempRestoreDir}`;
  }
  const delTempRestoreDirResult = await cmdInvoke("execute_remote_command", {
    username,
    password,
    server,
    command: delTempRestoreDirCmd,
  });
  if (delTempRestoreDirResult.code !== 0) {
    printInfoLog(
      `服务[${serviceName}]删除临时还原目录失败：${delTempRestoreDirResult.data}`,
      "log-warning"
    );
  }
  printInfoLog(
    `已成功将备份文件【${restoreFileMsg.join("、")}】还原到部署路径.`,
    "log-success"
  );

  /* 更新版本号 */
  // 创建一个临时(上传)目录
  const tempUploadPath = removeSlash(`${await path.appLocalDataDir()}`);
  const tempUploadDir = `${tempUploadPath}/tempUpload`;
  const tempPublishDirExists = await cmdInvoke("exists", {
    path: tempUploadDir,
  });
  if (tempPublishDirExists.code === 0) {
    await cmdInvoke("delete_paths", {
      paths: [tempUploadDir],
    });
  }
  let createTempPathResult = await createDir(tempUploadDir);
  if (!createTempPathResult) {
    printInfoLog(`创建临时缓存目录失败：${tempUploadDir}`, "log-error");
    return false;
  }

  // 从服务器下载[Manifest.xml]
  let remoteManifestFile = `${pPath}/Manifest.xml`;
  let localManifestFile = `${tempUploadDir}/Manifest.xml`;
  const downloadServerFileResult = await cmdInvoke("download_server_files", {
    username,
    password,
    server,
    remotePaths: [remoteManifestFile],
    localPaths: [localManifestFile],
  });
  if (downloadServerFileResult.code !== 0) {
    printInfoLog(
      `获取远程服务文件失败：[${downloadServerFileResult.data}].`,
      "log-error"
    );
    return false;
  }
  // 升级版本号
  moduleNames = [...new Set(moduleNames)];
  for (let o = 0; o < moduleNames.length; o++) {
    const dirName = moduleNames[o];
    printInfoLog(`正在更新 ${dirName} 模块版本号.`);
    const upgradePluginsVersionResult = await cmdInvoke("upgrade_module_version", {
      filePath: localManifestFile,
      moduleName: dirName,
    });
    if (upgradePluginsVersionResult.code !== 0) {
      printInfoLog(
        `更新 ${dirName}.zip 版本号失败：${upgradePluginsVersionResult.data}.`,
        "log-error"
      );
      return false;
    }
    printInfoLog(`更新 ${dirName} 模块版本成功.`, "log-success");
  }

  // 将本地 Manifest.xml 上传到服务器
  printInfoLog("正在将 Manifest.xml 上传到服务器.");
  const uploadManifestFileResult = await cmdInvoke("upload_server_files", {
    localPaths: [localManifestFile],
    remotePaths: [remoteManifestFile],
    username,
    password,
    server,
  });
  if (uploadManifestFileResult.code !== 0) {
    printInfoLog(
      `文件 Manifest.xml 上传失败：${uploadManifestFileResult.data}.`,
      "log-error"
    );
    return false;
  }
  printInfoLog("已将 Manifest.xml 上传到服务器.", "log-success");
  // 删除 Manifest.xml 文件
  await cmdInvoke("delete_paths", {
    paths: [localManifestFile],
  });
  printInfoLog(`服务 ${serviceName} 还原成功.`);
  printInfoLog("");

  return true;
};

// 切换Windows服务
const switchWinService = async (
  username: string,
  password: string,
  server: string,
  serviceName: string,
  action: "stop" | "start"
) => {
  const isStop = await isWinServiceStop(username, password, server, serviceName);
  if (action == "stop" && isStop) return true;
  if (action == "start" && !isStop) return true;
  const switchServerResult = await cmdInvoke("execute_remote_command", {
    username,
    password,
    server,
    command: `net ${action} ${serviceName}`,
  });
  if (switchServerResult.code !== 0) printInfoLog(switchServerResult.data, "log-error");
  return switchServerResult.code === 0;
};

// 切换Docker服务
const switchDockerService = async (
  username: string,
  password: string,
  server: string,
  serviceName: string,
  action: "stop" | "start"
) => {
  const switchServerResult = await cmdInvoke("execute_remote_command", {
    username,
    password,
    server,
    command: `docker ${action} ${serviceName}`,
  });
  if (switchServerResult.code !== 0) printInfoLog(switchServerResult.data, "log-error");
  return switchServerResult.code === 0;
};

// 验证[Windows]服务是否已关闭
const isWinServiceStop = async (
  username: string,
  password: string,
  server: string,
  serviceName: string
) => {
  const invokeResult = await cmdInvoke<string>("execute_remote_command", {
    username,
    password,
    server,
    command: `sc query ${serviceName}`,
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
    restoreRemoteLogContentRef.value.scrollTop =
      restoreRemoteLogContentRef.value.scrollHeight;
  });
  return logPrintInfo.value.length - 1;
};

// 清空日志
const onRemoveLogs = async () => {
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
const openDialog = (backupId: number, row: BackupRemotePublishType) => {
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
      box-sizing: border-box;
      background-color: #545c64;
      counter-reset: line-number;
      padding-right: 1em;
      text-align: left;
      // white-space: nowrap;
    }
  }
}
</style>

<template>
  <div class="publish-container layout-pd">
    <el-row :gutter="15" class="publish-card-box mb15">
      <el-col
        :xs="24"
        :sm="24"
        :md="24"
        :lg="24"
        :xl="24"
        class="publish-media publish-media-lg"
      >
        <div
          class="publish-card-item publish-box"
          v-loading="publishItem.loading"
          :element-loading-text="publishItem.loadingText"
          @click="onSelectPublishFile"
        >
          <div
            class="publish-card-item-icon flex publish-bg-logo"
            :style="{ background: `var(--next-color-primary-lighter)` }"
          >
            <svg-icon
              class="flex-margin"
              :size="32"
              name="smom-icon smom-icon-xuanzefabu"
              color="var(--el-color-primary)"
            />
          </div>
          <div class="card-item-title">选择发布文件</div>
        </div>
      </el-col>
    </el-row>
    <el-row :gutter="15" class="publish-card-config">
      <el-col :xs="24" :sm="10" :md="10" :lg="12" :xl="8" class="publish-media">
        <div class="publish-card-item">
          <div class="card-item-box">
            <div class="card-title">
              <el-row>
                <el-col :span="24">发布信息</el-col>
              </el-row>
            </div>
            <div class="card-item-content">
              <el-empty
                :image-size="200"
                v-if="!publishConfig || !publishConfig.projectName"
              />
              <template v-else>
                <div class="card-item-appconfig">
                  <table class="table-appconfig mb15" cellpadding="0" cellspacing="0">
                    <tr>
                      <th>项目名称</th>
                      <td colspan="3">
                        {{ publishConfig.projectName }}
                      </td>
                    </tr>
                    <tr>
                      <th>项目环境</th>
                      <td>
                        {{ displayEnvironment(publishConfig.environment) }}
                      </td>
                      <th>发布方式</th>
                      <td>
                        {{ publishConfig.publishMode === 0 ? "远程发布" : "本机发布" }}
                      </td>
                    </tr>
                    <tr>
                      <th>生成时间</th>
                      <td>
                        {{ publishConfig.generateDate }}
                      </td>
                      <th>发布前备份</th>
                      <td>
                        <el-switch
                          v-model="publishConfig.isBackup"
                          :disabled="publishItem.loading"
                          :active-value="1"
                          :inactive-value="0"
                          inline-prompt
                          active-text="开启"
                          inactive-text="关闭"
                          size="default"
                        />
                      </td>
                    </tr>
                    <tr v-show="publishConfig.notes">
                      <th style="vertical-align: top">发布信息</th>
                      <td colspan="3">
                        <pre class="publish-content">{{ publishConfig.notes }}</pre>
                      </td>
                    </tr>
                  </table>
                  <remote-publish-item
                    v-if="publishConfig.publishMode === 0"
                    ref="remotePublishItemRef"
                    :data="remotePublishConfig"
                    :loading="publishItem.loading"
                  />
                  <local-publish-item
                    v-else-if="publishConfig.publishMode === 1"
                    ref="localPublishItemRef"
                    :data="localPublishConfig"
                    :loading="publishItem.loading"
                  />
                  <div class="card-publish-btn">
                    <el-affix position="bottom" :offset="20">
                      <el-button
                        type="primary"
                        plain
                        :icon="Promotion"
                        :disabled="publishItem.loading"
                        size="large"
                        @click="onPublish"
                        >发布</el-button
                      >
                    </el-affix>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="10" :md="10" :lg="12" :xl="8">
        <div class="publish-card-item">
          <div class="card-item-box">
            <div class="card-title">
              <el-row>
                <el-col :span="12">日志信息</el-col>
                <el-col :span="12">
                  <div class="item-btn-box">
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
            <div ref="mpLogContentRef" class="card-item-content mp-log-content">
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
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts" name="smomPapersPublish">
import { ref, reactive, onBeforeMount, defineAsyncComponent, nextTick } from "vue";
import { open } from "@tauri-apps/plugin-dialog";
import { path } from "@tauri-apps/api";
import { ElMessage } from "element-plus";
import _ from "lodash";
import { useBackupDb } from "@/database/backups/index";
import { formatDate } from "@/utils/formatTime";
import { CircleClose } from "@element-plus/icons-vue";
import { Promotion } from "@element-plus/icons-vue";
import { cmdInvoke } from "@/utils/command";
import { loadPublishSettings, getRetryArgs } from "@/utils/publishSettings";
import { removeSlash, displayEnvironment, displayOs, aesDecrypt } from "@/utils/other";

const SvgIcon = defineAsyncComponent(() => import("@/components/svgIcon/index.vue"));
const RemotePublishItem = defineAsyncComponent(
  () => import("@/views/papersPublish/components/remotePublishItem.vue")
);
const LocalPublishItem = defineAsyncComponent(
  () => import("@/views/papersPublish/components/localPublishItem.vue")
);

// 定义变量
const publishConfig = reactive({} as any);
const remotePublishConfig = ref<RemotePublishType>();
const localPublishConfig = ref<LocalPublishType>();
const mpLogContentRef = ref();
const logPrintInfo = ref<LogPrintType[]>([]);
const publishItem = ref({
  loading: false,
  loadingText: "发布中",
});

// 定义远程临时操作目录
const papersPublishDir = async () => {
  const tempPapersPublishDir = await path.appDataDir();
  return `${removeSlash(tempPapersPublishDir)}/tempPapersPublish`;
};

// 选择发布文件
const onSelectPublishFile = async () => {
  if (publishItem.value.loading) {
    ElMessage.info(`发布中，请稍后重试！`);
    return;
  }
  const selSmomFileResult = await open({
    multiple: false,
    filters: [
      {
        name: "SMOM发布文件",
        extensions: ["smom"],
      },
    ],
  });
  if (!selSmomFileResult) {
    console.warn("选择[SMOM发布文件]已取消！");
    return;
  }

  publishItem.value.loading = true;
  publishItem.value.loadingText = "解析中";

  // 创建一个临时操作目录
  const mPublishDir = await papersPublishDir();
  let createTempPathResult = await createDir(mPublishDir);
  if (!createTempPathResult) {
    ElMessage.error(`创建临时手动发布目录失败：${mPublishDir}`);
    publishItem.value.loading = false;
    return;
  }

  // 解压SMOM发布文件
  const smomPublishFile = removeSlash(String(selSmomFileResult));
  const smomUnzipResult = await cmdInvoke("un_zip", {
    filePaths: [smomPublishFile],
    destination: mPublishDir,
  });
  if (smomUnzipResult.code !== 0) {
    ElMessage.error(`解析[SMOM发布文件]失败：${smomUnzipResult.data}`);
    publishItem.value.loading = false;
    return;
  }

  // 读取SMOM发布文件中的配置文件
  const filePath = `${mPublishDir}/publish.config.json`;
  const readResult = await cmdInvoke("read_content_to_file", {
    filePath,
  });
  if (readResult.code !== 0) {
    ElMessage.error(`读取SMOM配置文件失败：${readResult.data}`);
    publishItem.value.loading = false;
    return;
  }
  let readPublishConfig = JSON.parse(readResult.data);
  Object.assign(publishConfig, readPublishConfig);
  switch (readPublishConfig.publishMode) {
    case 0: // 远程发布
      remotePublishConfig.value = readPublishConfig as RemotePublishType;
      break;
    case 1: // 本机发布
      localPublishConfig.value = readPublishConfig as LocalPublishType;
      break;
    default:
      ElMessage.error("SMOM配置文件异常，未解析到发布方式，请检查！");
      publishItem.value.loading = false;
      return;
  }
  ElMessage.success("解析[SMOM发布文件]成功！");
  publishItem.value.loading = false;
};

// 发布
const onPublish = async () => {
  if (publishItem.value.loading) {
    ElMessage.info(`发布中，请稍等！`);
    return;
  }
  publishItem.value.loading = true;
  publishItem.value.loadingText = "发布中";
  // 加载发布设置缓存（供后续 copy_path / 服务停止启动 调用点 getRetryArgs 使用）
  await loadPublishSettings();
  onRemoveLogs();
  initLogs();
  printInfoLog("");
  switch (publishConfig.publishMode) {
    case 0: // 远程发布
      await remoteServerPublish();
      break;
    case 1: // 本机发布
      await localServerPublish();
      break;
    default:
      ElMessage.error("SMOM配置文件异常，请检查！");
      break;
  }
  publishItem.value.loading = false;

  // 发布完成后删除临时操作目录
  const delPapersPublishDirPath = await papersPublishDir();
  await cmdInvoke("delete_paths", {
    paths: [delPapersPublishDirPath],
  });
};

// [本机]服务发布
const localServerPublish = async () => {
  if (!localPublishConfig.value) return;

  // 发布前备份
  if (publishConfig.isBackup == 1) {
    const backupResult = await localPublishBeforeBackup();
    if (!backupResult) return false;
  }

  // 发布 [WebApiHost] 服务
  if (
    localPublishConfig.value.webApiHost &&
    !_.isEmpty(localPublishConfig.value.webApiHost)
  ) {
    const publishWebApiResult = await localPublishServer(
      localPublishConfig.value.webApiHost,
      "WebApiHost"
    );
    if (!publishWebApiResult) {
      return false;
    }
  }

  // 发布 [ScheduleServer] 服务
  if (
    localPublishConfig.value.scheduleServer &&
    !_.isEmpty(localPublishConfig.value.scheduleServer)
  ) {
    const publishScheduleResult = await localPublishServer(
      localPublishConfig.value.scheduleServer,
      "ScheduleServer"
    );
    if (!publishScheduleResult) {
      return false;
    }
  }

  // 发布 [WpfClient] 服务
  if (
    localPublishConfig.value.wpfClient &&
    !_.isEmpty(localPublishConfig.value.wpfClient)
  ) {
    const publishWpfResult = await localPublishWpfServer(
      localPublishConfig.value.wpfClient,
      "WpfClient",
      localPublishConfig.value.isNewVersion
    );
    if (!publishWpfResult) {
      return false;
    }
  }

  // 发布 [SpcMonitor] 服务
  if (
    localPublishConfig.value.spcMonitor &&
    !_.isEmpty(localPublishConfig.value.spcMonitor)
  ) {
    const publishSpcResult = await localPublishServer(
      localPublishConfig.value.spcMonitor,
      "SpcMonitor"
    );
    if (!publishSpcResult) {
      return false;
    }
  }

  // 发布 [WebClient] 服务
  if (
    localPublishConfig.value.webClient &&
    !_.isEmpty(localPublishConfig.value.webClient)
  ) {
    const publishWebResult = await localPublishServer(
      localPublishConfig.value.webClient,
      "WebClient"
    );
    if (!publishWebResult) {
      return false;
    }
  }

  printInfoLog("发布成功！");
  return true;
};

// [本机]发布WPF服务
const localPublishWpfServer = async (
  publishServer: PublishWpfType,
  serverName: string,
  isNewVersion: boolean | null = false
) => {
  printInfoLog(`正在发布 ${serverName} 服务.`);
  const mPublishDir = await papersPublishDir();

  // 创建一个Wpf临时操作目录
  const wpfPublishDir = `${removeSlash(mPublishDir)}/${serverName}/tempPublish`;
  let createTempPathResult = await createDir(wpfPublishDir);
  if (!createTempPathResult) {
    printInfoLog(`创建一个Wpf临时操作目录失败：${wpfPublishDir}`, "log-error");
    return false;
  }

  // 从本机服务器复制文件到[临时缓存目录]
  let remoteFiles = [`${removeSlash(publishServer.publishPath)}/Manifest.xml`];
  for (let i = 0; i < publishServer.publishFiles.length; i++) {
    const publishFile = publishServer.publishFiles[i];
    if (publishFile.dirName == "Domain" || publishFile.dirName == "UI") {
      remoteFiles.push(`${removeSlash(publishServer.publishPath)}/Plugins.zip`);
      continue;
    }
    remoteFiles.push(
      `${removeSlash(publishServer.publishPath)}/${publishFile.dirName}.zip`
    );
  }
  remoteFiles = _.uniq(remoteFiles);
  let localFiles = new Array<string>();
  for (let i = 0; i < remoteFiles.length; i++) {
    const remoteFile = remoteFiles[i];
    const subStartIndex = remoteFile.lastIndexOf("/");
    const remoteFileName = remoteFile.substring(subStartIndex + 1);
    const localFile = `${wpfPublishDir}/${remoteFileName}`;
    localFiles.push(localFile);
    const copyServerFileResult = await cmdInvoke("copy_path", {
      source: remoteFile,
      destination: localFile,
      ...getRetryArgs("copy"),
    });

    if (copyServerFileResult.code !== 0) {
      printInfoLog(`复制本机服务文件失败：[${copyServerFileResult.data}].`, "log-error");
      return false;
    }
  }

  // 处理下载文件
  for (let i = 0; i < localFiles.length; i++) {
    const localFile = localFiles[i];
    const lastIndex = localFile.lastIndexOf("/");
    // 判断是否为zip文件
    const fileName = `${localFile.substring(lastIndex + 1)}`;
    if (!fileName.endsWith(".zip")) continue;

    // 进行解压
    printInfoLog(`正在获取 ${fileName} 发布文件.`);
    let unzipPath = removeSlash(`${localFile.substring(0, lastIndex + 1)}`);
    printInfoLog(`正在解压 ${fileName}.`);

    if (isNewVersion && (fileName === "Plugins.zip" || fileName === "Lib.zip")) {
      unzipPath = `${unzipPath}/${fileName.replace(".zip", "")}`;
    }
    const unzipResult = await cmdInvoke("un_zip", {
      filePaths: [localFile],
      destination: unzipPath,
    });

    if (unzipResult.code !== 0) {
      printInfoLog(`解压 ${fileName} 失败.`, "log-error");
      return false;
    }
    printInfoLog(`解压 ${fileName} 成功.`, "log-success");

    // 将压缩文件删除
    await cmdInvoke("delete_paths", {
      paths: [localFile],
    });

    // 将生成的文件复制到[临时发布目录]
    const dirName = fileName.replace(".zip", "");
    if (dirName == "Plugins" || dirName == "Lib") {
      const sourcePluginsPath = `${removeSlash(mPublishDir)}/${serverName}/Plugins`;
      const destinationPluginsPath = `${removeSlash(wpfPublishDir)}/Plugins`;
      const copyPluginsResult = await cmdInvoke("copy_path", {
        source: sourcePluginsPath,
        destination: destinationPluginsPath,
        ...getRetryArgs("copy"),
      });
      if (copyPluginsResult.code !== 0) {
        printInfoLog(`复制文件目录 ${sourcePluginsPath} 失败.`, "log-error");
        return false;
      }

      // 重新打包压缩
      const compressePluginsResult = await cmdInvoke("zip_dir", {
        srcDir: destinationPluginsPath,
        dstFile: `${removeSlash(wpfPublishDir)}/${dirName}.zip`,
      });
      if (compressePluginsResult.code !== 0) {
        printInfoLog(
          `压缩[${dirName}.zip]失败：${compressePluginsResult.data}.`,
          "log-error"
        );
        return false;
      }

      // 压缩成功后重新复制到服务器
      printInfoLog(
        `正在将 Plugins.zip 文件复制到 ${serverName.replace("服务器", "")} 服务器.`
      );
      const copyPluginsFileResult = await cmdInvoke("copy_path", {
        source: `${removeSlash(wpfPublishDir)}/Plugins.zip`,
        destination: `${removeSlash(publishServer.publishPath)}/Plugins.zip`,
        ...getRetryArgs("copy"),
      });
      if (copyPluginsFileResult.code !== 0) {
        printInfoLog(`文件 Plugins.zip 复制失败.`, "log-error");
        return false;
      }
      printInfoLog(
        `已将 Plugins.zip 文件复制到 ${serverName?.replace("服务器", "")}服务器.`,
        "log-success"
      );
    } else {
      let sourcePath = `${removeSlash(mPublishDir)}/${serverName}/${dirName}`;
      let destinationPath = `${removeSlash(wpfPublishDir)}/${dirName}`;
      const copyResult = await cmdInvoke("copy_path", {
        source: sourcePath,
        destination: destinationPath,
        ...getRetryArgs("copy"),
      });
      if (copyResult.code !== 0) {
        printInfoLog(`复制文件目录 ${sourcePath} 失败.`, "log-error");
        return false;
      }

      // 重新打包压缩
      printInfoLog(
        `正在将 ${dirName}.zip 文件复制到 ${serverName?.replace("服务器", "")}服务器.`
      );
      const compresseResult = await cmdInvoke("compress_zip", {
        filePaths: [destinationPath],
        dstFile: `${removeSlash(wpfPublishDir)}/${dirName}.zip`,
      });
      if (compresseResult.code !== 0) {
        printInfoLog(`压缩[${dirName}.zip]失败：${compresseResult.data}.`, "log-error");
        return false;
      }

      // 压缩成功后重新复制到服务器
      const copyFileResult = await cmdInvoke("copy_path", {
        source: `${removeSlash(wpfPublishDir)}/${dirName}.zip`,
        destination: `${removeSlash(publishServer.publishPath)}/${dirName}.zip`,
        ...getRetryArgs("copy"),
      });
      if (copyFileResult.code !== 0) {
        printInfoLog(`文件 ${dirName}.zip 上传失败.`, "log-error");
        return false;
      }
      printInfoLog(
        `已将 ${dirName}.zip 文件复制到 ${serverName?.replace("服务器", "")} 服务器.`,
        "log-success"
      );
    }

    // 升级版本号
    printInfoLog(`正在更新 ${dirName}.zip 版本号.`);
    const localManifestFile =
      removeSlash(localFile.substring(0, lastIndex + 1)) + "/Manifest.xml";
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
    printInfoLog(
      `已将 ${dirName}.zip 版本号更新为 ${upgradePluginsVersionResult.data}.`,
      "log-success"
    );

    // 将本机 Manifest.xml 上传到服务器
    const remoteManifestPath = `${removeSlash(publishServer.publishPath)}/Manifest.xml`;
    const copyManifestFileResult = await cmdInvoke("copy_path", {
      source: localManifestFile,
      destination: remoteManifestPath,
      ...getRetryArgs("copy"),
    });
    if (copyManifestFileResult.code !== 0) {
      printInfoLog(
        `文件 ${dirName}.zip 复制失败：${copyManifestFileResult.data}.`,
        "log-error"
      );
      return false;
    }
    printInfoLog(`已成功更新 ${dirName}.zip 版本号.`, "log-success");
  }

  // 发布成功，删除临时文件
  await cmdInvoke("delete_paths", {
    paths: [wpfPublishDir],
  });

  printInfoLog("");

  return true;
};

// [本机]发布服务
const localPublishServer = async (
  publishServer: PublishServerType,
  serverName: string
) => {
  if (!publishServer.serverOs) return true;

  printInfoLog(`正在发布 ${serverName} 服务.`);

  const mPublishDir = await papersPublishDir();
  // 服务器信息
  const osName = displayOs(Number(publishServer.serverOs));

  // 服务发布配置信息
  for (let j = 0; j < publishServer.serverConfigs.length; j++) {
    const serverConfig = publishServer.serverConfigs[j];
    /* 1.关闭服务 */
    printInfoLog(`正在关闭 ${serverName} 服务.`);
    let closeServiceResult;
    if (osName == "Windows") {
      closeServiceResult = await switchLocalWinService(
        serverConfig.serverIdentity,
        "stop"
      );
    } else if (osName == "Docker") {
      closeServiceResult = await switchLocalDockerService(
        serverConfig.serverIdentity,
        "stop"
      );
    } else {
      printInfoLog(`未找到 ${osName} 部署环境，请检查.`, "log-error");
      return false;
    }
    if (!closeServiceResult) {
      printInfoLog(`服务 ${serverName} 关闭失败.`, "log-error");
      return false;
    }
    printInfoLog(`服务 ${serverName} 已关闭.`, "log-success");

    /* 上传文件到服务器 */
    const currLogIndex = printInfoLog(`服务 ${serverName} 正在发布.`);
    let uploadFileNumber: UploadFileNumberType = {
      currNumber: 0,
      totalNumber: 0,
      prefix: "已替换：",
    };
    uploadFileNumber.totalNumber = serverConfig.publishFiles.length;
    for (let f = 0; f < serverConfig.publishFiles.length; f++) {
      const publishFile = serverConfig.publishFiles[f];

      const tempPublishFile = `${mPublishDir}/${serverName}/${publishFile}`;
      const toPublishFile = `${removeSlash(serverConfig.publishPath)}/${publishFile}`;
      const uploadServerFileResult = await cmdInvoke("copy_path", {
        source: tempPublishFile,
        destination: toPublishFile,
        ...getRetryArgs("copy"),
      });
      if (uploadServerFileResult.code !== 0) {
        printInfoLog(
          `服务 ${serverName} 发布失败：${uploadServerFileResult.data}.`,
          "log-error"
        );
        return false;
      }
      uploadFileNumber.currNumber++;
      logPrintInfo.value[currLogIndex].content.uploadFile.prefix =
        uploadFileNumber.prefix;
      logPrintInfo.value[currLogIndex].content.uploadFile.currNumber =
        uploadFileNumber.currNumber;
      logPrintInfo.value[currLogIndex].content.uploadFile.totalNumber =
        uploadFileNumber.totalNumber;
    }
    printInfoLog(
      `已将 ${serverConfig.publishFiles.length} 个文件部署到 ${serverName} 服务器.`,
      "log-success"
    );
    printInfoLog(`服务 ${serverName} 正在启动.`);
    let startServiceResult;
    if (osName === "Windows") {
      startServiceResult = await switchLocalWinService(
        serverConfig.serverIdentity,
        "start"
      );
    } else if (osName === "Docker") {
      startServiceResult = await switchLocalDockerService(
        serverConfig.serverIdentity,
        "start"
      );
    }

    if (!startServiceResult) {
      printInfoLog(`服务 ${serverName} 启动失败.`, "log-error");
      return false;
    }
    printInfoLog(`服务 ${serverName} 发布成功.`, "log-success");
  }
  printInfoLog("");
  return true;
};

// [本机]切换Docker服务
const switchLocalDockerService = async (
  serviceName: string,
  action: "stop" | "start"
) => {
  const switchServerResult = await cmdInvoke("execute_local_command", {
    command: "docker",
    args: [action, serviceName],
  });
  if (switchServerResult.code !== 0) printInfoLog(switchServerResult.data, "log-error");
  return switchServerResult.code === 0;
};

// [本机]切换Windows服务
const switchLocalWinService = async (serviceName: string, action: "stop" | "start") => {
  const isStop = await isLocalWinServiceStop(serviceName);
  if (action == "stop" && isStop) return true;
  if (action == "start" && !isStop) return true;
  const switchServerResult = await cmdInvoke("execute_local_command", {
    command: "net",
    args: [action, serviceName],
    ...getRetryArgs("serviceStop"),
  });
  if (switchServerResult.code !== 0) printInfoLog(switchServerResult.data, "log-error");
  return switchServerResult.code === 0;
};

// [本机]验证[Windows]服务是否已关闭
const isLocalWinServiceStop = async (serviceName: string) => {
  const invokeResult = await cmdInvoke<string>("execute_local_command", {
    command: "sc",
    args: ["query", serviceName],
  });
  if (invokeResult.data.includes("STOPPED")) {
    return true;
  }
  return false;
};

// [本机]发布前备份
const localPublishBeforeBackup = async () => {
  if (!localPublishConfig.value) {
    printInfoLog("发布配置异常，请检查！", "log-error");
    return false;
  }

  // 定义当前日期
  let currentDate = formatDate(new Date(), "YYYY-mm-dd HH:MM:SS");

  // 生成备份配置文件
  let bLocalPublishConfig = _.cloneDeep(localPublishConfig.value);
  delete bLocalPublishConfig.isBackup;
  delete bLocalPublishConfig.generateDate;

  // 备份[WebApiHost]
  if (localPublishConfig.value.webApiHost) {
    const backupResult = await localPublishServerBackup(
      localPublishConfig.value.webApiHost,
      currentDate,
      "WebApiHost",
      publishConfig.backupBasePath
    );
    if (backupResult.code !== 0) {
      printInfoLog(backupResult.msg, "log-error");
      return false;
    }

    // 备份路径
    if (bLocalPublishConfig.webApiHost.serverConfigs) {
      for (let j = 0; j < bLocalPublishConfig.webApiHost.serverConfigs.length; j++) {
        const backupPath = getBackupPath(
          bLocalPublishConfig.webApiHost.serverConfigs[j].publishPath,
          currentDate,
          publishConfig.backupBasePath
        );
        bLocalPublishConfig.webApiHost.serverConfigs[j].backupPath = backupPath;
      }
    }
  }

  // 备份[ScheduleServer]
  if (localPublishConfig.value.scheduleServer) {
    const backupResult = await localPublishServerBackup(
      localPublishConfig.value.scheduleServer,
      currentDate,
      "ScheduleServer",
      publishConfig.backupBasePath
    );
    if (backupResult.code !== 0) {
      printInfoLog(backupResult.msg, "log-error");
      return false;
    }

    // 备份路径
    if (bLocalPublishConfig.scheduleServer.serverConfigs) {
      for (let j = 0; j < bLocalPublishConfig.scheduleServer.serverConfigs.length; j++) {
        const backupPath = getBackupPath(
          bLocalPublishConfig.scheduleServer.serverConfigs[j].publishPath,
          currentDate,
          publishConfig.backupBasePath
        );
        bLocalPublishConfig.scheduleServer.serverConfigs[j].backupPath = backupPath;
      }
    }
  }

  // 备份[WebClient]
  if (localPublishConfig.value.webClient) {
    const backupResult = await localPublishServerBackup(
      localPublishConfig.value.webClient,
      currentDate,
      "WebClient",
      publishConfig.backupBasePath
    );
    if (backupResult.code !== 0) {
      printInfoLog(backupResult.msg, "log-error");
      return false;
    }

    // 备份路径
    if (bLocalPublishConfig.webClient.serverConfigs) {
      for (let j = 0; j < bLocalPublishConfig.webClient.serverConfigs.length; j++) {
        const backupPath = getBackupPath(
          bLocalPublishConfig.webClient.serverConfigs[j].publishPath,
          currentDate,
          publishConfig.backupBasePath
        );
        bLocalPublishConfig.webClient.serverConfigs[j].backupPath = backupPath;
      }
    }
  }

  // 备份[SpcMonitor]
  if (localPublishConfig.value.spcMonitor) {
    const backupResult = await localPublishServerBackup(
      localPublishConfig.value.spcMonitor,
      currentDate,
      "SpcMonitor",
      publishConfig.backupBasePath
    );
    if (backupResult.code !== 0) {
      printInfoLog(backupResult.msg, "log-error");
      return false;
    }

    // 备份路径
    if (bLocalPublishConfig.spcMonitor.serverConfigs) {
      for (let j = 0; j < bLocalPublishConfig.spcMonitor.serverConfigs.length; j++) {
        const backupPath = getBackupPath(
          bLocalPublishConfig.spcMonitor.serverConfigs[j].publishPath,
          currentDate,
          publishConfig.backupBasePath
        );
        bLocalPublishConfig.spcMonitor.serverConfigs[j].backupPath = backupPath;
      }
    }
  }

  // 备份[WpfClient]
  if (localPublishConfig.value.wpfClient) {
    const backupResult = await localPublishWpfBackup(
      localPublishConfig.value.wpfClient,
      currentDate,
      "WpfClient",
      localPublishConfig.value.isNewVersion,
      publishConfig.backupBasePath
    );
    if (backupResult.code !== 0) {
      printInfoLog(backupResult.msg, "log-error");
      return false;
    }

    // 备份路径
    if (bLocalPublishConfig.wpfClient.publishPath) {
      const backupPath = getBackupPath(
        bLocalPublishConfig.wpfClient.publishPath,
        currentDate,
        publishConfig.backupBasePath
      );
      bLocalPublishConfig.wpfClient.backupPath = backupPath;
    }
  }

  // 保存备份记录数据
  let backupLocalPublishConfig = bLocalPublishConfig as BackupLocalPublishType;
  let backupData: RowBackupType = {
    id: null,
    projectId: null,
    projectName: backupLocalPublishConfig.projectName,
    environment: backupLocalPublishConfig.environment,
    backupDate: currentDate,
    remark: "PAPERS_LOCAL_PUBLISH",
    backupItemsJson: JSON.stringify(backupLocalPublishConfig, null, 2),
    backupItems: {} as BackupItemsType,
  };
  let insertResult = await useBackupDb().insertBackup(backupData);
  if (insertResult.code !== 0) {
    printInfoLog(insertResult.msg, "log-error");
    return false;
  }
  return true;
};

// [本机]服务备份
const localPublishServerBackup = async (
  publishServer: PublishServerType,
  currentDate: string,
  serverName: string,
  backupBasePath?: string | null,
) => {
  let execResult: DataResultType<any> = {
    code: 0,
    msg: "",
    data: null,
  };
  if (!publishServer.serverConfigs) return execResult;
  printInfoLog(`正在备份 ${serverName} 服务.`);
  printInfoLog(`${publishServer.serverName}`);

  // 服务器信息
  // const osName = displayOs(Number(publishServer.serverOs));

  // 服务配置信息
  for (let j = 0; j < publishServer.serverConfigs.length; j++) {
    const serverConfig = publishServer.serverConfigs[j];
    const backupPath = getBackupPath(serverConfig.publishPath, currentDate, backupBasePath);

    // 创建备份目录
    const execCreateDirCmdResult = await cmdInvoke("create_dir", {
      path: backupPath,
    });
    if (execCreateDirCmdResult.code !== 0) {
      execResult.code = 1;
      execResult.msg = `服务 ${serverName} 创建备份目录失败：${execCreateDirCmdResult.data}`;
      return execResult;
    }

    // 备份涉及的发布文件
    const currLogIndex = printInfoLog(`${serverConfig.serverIdentity}. `);
    let uploadFileNumber: UploadFileNumberType = {
      currNumber: 0,
      totalNumber: 0,
      prefix: "已备份：",
    };
    uploadFileNumber.totalNumber = serverConfig.publishFiles.length;
    for (let bk = 0; bk < serverConfig.publishFiles.length; bk++) {
      const backFile = serverConfig.publishFiles[bk];
      const pPath = `${removeSlash(serverConfig.publishPath)}/${backFile}`;
      const bPath = `${removeSlash(backupPath)}/${backFile}`;
      const execCopyResult = await cmdInvoke("copy_path", {
        source: pPath,
        destination: bPath,
        ...getRetryArgs("copy"),
      });
      if (execCopyResult.code !== 0) {
        execResult.code = 1;
        execResult.msg = `服务 ${serverName} 备份失败：${execCopyResult.data}`;
        return execResult;
      }
      uploadFileNumber.currNumber++;
      logPrintInfo.value[currLogIndex].content.uploadFile.prefix =
        uploadFileNumber.prefix;
      logPrintInfo.value[currLogIndex].content.uploadFile.currNumber =
        uploadFileNumber.currNumber;
      logPrintInfo.value[currLogIndex].content.uploadFile.totalNumber =
        uploadFileNumber.totalNumber;
    }
  }

  execResult.msg = `服务 ${serverName} 备份成功！`;
  printInfoLog(execResult.msg, "log-success");
  printInfoLog("");
  return execResult;
};

// [本机]Wpf发布备份数量
const lPublishWpfBackupFilesCount = (publishServer: PublishWpfType) => {
  let uploadFileNumber: UploadFileNumberType = {
    currNumber: 0,
    totalNumber: 0,
  };
  for (let i = 0; i < publishServer.publishFiles.length; i++) {
    const pFile = publishServer.publishFiles[i];
    uploadFileNumber.totalNumber += pFile.files.length;
  }
  return uploadFileNumber;
};

// [本机]Wpf服务备份
const localPublishWpfBackup = async (
  publishServer: PublishWpfType,
  currentDate: string,
  serverName: string,
  isNewVersion: boolean | null = false,
  backupBasePath?: string | null,
) => {
  let execResult: DataResultType<any> = {
    code: 0,
    msg: "",
    data: null,
  };
  if (!publishServer.publishPath) return execResult;
  printInfoLog(`正在备份 ${serverName} 服务.`);
  // 服务器信息
  // const osName = displayOs(Number(publishServer.serverOs));
  const currLogIndex = printInfoLog(`${publishServer.serverName}. `);
  let uploadFileNumber = lPublishWpfBackupFilesCount(publishServer);

  const backupPath = getBackupPath(publishServer.publishPath, currentDate, backupBasePath);
  let cacheDir = `${removeSlash(publishServer.publishPath)}/cacheDir`;
  for (let i = 0; i < publishServer.publishFiles.length; i++) {
    const pFile = publishServer.publishFiles[i];

    // 创建备份目录
    const execCreateDirResult = await cmdInvoke("create_dir", {
      path: `${backupPath}/${pFile.dirName}`,
    });
    if (execCreateDirResult.code !== 0) {
      execResult.code = 1;
      execResult.msg = `服务 ${serverName} 创建备份目录失败：${execCreateDirResult.data}`;
      return execResult;
    }

    // 创建一个缓存目录
    let createDirPath;
    let zipFileName;
    if (pFile.dirName === "Domain" || pFile.dirName === "UI") {
      createDirPath = `${cacheDir}/Plugins`;
      zipFileName = "Plugins.zip";
    } else {
      createDirPath = `${cacheDir}`;
      zipFileName = `${pFile.dirName}.zip`;
    }

    if (isNewVersion && (pFile.dirName === "Plugins" || pFile.dirName === "Lib")) {
      createDirPath = `${removeSlash(cacheDir)}/${pFile.dirName}`;
    }

    const execCreatecacheDirResult = await cmdInvoke("create_dir", {
      path: createDirPath,
    });
    if (execCreatecacheDirResult.code !== 0) {
      execResult.code = 1;
      execResult.msg = `服务 ${serverName} 创建一个缓存目录失败：${execCreatecacheDirResult.data}`;
      return execResult;
    }

    // 解压
    const unzipFile = `${removeSlash(publishServer.publishPath)}/${zipFileName}`;
    const unzipResult = await cmdInvoke("un_zip", {
      filePaths: [unzipFile],
      destination: createDirPath,
    });
    if (unzipResult.code !== 0) {
      execResult.code = 1;
      execResult.msg = `服务[${serverName}]解压[${zipFileName}]失败：${unzipResult.data}`;
      return execResult;
    }

    // 备份
    for (let bf = 0; bf < pFile.files.length; bf++) {
      let pPath = `${createDirPath}/${pFile.dirName}/${pFile.files[bf]}`;
      if (isNewVersion && (pFile.dirName === "Plugins" || pFile.dirName === "Lib")) {
        pPath = `${createDirPath}/${pFile.files[bf]}`;
      }

      const bPath = `${backupPath}/${pFile.dirName}/${pFile.files[bf]}`;
      const execCopyResult = await cmdInvoke("copy_path", {
        source: pPath,
        destination: bPath,
        ...getRetryArgs("copy"),
      });
      if (execCopyResult.code !== 0) {
        execResult.code = 1;
        execResult.msg = `服务 ${serverName} 备份失败：${execCopyResult.data}`;
        return execResult;
      }
      uploadFileNumber.currNumber++;
      logPrintInfo.value[currLogIndex].content.uploadFile.prefix =
        uploadFileNumber.prefix;
      logPrintInfo.value[currLogIndex].content.uploadFile.currNumber =
        uploadFileNumber.currNumber;
      logPrintInfo.value[currLogIndex].content.uploadFile.totalNumber =
        uploadFileNumber.totalNumber;
    }

    // 删除缓存目录
    await cmdInvoke("delete_paths", {
      paths: [`${removeSlash(publishServer.publishPath)}/cacheDir`],
    });
  }
  execResult.msg = `服务 ${serverName} 备份成功！`;
  printInfoLog(execResult.msg, "log-success");
  printInfoLog("");
  return execResult;
};

// [远程]服务发布
const remoteServerPublish = async () => {
  if (!remotePublishConfig.value) return;

  // 发布前备份
  if (publishConfig.isBackup == 1) {
    const backupResult = await remotePublishBeforeBackup();
    if (!backupResult) return false;
  }

  // 发布 [WebApiHost] 服务
  if (
    remotePublishConfig.value.webApiHost &&
    remotePublishConfig.value.webApiHost.length > 0
  ) {
    const publishWebApiResult = await remotePublishServer(
      remotePublishConfig.value.webApiHost,
      "WebApiHost"
    );
    if (!publishWebApiResult) {
      return false;
    }
  }

  // 发布 [ScheduleServer] 服务
  if (
    remotePublishConfig.value.scheduleServer &&
    remotePublishConfig.value.scheduleServer.length > 0
  ) {
    const publishScheduleResult = await remotePublishServer(
      remotePublishConfig.value.scheduleServer,
      "ScheduleServer"
    );
    if (!publishScheduleResult) {
      return false;
    }
  }

  // 发布 [SpcMonitor] 服务
  if (
    remotePublishConfig.value.spcMonitor &&
    remotePublishConfig.value.spcMonitor.length > 0
  ) {
    const publishSpcResult = await remotePublishServer(
      remotePublishConfig.value.spcMonitor,
      "SpcMonitor"
    );
    if (!publishSpcResult) {
      return false;
    }
  }

  // 发布 [WpfClient] 服务
  if (remotePublishConfig.value.wpfClient) {
    let publishWpfResult;
    if (remotePublishConfig.value.isNewVersion) {
      publishWpfResult = await newRemotePublishWpfServer(
        remotePublishConfig.value.wpfClient,
        "WpfClient"
      );
    } else {
      publishWpfResult = await remotePublishWpfServer(
        remotePublishConfig.value.wpfClient,
        "WpfClient"
      );
    }
    if (!publishWpfResult) {
      return false;
    }
  }

  // 发布 [WebClient] 服务
  if (
    remotePublishConfig.value.webClient &&
    remotePublishConfig.value.webClient.length > 0
  ) {
    const publishWebResult = await remotePublishServer(
      remotePublishConfig.value.webClient,
      "WebClient"
    );
    if (!publishWebResult) {
      return false;
    }
  }

  printInfoLog("发布成功！");
  return true;
};

// [(新)远程]发布WPF服务
const newRemotePublishWpfServer = async (
  publishServer: PublishWpfType,
  serverName: string
) => {
  printInfoLog(`正在发布 ${serverName} 服务.`);
  const mPublishDir = await papersPublishDir();

  // 服务器信息
  const username = publishServer.serverAccount;
  const password = await aesDecrypt(String(publishServer.serverPwd));
  const server = `${publishServer.serverIp}:${publishServer.serverPort}`;

  // 创建一个Wpf临时操作目录
  const wpfPublishDir = `${removeSlash(mPublishDir)}/${serverName}/tempPublish`;
  let createTempPathResult = await createDir(wpfPublishDir);
  if (!createTempPathResult) {
    printInfoLog(`创建一个Wpf临时操作目录失败：${wpfPublishDir}`, "log-error");
    return false;
  }

  // 从远程服务器下载文件到[临时缓存目录]
  let remoteFiles = [`${removeSlash(publishServer.publishPath)}/Manifest.xml`];
  for (let i = 0; i < publishServer.publishFiles.length; i++) {
    const publishFile = publishServer.publishFiles[i];
    remoteFiles.push(
      `${removeSlash(publishServer.publishPath)}/${publishFile.dirName}.zip`
    );
  }
  remoteFiles = _.uniq(remoteFiles);

  let localFiles = new Array<string>();
  let remoteFileNames = new Array<string>();
  for (let i = 0; i < remoteFiles.length; i++) {
    const remoteFile = remoteFiles[i];
    const subStartIndex = remoteFile.lastIndexOf("/");
    const remoteFileName = remoteFile.substring(subStartIndex + 1);
    remoteFileNames.push(remoteFileName);
    const localFile = `${wpfPublishDir}/${remoteFileName}`;
    localFiles.push(localFile);
  }
  printInfoLog(`正在获取远程服务文件：${remoteFileNames.join("、")}`);

  const downloadServerFileResult = await cmdInvoke("download_server_files", {
    username,
    password,
    server,
    remotePaths: remoteFiles,
    localPaths: localFiles,
  });
  if (downloadServerFileResult.code !== 0) {
    printInfoLog(
      `获取远程服务文件失败：[${downloadServerFileResult.data}].`,
      "log-error"
    );
    return false;
  }
  printInfoLog(`获取远程服务文件成功.`, "log-success");

  // 处理下载文件
  for (let i = 0; i < localFiles.length; i++) {
    const localFile = localFiles[i];
    const lastIndex = localFile.lastIndexOf("/");
    // 判断是否为zip文件
    const fileName = `${localFile.substring(lastIndex + 1)}`;
    if (!fileName.endsWith(".zip")) continue;

    // 进行解压
    let unzipPath = removeSlash(`${localFile.substring(0, lastIndex + 1)}`);
    printInfoLog(`正在解压 ${fileName}.`);
    if (fileName == "Plugins.zip" || fileName == "Lib.zip") {
      unzipPath = `${removeSlash(unzipPath)}/${fileName.replace(".zip", "")}`;
    }
    const unzipResult = await cmdInvoke("un_zip", {
      filePaths: [localFile],
      destination: unzipPath,
    });

    if (unzipResult.code !== 0) {
      printInfoLog(`解压 ${fileName} 失败.`, "log-error");
      return false;
    }
    printInfoLog(`解压 ${fileName} 成功.`, "log-success");

    // 将压缩文件删除
    await cmdInvoke("delete_paths", {
      paths: [localFile],
    });

    // 将生成的文件复制到[临时发布目录]
    const dirName = fileName.replace(".zip", "");
    if (dirName == "Plugins" || dirName == "Lib") {
      const sourcePluginsPath = `${removeSlash(mPublishDir)}/${serverName}/${dirName}`;
      const destinationPluginsPath = `${removeSlash(wpfPublishDir)}/${dirName}`;
      const copyPluginsResult = await cmdInvoke("copy_path", {
        source: sourcePluginsPath,
        destination: destinationPluginsPath,
        ...getRetryArgs("copy"),
      });
      if (copyPluginsResult.code !== 0) {
        printInfoLog(`复制文件目录 ${sourcePluginsPath} 失败.`, "log-error");
        return false;
      }

      // 重新打包压缩
      const compressePluginsResult = await cmdInvoke("zip_dir", {
        srcDir: destinationPluginsPath,
        dstFile: `${removeSlash(wpfPublishDir)}/${dirName}.zip`,
      });
      if (compressePluginsResult.code !== 0) {
        printInfoLog(
          `压缩[${dirName}.zip]失败：${compressePluginsResult.data}.`,
          "log-error"
        );
        return false;
      }

      // 压缩成功后重新上传到服务器
      printInfoLog(
        `正在将 ${dirName}.zip 文件上传到 ${serverName.replace("服务器", "")} 服务器.`
      );
      const uploadPluginsFileResult = await cmdInvoke("upload_server_files", {
        localPaths: [`${removeSlash(wpfPublishDir)}/Plugins.zip`],
        remotePaths: [`${removeSlash(publishServer.publishPath)}/Plugins.zip`],
        username,
        password,
        server,
      });
      if (uploadPluginsFileResult.code !== 0) {
        printInfoLog(`文件 ${dirName}.zip 上传失败.`, "log-error");
        return false;
      }
      printInfoLog(
        `已将 ${dirName}.zip 文件上传到 ${serverName?.replace("服务器", "")}服务器.`,
        "log-success"
      );
    } else {
      let sourcePath = `${removeSlash(mPublishDir)}/${serverName}/${dirName}`;
      let destinationPath = `${removeSlash(wpfPublishDir)}/${dirName}`;
      const copyResult = await cmdInvoke("copy_path", {
        source: sourcePath,
        destination: destinationPath,
        ...getRetryArgs("copy"),
      });
      if (copyResult.code !== 0) {
        printInfoLog(`复制文件目录 ${sourcePath} 失败.`, "log-error");
        return false;
      }

      // 重新打包压缩
      printInfoLog(
        `正在将 ${dirName}.zip 文件上传到 ${serverName?.replace("服务器", "")}服务器.`
      );
      const compresseResult = await cmdInvoke("compress_zip", {
        filePaths: [destinationPath],
        dstFile: `${removeSlash(wpfPublishDir)}/${dirName}.zip`,
      });
      if (compresseResult.code !== 0) {
        printInfoLog(`压缩[${dirName}.zip]失败：${compresseResult.data}.`, "log-error");
        return false;
      }

      // 压缩成功后重新上传到服务器
      const uploadFileResult = await cmdInvoke("upload_server_files", {
        localPaths: [`${removeSlash(wpfPublishDir)}/${dirName}.zip`],
        remotePaths: [`${removeSlash(publishServer.publishPath)}/${dirName}.zip`],
        username,
        password,
        server,
      });
      if (uploadFileResult.code !== 0) {
        printInfoLog(`文件 ${dirName}.zip 上传失败.`, "log-error");
        return false;
      }
      printInfoLog(
        `已将 ${dirName}.zip 文件上传到 ${serverName?.replace("服务器", "")} 服务器.`,
        "log-success"
      );
    }

    // 升级版本号
    printInfoLog(`正在更新 ${dirName}.zip 版本号.`);
    const localManifestFile =
      removeSlash(localFile.substring(0, lastIndex + 1)) + "/Manifest.xml";
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
    printInfoLog(
      `已将 ${dirName}.zip 版本号更新为 ${upgradePluginsVersionResult.data}.`,
      "log-success"
    );

    // 将本机 Manifest.xml 上传到服务器
    const remoteManifestPath = `${removeSlash(publishServer.publishPath)}/Manifest.xml`;
    const uploadManifestFileResult = await cmdInvoke("upload_server_files", {
      localPaths: [localManifestFile],
      remotePaths: [remoteManifestPath],
      username,
      password,
      server,
    });
    if (uploadManifestFileResult.code !== 0) {
      printInfoLog(
        `文件 ${dirName}.zip 上传失败：${uploadManifestFileResult.data}.`,
        "log-error"
      );
      return false;
    }
    printInfoLog(`已成功更新 ${dirName}.zip 版本号.`, "log-success");
  }

  // 发布成功，删除临时文件
  await cmdInvoke("delete_paths", {
    paths: [wpfPublishDir],
  });

  printInfoLog("");

  return true;
};

// [远程]发布WPF服务
const remotePublishWpfServer = async (
  publishServer: PublishWpfType,
  serverName: string
) => {
  printInfoLog(`正在发布 ${serverName} 服务.`);
  const mPublishDir = await papersPublishDir();

  // 服务器信息
  const username = publishServer.serverAccount;
  const password = await aesDecrypt(String(publishServer.serverPwd));
  const server = `${publishServer.serverIp}:${publishServer.serverPort}`;

  // 创建一个Wpf临时操作目录
  const wpfPublishDir = `${removeSlash(mPublishDir)}/${serverName}/tempPublish`;
  let createTempPathResult = await createDir(wpfPublishDir);
  if (!createTempPathResult) {
    printInfoLog(`创建一个Wpf临时操作目录失败：${wpfPublishDir}`, "log-error");
    return false;
  }

  // 从远程服务器下载文件到[临时缓存目录]
  let remoteFiles = [`${removeSlash(publishServer.publishPath)}/Manifest.xml`];
  for (let i = 0; i < publishServer.publishFiles.length; i++) {
    const publishFile = publishServer.publishFiles[i];
    if (publishFile.dirName == "Domain" || publishFile.dirName == "UI") {
      remoteFiles.push(`${removeSlash(publishServer.publishPath)}/Plugins.zip`);
      continue;
    }
    remoteFiles.push(
      `${removeSlash(publishServer.publishPath)}/${publishFile.dirName}.zip`
    );
  }
  remoteFiles = _.uniq(remoteFiles);

  let localFiles = new Array<string>();
  let remoteFileNames = new Array<string>();
  for (let i = 0; i < remoteFiles.length; i++) {
    const remoteFile = remoteFiles[i];
    const subStartIndex = remoteFile.lastIndexOf("/");
    const remoteFileName = remoteFile.substring(subStartIndex + 1);
    remoteFileNames.push(remoteFileName);
    const localFile = `${wpfPublishDir}/${remoteFileName}`;
    localFiles.push(localFile);
  }
  printInfoLog(`正在获取远程服务文件：${remoteFileNames.join("、")}`);
  const downloadServerFileResult = await cmdInvoke("download_server_files", {
    username,
    password,
    server,
    remotePaths: remoteFiles,
    localPaths: localFiles,
  });

  if (downloadServerFileResult.code !== 0) {
    printInfoLog(
      `获取远程服务文件失败：[${downloadServerFileResult.data}].`,
      "log-error"
    );
    return false;
  }
  printInfoLog(`获取远程服务文件成功.`, "log-success");

  // 处理下载文件
  for (let i = 0; i < localFiles.length; i++) {
    const localFile = localFiles[i];
    const lastIndex = localFile.lastIndexOf("/");
    // 判断是否为zip文件
    const fileName = `${localFile.substring(lastIndex + 1)}`;
    if (!fileName.endsWith(".zip")) continue;

    // 进行解压
    const unzipPath = removeSlash(`${localFile.substring(0, lastIndex + 1)}`);
    printInfoLog(`正在解压 ${fileName}.`);
    const unzipResult = await cmdInvoke("un_zip", {
      filePaths: [localFile],
      destination: unzipPath,
    });

    if (unzipResult.code !== 0) {
      printInfoLog(`解压 ${fileName} 失败.`, "log-error");
      return false;
    }
    printInfoLog(`解压 ${fileName} 成功.`, "log-success");

    // 将压缩文件删除
    await cmdInvoke("delete_paths", {
      paths: [localFile],
    });

    // 将生成的文件复制到[临时发布目录]
    const dirName = fileName.replace(".zip", "");
    if (dirName == "Plugins") {
      const sourceDomainPath = `${removeSlash(mPublishDir)}/${serverName}/Domain`;
      const destinationDomainPath = `${removeSlash(wpfPublishDir)}/Domain`;
      const copyDomainResult = await cmdInvoke("copy_path", {
        source: sourceDomainPath,
        destination: destinationDomainPath,
        ...getRetryArgs("copy"),
      });
      if (copyDomainResult.code !== 0) {
        printInfoLog(`复制文件目录 ${sourceDomainPath} 失败.`, "log-error");
        return false;
      }

      // UI
      const sourceUiPath = `${removeSlash(mPublishDir)}/${serverName}/UI`;
      const destinationUiPath = `${removeSlash(wpfPublishDir)}/UI`;
      const copyUiResult = await cmdInvoke("copy_path", {
        source: sourceUiPath,
        destination: destinationUiPath,
        ...getRetryArgs("copy"),
      });
      if (copyUiResult.code !== 0) {
        printInfoLog(`复制文件目录 ${sourceUiPath} 失败.`, "log-error");
        return false;
      }

      // 重新打包压缩
      const compressePluginsResult = await cmdInvoke("compress_zip", {
        filePaths: [destinationDomainPath, destinationUiPath],
        dstFile: `${removeSlash(wpfPublishDir)}/Plugins.zip`,
      });
      if (compressePluginsResult.code !== 0) {
        printInfoLog(
          `压缩[Plugins.zip]失败：${compressePluginsResult.data}.`,
          "log-error"
        );
        return false;
      }

      // 压缩成功后重新上传到服务器
      printInfoLog(
        `正在将 Plugins.zip 文件上传到 ${serverName.replace("服务器", "")} 服务器.`
      );
      const uploadPluginsFileResult = await cmdInvoke("upload_server_files", {
        localPaths: [`${removeSlash(wpfPublishDir)}/Plugins.zip`],
        remotePaths: [`${removeSlash(publishServer.publishPath)}/Plugins.zip`],
        username,
        password,
        server,
      });
      if (uploadPluginsFileResult.code !== 0) {
        printInfoLog(`文件 Plugins.zip 上传失败.`, "log-error");
        return false;
      }
      printInfoLog(
        `已将 Plugins.zip 文件上传到 ${serverName?.replace("服务器", "")}服务器.`,
        "log-success"
      );
    } else {
      let sourcePath = `${removeSlash(mPublishDir)}/${serverName}/${dirName}`;
      let destinationPath = `${removeSlash(wpfPublishDir)}/${dirName}`;
      const copyResult = await cmdInvoke("copy_path", {
        source: sourcePath,
        destination: destinationPath,
        ...getRetryArgs("copy"),
      });
      if (copyResult.code !== 0) {
        printInfoLog(`复制文件目录 ${sourcePath} 失败.`, "log-error");
        return false;
      }

      // 重新打包压缩
      printInfoLog(
        `正在将 ${dirName}.zip 文件上传到 ${serverName?.replace("服务器", "")}服务器.`
      );
      const compresseResult = await cmdInvoke("compress_zip", {
        filePaths: [destinationPath],
        dstFile: `${removeSlash(wpfPublishDir)}/${dirName}.zip`,
      });
      if (compresseResult.code !== 0) {
        printInfoLog(`压缩[${dirName}.zip]失败：${compresseResult.data}.`, "log-error");
        return false;
      }

      // 压缩成功后重新上传到服务器
      const uploadFileResult = await cmdInvoke("upload_server_files", {
        localPaths: [`${removeSlash(wpfPublishDir)}/${dirName}.zip`],
        remotePaths: [`${removeSlash(publishServer.publishPath)}/${dirName}.zip`],
        username,
        password,
        server,
      });
      if (uploadFileResult.code !== 0) {
        printInfoLog(`文件 ${dirName}.zip 上传失败.`, "log-error");
        return false;
      }
      printInfoLog(
        `已将 ${dirName}.zip 文件上传到 ${serverName?.replace("服务器", "")} 服务器.`,
        "log-success"
      );
    }

    // 升级版本号
    printInfoLog(`正在更新 ${dirName}.zip 版本号.`);
    const localManifestFile =
      removeSlash(localFile.substring(0, lastIndex + 1)) + "/Manifest.xml";
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
    printInfoLog(
      `已将 ${dirName}.zip 版本号更新为 ${upgradePluginsVersionResult.data}.`,
      "log-success"
    );

    // 将本机 Manifest.xml 上传到服务器
    const remoteManifestPath = `${removeSlash(publishServer.publishPath)}/Manifest.xml`;
    const uploadManifestFileResult = await cmdInvoke("upload_server_files", {
      localPaths: [localManifestFile],
      remotePaths: [remoteManifestPath],
      username,
      password,
      server,
    });
    if (uploadManifestFileResult.code !== 0) {
      printInfoLog(
        `文件 ${dirName}.zip 上传失败：${uploadManifestFileResult.data}.`,
        "log-error"
      );
      return false;
    }
    printInfoLog(`已成功更新 ${dirName}.zip 版本号.`, "log-success");
  }

  // 发布成功，删除临时文件
  await cmdInvoke("delete_paths", {
    paths: [wpfPublishDir],
  });

  printInfoLog("");

  return true;
};

// [远程]发布服务
const remotePublishServer = async (
  publishServers: PublishServerType[],
  serverName: string
) => {
  printInfoLog(`正在发布 ${serverName} 服务.`);

  const mPublishDir = await papersPublishDir();
  for (let i = 0; i < publishServers.length; i++) {
    const publishServer = publishServers[i];
    // 服务器信息
    const osName = displayOs(Number(publishServer.serverOs));
    const username = publishServer.serverAccount;
    const password = await aesDecrypt(String(publishServer.serverPwd));
    const server = `${publishServer.serverIp}:${publishServer.serverPort}`;

    // 服务发布配置信息
    for (let j = 0; j < publishServer.serverConfigs.length; j++) {
      const serverConfig = publishServer.serverConfigs[j];
      /* 1.关闭服务 */
      printInfoLog(`正在关闭 ${serverName} 服务.`);
      let closeServiceResult;
      if (osName == "Windows") {
        closeServiceResult = await switchRemoteWinService(
          String(username),
          password,
          server,
          serverConfig.serverIdentity,
          "stop"
        );
      } else if (osName == "Docker") {
        closeServiceResult = await switchRemoteDockerService(
          String(username),
          password,
          server,
          serverConfig.serverIdentity,
          "stop"
        );
      } else {
        printInfoLog(`未找到 ${osName} 部署环境，请检查.`, "log-error");
        return false;
      }
      if (!closeServiceResult) {
        printInfoLog(`服务 ${serverName} 关闭失败.`, "log-error");
        return false;
      }
      printInfoLog(`服务 ${serverName} 已关闭.`, "log-success");

      /* 上传文件到服务器 */
      const currLogIndex = printInfoLog(`服务 ${serverName} 正在发布.`);
      let uploadFileNumber: UploadFileNumberType = {
        currNumber: 0,
        totalNumber: 0,
        prefix: "已上传：",
      };
      uploadFileNumber.totalNumber = serverConfig.publishFiles.length;

      for (let f = 0; f < serverConfig.publishFiles.length; f++) {
        const publishFile = serverConfig.publishFiles[f];
        const uploadServerFileResult = await cmdInvoke("upload_server_files", {
          localPaths: [`${mPublishDir}/${serverName}/${publishFile}`],
          remotePaths: [`${removeSlash(serverConfig.publishPath)}/${publishFile}`],
          username,
          password,
          server,
        });
        if (uploadServerFileResult.code !== 0) {
          printInfoLog(
            `服务 ${serverName} 发布失败：${uploadServerFileResult.data}.`,
            "log-error"
          );
          return false;
        }
        uploadFileNumber.currNumber++;
        logPrintInfo.value[currLogIndex].content.uploadFile.prefix =
          uploadFileNumber.prefix;
        logPrintInfo.value[currLogIndex].content.uploadFile.currNumber =
          uploadFileNumber.currNumber;
        logPrintInfo.value[currLogIndex].content.uploadFile.totalNumber =
          uploadFileNumber.totalNumber;
      }

      printInfoLog(
        `已将 ${serverConfig.publishFiles.length} 个文件上传到 ${serverName} 服务器.`,
        "log-success"
      );
      printInfoLog(`服务 ${serverName} 正在启动.`);
      let startServiceResult;

      if (osName === "Windows") {
        startServiceResult = await switchRemoteWinService(
          String(username),
          password,
          server,
          serverConfig.serverIdentity,
          "start"
        );
      } else if (osName === "Docker") {
        startServiceResult = await switchRemoteDockerService(
          String(username),
          password,
          server,
          serverConfig.serverIdentity,
          "start"
        );
      }
      if (!startServiceResult) {
        printInfoLog(`服务 ${serverName} 启动失败.`, "log-error");
        return false;
      }
      printInfoLog(`服务 ${serverName} 发布成功.`, "log-success");
    }
  }
  printInfoLog("");
  return true;
};

// [远程]发布前备份
const remotePublishBeforeBackup = async () => {
  if (!remotePublishConfig.value) {
    printInfoLog("发布配置异常，请检查！", "log-error");
    return false;
  }

  // 定义当前日期
  let currentDate = formatDate(new Date(), "YYYY-mm-dd HH:MM:SS");

  // 生成备份配置文件
  let bRemotePublishConfig = _.cloneDeep(remotePublishConfig.value);
  delete bRemotePublishConfig.isBackup;
  delete bRemotePublishConfig.generateDate;

  // 备份[WebApiHost]
  if (
    remotePublishConfig.value.webApiHost &&
    remotePublishConfig.value.webApiHost.length > 0
  ) {
    const backupResult = await remotePublishServerBackup(
      remotePublishConfig.value.webApiHost,
      currentDate,
      "WebApiHost",
      publishConfig.backupBasePath
    );
    if (backupResult.code !== 0) {
      printInfoLog(backupResult.msg, "log-error");
      return false;
    }

    // 备份路径
    for (let i = 0; i < bRemotePublishConfig.webApiHost.length; i++) {
      for (let j = 0; j < bRemotePublishConfig.webApiHost[i].serverConfigs.length; j++) {
        const backupPath = getBackupPath(
          bRemotePublishConfig.webApiHost[i].serverConfigs[j].publishPath,
          currentDate,
          publishConfig.backupBasePath
        );
        bRemotePublishConfig.webApiHost[i].serverConfigs[j].backupPath = backupPath;
      }
    }
  }

  // 备份[ScheduleServer]
  if (
    remotePublishConfig.value.scheduleServer &&
    remotePublishConfig.value.scheduleServer.length > 0
  ) {
    const backupResult = await remotePublishServerBackup(
      remotePublishConfig.value.scheduleServer,
      currentDate,
      "ScheduleServer",
      publishConfig.backupBasePath
    );
    if (backupResult.code !== 0) {
      printInfoLog(backupResult.msg, "log-error");
      return false;
    }

    // 备份路径
    for (let i = 0; i < bRemotePublishConfig.scheduleServer.length; i++) {
      for (
        let j = 0;
        j < bRemotePublishConfig.scheduleServer[i].serverConfigs.length;
        j++
      ) {
        const backupPath = getBackupPath(
          bRemotePublishConfig.scheduleServer[i].serverConfigs[j].publishPath,
          currentDate,
          publishConfig.backupBasePath
        );
        bRemotePublishConfig.scheduleServer[i].serverConfigs[j].backupPath = backupPath;
      }
    }
  }

  // 备份[WebClient]
  if (
    remotePublishConfig.value.webClient &&
    remotePublishConfig.value.webClient.length > 0
  ) {
    const backupResult = await remotePublishServerBackup(
      remotePublishConfig.value.webClient,
      currentDate,
      "WebClient",
      publishConfig.backupBasePath
    );
    if (backupResult.code !== 0) {
      printInfoLog(backupResult.msg, "log-error");
      return false;
    }

    // 备份路径
    for (let i = 0; i < bRemotePublishConfig.webClient.length; i++) {
      for (let j = 0; j < bRemotePublishConfig.webClient[i].serverConfigs.length; j++) {
        const backupPath = getBackupPath(
          bRemotePublishConfig.webClient[i].serverConfigs[j].publishPath,
          currentDate,
          publishConfig.backupBasePath
        );
        bRemotePublishConfig.webClient[i].serverConfigs[j].backupPath = backupPath;
      }
    }
  }

  // 备份[SpcMonitor]
  if (
    remotePublishConfig.value.spcMonitor &&
    remotePublishConfig.value.spcMonitor.length > 0
  ) {
    const backupResult = await remotePublishServerBackup(
      remotePublishConfig.value.spcMonitor,
      currentDate,
      "SpcMonitor",
      publishConfig.backupBasePath
    );
    if (backupResult.code !== 0) {
      printInfoLog(backupResult.msg, "log-error");
      return false;
    }

    // 备份路径
    for (let i = 0; i < bRemotePublishConfig.spcMonitor.length; i++) {
      for (let j = 0; j < bRemotePublishConfig.spcMonitor[i].serverConfigs.length; j++) {
        const backupPath = getBackupPath(
          bRemotePublishConfig.spcMonitor[i].serverConfigs[j].publishPath,
          currentDate,
          publishConfig.backupBasePath
        );
        bRemotePublishConfig.spcMonitor[i].serverConfigs[j].backupPath = backupPath;
      }
    }
  }

  // 备份[WpfClient]
  if (remotePublishConfig.value.wpfClient) {
    const backupResult = await remotePublishWpfBackup(
      remotePublishConfig.value.wpfClient,
      currentDate,
      "WpfClient",
      remotePublishConfig.value.isNewVersion,
      publishConfig.backupBasePath
    );
    if (backupResult.code !== 0) {
      printInfoLog(backupResult.msg, "log-error");
      return false;
    }

    // 备份路径
    const backupPath = getBackupPath(
      bRemotePublishConfig.wpfClient.publishPath,
      currentDate,
      publishConfig.backupBasePath
    );
    bRemotePublishConfig.wpfClient.backupPath = backupPath;
  }

  // 保存备份记录数据
  let backupRemotePublishConfig = bRemotePublishConfig as BackupRemotePublishType;
  let backupData: RowBackupType = {
    id: null,
    projectId: null,
    projectName: backupRemotePublishConfig.projectName,
    environment: backupRemotePublishConfig.environment,
    backupDate: currentDate,
    remark: "PAPERS_REMOTE_PUBLISH",
    backupItemsJson: JSON.stringify(backupRemotePublishConfig, null, 2),
    backupItems: {} as BackupItemsType,
  };
  let insertResult = await useBackupDb().insertBackup(backupData);
  if (insertResult.code !== 0) {
    printInfoLog(insertResult.msg, "log-error");
    return false;
  }
  return true;
};

// [远程]Wpf发布备份数量
const rPublishWpfBackupFilesCount = (publishServer: PublishWpfType) => {
  let uploadFileNumber: UploadFileNumberType = {
    currNumber: 0,
    totalNumber: 0,
    prefix: "已备份：",
  };
  for (let i = 0; i < publishServer.publishFiles.length; i++) {
    const pFile = publishServer.publishFiles[i];
    uploadFileNumber.totalNumber += pFile.files.length;
  }
  return uploadFileNumber;
};

// [远程]Wpf服务
const remotePublishWpfBackup = async (
  publishServer: PublishWpfType,
  currentDate: string,
  serverName: string,
  isNewVersion: boolean | null = false,
  backupBasePath?: string | null,
) => {
  let execResult: DataResultType<any> = {
    code: 0,
    msg: "",
    data: null,
  };
  printInfoLog(`正在备份 ${serverName} 服务.`);
  // 服务器信息
  const osName = displayOs(Number(publishServer.serverOs));
  const username = publishServer.serverAccount;
  const password = await aesDecrypt(String(publishServer.serverPwd));
  const server = `${publishServer.serverIp}:${publishServer.serverPort}`;
  const currLogIndex = printInfoLog(
    `${publishServer.serverName}[${publishServer.serverIp}].`
  );

  const backupPath = getBackupPath(publishServer.publishPath, currentDate, backupBasePath);
  let cacheDir = `${removeSlash(publishServer.publishPath)}/cacheDir`;
  let uploadFileNumber = rPublishWpfBackupFilesCount(publishServer);
  for (let i = 0; i < publishServer.publishFiles.length; i++) {
    const pFile = publishServer.publishFiles[i];

    // 创建备份目录
    let createDirCmd;
    if (osName == "Windows") {
      createDirCmd = `if not exist "${backupPath}/${pFile.dirName}" mkdir "${backupPath}/${pFile.dirName}"`;
      createDirCmd = createDirCmd.replace(/\//g, "\\");
    } else {
      createDirCmd = `mkdir -p "${backupPath}/${pFile.dirName}"`;
    }
    await cmdInvoke("execute_remote_command", {
      username,
      password,
      server,
      command: createDirCmd,
    });

    // 创建一个缓存目录
    let createDirPath;
    let zipFileName;
    if (pFile.dirName === "Domain" || pFile.dirName === "UI") {
      createDirPath = `${cacheDir}/Plugins`;
      zipFileName = "Plugins.zip";
    } else {
      createDirPath = `${cacheDir}`;
      zipFileName = `${pFile.dirName}.zip`;
    }
    let cacheDirCmd;
    if (osName === "Windows") {
      cacheDirCmd = `if not exist "${createDirPath}" mkdir "${createDirPath}"`;
      cacheDirCmd = cacheDirCmd.replace(/\//g, "\\");
    } else {
      cacheDirCmd = `mkdir -p "${createDirPath}"`;
    }
    await cmdInvoke("execute_remote_command", {
      username,
      password,
      server,
      command: cacheDirCmd,
    });

    // 解压
    let unZipCmd;
    let zipDir = "";
    if (isNewVersion && (pFile.dirName === "Plugins" || pFile.dirName === "Lib")) {
      zipDir = `/${pFile.dirName}`;
    }

    if (osName === "Windows") {
      // tar (bsdtar) 在部分 Windows 旧版本不支持 zip，改用 PowerShell 原生解压
      const winZipPath = `${removeSlash(
        publishServer.publishPath
      )}/${zipFileName}`.replace(/\//g, "\\");
      const winDstDir = `${createDirPath}${zipDir}`.replace(/\//g, "\\");
      unZipCmd = `powershell -NoProfile -Command "Expand-Archive -Path '${winZipPath}' -DestinationPath '${winDstDir}' -Force"`;
    } else {
      unZipCmd = `unzip -o ${removeSlash(
        publishServer.publishPath
      )}/${zipFileName} -d ${createDirPath}${zipDir}`;
    }
    const unZipCmdResult = await cmdInvoke("execute_remote_command", {
      username,
      password,
      server,
      command: unZipCmd,
    });
    if (unZipCmdResult.code !== 0) {
      execResult.code = 1;
      execResult.msg = `服务[${serverName}]解压[${zipFileName}]失败：${unZipCmdResult.data}`;
      return execResult;
    }

    // 备份
    for (let bf = 0; bf < pFile.files.length; bf++) {
      const pPath = `${createDirPath}/${pFile.dirName}/${pFile.files[bf]}`;
      const bPath = `${backupPath}/${pFile.dirName}/${pFile.files[bf]}`;
      let command;
      if (osName === "Windows") {
        command = `if exist "${pPath}" copy "${pPath}" "${bPath}"`;
        command = command.replace(/\//g, "\\") + " /Y";
      } else {
        command = `[ -e "${pPath}" ] && cp "${pPath}" "${bPath}"`;
      }
      const execRemoteCmdResult = await cmdInvoke("execute_remote_command", {
        username,
        password,
        server,
        command,
      });
      if (execRemoteCmdResult.code !== 0) {
        execResult.code = 1;
        execResult.msg = `服务 ${serverName} 备份失败：${execRemoteCmdResult.data}`;
        return execResult;
      }
      uploadFileNumber.currNumber++;
      logPrintInfo.value[currLogIndex].content.uploadFile.prefix =
        uploadFileNumber.prefix;
      logPrintInfo.value[currLogIndex].content.uploadFile.currNumber =
        uploadFileNumber.currNumber;
      logPrintInfo.value[currLogIndex].content.uploadFile.totalNumber =
        uploadFileNumber.totalNumber;
    }

    // 删除缓存目录
    let removeTempDirCmd;
    if (osName === "Windows") {
      const rmPath =
        removeSlash(publishServer.publishPath).replace(/\//g, "\\") + "\\cacheDir";
      removeTempDirCmd = `if exist "${rmPath}" rd /s /q "${rmPath}"`;
    } else {
      removeTempDirCmd = `rm -rf ${removeSlash(publishServer.publishPath)}/cacheDir`;
    }
    await cmdInvoke("execute_remote_command", {
      username,
      password,
      server,
      command: removeTempDirCmd,
    });
  }
  execResult.msg = `服务 ${serverName} 备份成功！`;
  printInfoLog(execResult.msg, "log-success");
  printInfoLog("");
  return execResult;
};

// [远程]服务备份
const remotePublishServerBackup = async (
  publishServers: PublishServerType[],
  currentDate: string,
  serverName: string,
  backupBasePath?: string | null,
) => {
  let execResult: DataResultType<any> = {
    code: 0,
    msg: "",
    data: null,
  };
  printInfoLog(`正在备份 ${serverName} 服务.`);
  for (let i = 0; i < publishServers.length; i++) {
    const publishServer = publishServers[i];
    printInfoLog(`${publishServer.serverName}[${publishServer.serverIp}].`);

    // 服务器信息
    const osName = displayOs(Number(publishServer.serverOs));
    const username = publishServer.serverAccount;
    const password = await aesDecrypt(String(publishServer.serverPwd));
    const server = `${publishServer.serverIp}:${publishServer.serverPort}`;

    // 服务配置信息
    for (let j = 0; j < publishServer.serverConfigs.length; j++) {
      const serverConfig = publishServer.serverConfigs[j];
      const backupPath = getBackupPath(serverConfig.publishPath, currentDate, backupBasePath);

      // 创建备份目录
      let createDirCmd;
      if (osName == "Windows") {
        createDirCmd = `if not exist "${backupPath}" mkdir "${backupPath}"`;
        createDirCmd = createDirCmd.replace(/\//g, "\\");
      } else {
        createDirCmd = `mkdir -p "${backupPath}"`;
      }
      await cmdInvoke("execute_remote_command", {
        username,
        password,
        server,
        command: createDirCmd,
      });

      // 备份涉及的发布文件
      const currLogIndex = printInfoLog(`${serverConfig.serverIdentity}.`);
      let uploadFileNumber: UploadFileNumberType = {
        currNumber: 0,
        totalNumber: 0,
        prefix: "已备份：",
      };
      uploadFileNumber.totalNumber = serverConfig.publishFiles.length;
      for (let bk = 0; bk < serverConfig.publishFiles.length; bk++) {
        const backFile = serverConfig.publishFiles[bk];
        let command;
        const pPath = `${removeSlash(serverConfig.publishPath)}/${backFile}`;
        const bPath = `${removeSlash(backupPath)}/${backFile}`;
        if (osName === "Windows") {
          command = `if exist "${pPath}" copy "${pPath}" "${bPath}"`;
          command = command.replace(/\//g, "\\") + " /Y";
        } else {
          command = `[ -e "${pPath}" ] && cp "${pPath}" "${bPath}"`;
        }
        const execRemoteCmdResult = await cmdInvoke("execute_remote_command", {
          username,
          password,
          server,
          command,
        });
        if (execRemoteCmdResult.code !== 0) {
          execResult.code = 1;
          execResult.msg = `服务 ${serverName} 备份失败：${execRemoteCmdResult.data}`;
          return execResult;
        }
        uploadFileNumber.currNumber++;
        logPrintInfo.value[currLogIndex].content.uploadFile.prefix =
          uploadFileNumber.prefix;
        logPrintInfo.value[currLogIndex].content.uploadFile.currNumber =
          uploadFileNumber.currNumber;
        logPrintInfo.value[currLogIndex].content.uploadFile.totalNumber =
          uploadFileNumber.totalNumber;
      }
    }
  }

  execResult.msg = `服务 ${serverName} 备份成功！`;
  printInfoLog(execResult.msg, "log-success");
  printInfoLog("");
  return execResult;
};

// [远程]切换Windows服务
const switchRemoteWinService = async (
  username: string,
  password: string,
  server: string,
  serviceName: string,
  action: "stop" | "start"
) => {
  const isStop = await isRemoteWinServiceStop(username, password, server, serviceName);
  if (action == "stop" && isStop) return true;
  if (action == "start" && !isStop) return true;
  const switchServerResult = await cmdInvoke("execute_remote_command", {
    username,
    password,
    server,
    command: `net ${action} "${serviceName}"`,
    ...getRetryArgs("serviceStop"),
  });
  if (switchServerResult.code !== 0) printInfoLog(switchServerResult.data, "log-error");
  return switchServerResult.code === 0;
};

// [远程]切换Docker服务
const switchRemoteDockerService = async (
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

// [远程]验证[Windows]服务是否已关闭
const isRemoteWinServiceStop = async (
  username: string,
  password: string,
  server: string,
  serviceName: string
) => {
  const invokeResult = await cmdInvoke<string>("execute_remote_command", {
    username,
    password,
    server,
    command: `sc query "${serviceName}"`,
  });
  if (invokeResult.data.includes("STOPPED")) {
    return true;
  }
  return false;
};

// 获取备份路径
const getBackupPath = (path: string, currentDate: string, backupBasePath?: string | null) => {
  const bkPath = removeSlash(path);
  const bkLastIndex = bkPath.lastIndexOf("/");
  const folderName = currentDate.replace(/-/g, "").replace(/:/g, "").replace(/\s+/g, "");
  const fileName = bkPath.substring(bkLastIndex + 1);

  // 有自定义基础路径 → 使用自定义路径作为前缀
  if (backupBasePath) {
    return `${removeSlash(backupBasePath)}/${folderName}/${fileName}`;
  }

  // 无自定义路径 → 保持现有逻辑
  const backupPrefixPath = bkPath.substring(0, bkLastIndex);
  return `${backupPrefixPath}/Backups/${folderName}/${fileName}`;
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

// 清空日志
const onRemoveLogs = () => {
  logPrintInfo.value = [];
};

// 初始化日志
const initLogs = () => {
  printInfoLog("项目名称：" + publishConfig.projectName);
  printInfoLog("项目环境：" + displayEnvironment(publishConfig.environment));
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
    mpLogContentRef.value.scrollTop = mpLogContentRef.value.scrollHeight;
  });
  return logPrintInfo.value.length - 1;
};

// 页面加载完时
onBeforeMount(async () => {
  console.log("页面加载完毕");
});
</script>

<style scoped lang="scss">
.publish-container {
  overflow: hidden;
  .publish-card-box,
  .publish-card-config {
    .publish-box {
      width: 100%;
      text-align: center;
      .publish-bg-logo {
        margin: 0px auto;
      }
    }
    .publish-card-item {
      width: 100%;
      height: 130px;
      border-radius: 4px;
      transition: all ease 0.3s;
      overflow: hidden;
      background: var(--el-color-white);
      color: var(--el-text-color-primary);
      border: 1px solid var(--next-border-color-light);
      .card-item-title {
        font-size: 16px;
        color: #506c88;
        text-align: center;
        line-height: 30px;
      }
      .card-title {
        padding: 12px 10px 10px 10px;
        height: 45px;
        font-size: 15px;
        border-bottom: 1px #dfdfdf dashed;
        align-content: flex-end;
        .item-btn-box {
          width: 100%;
          text-align: right;
        }
      }
      .card-item-content {
        height: calc(100vh - 308px);
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

          .publish-content {
            width: 100%;
            white-space: pre-wrap;
            word-wrap: break-word;
            margin: 3px 0px;
          }

          .card-publish-btn {
            width: 100%;
            text-align: center;
            padding-top: 10px;
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
      .mp-log-content {
        background-color: #545c64;
        counter-reset: line-number;
        padding-right: 1em;
        text-align: left;
      }
    }
  }
  .publish-card-box {
    .publish-card-item {
      padding: 20px;
      cursor: pointer;
    }
  }
  .publish-card-config {
    .publish-card-item {
      height: calc(100vh - 260px);
      width: 100%;
      // overflow-y: auto;
      .card-item-box {
        height: 100%;
      }
    }
  }
  .t-align-c {
    text-align: center !important;
  }
  .mb0 {
    margin-bottom: 0px !important;
  }
  .t-border-none {
    border: 0px solid white !important;
  }
}
</style>

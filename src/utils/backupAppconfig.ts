import { ElLoading } from "element-plus";
import { useAppconfigDb } from "@/database/appconfig/index";
import { formatDate } from "@/utils/formatTime";
import { useServerDb } from "@/database/servers/index";
import { cmdInvoke } from "@/utils/command";
import { displayOs, removeSlash } from "@/utils/other";
import { useTfsDb } from "@/database/teamFoundationServer/index";
import { useGitDb } from "@/database/git/index";
import { getDllFilesByChangedItems, getTfsChangedPath } from "@/utils/outPublishInfo";

// 查询Tfs信息
const getTfsDetail = async (id: number) => {
  let dataResult = await useTfsDb().getTfsById(id);
  if (dataResult.code !== 0) {
    console.error(dataResult.msg);
    return null;
  }
  return dataResult.data.data;
};

// 构造TFS命令
export const getTfsDllFiles = async (selectTfsItem: SelectTfsType) => {
  const tfsItem = await getTfsDetail(Number(selectTfsItem.id));
  if (!tfsItem) return null;
  // 构造命令行
  let execArgs = new Array<string>();
  execArgs.push("history");
  execArgs.push(`/collection:${tfsItem.tfsServerUrl}`);
  execArgs.push(`${tfsItem.tfsSourcePath}`);
  execArgs.push("/noprompt");
  if (selectTfsItem.selectModel === "日期") {
    const bDate = new Date(selectTfsItem.selectValue[0].value);
    const beginDate = formatDate(bDate, "DYYYY-mm-ddTHH:MM:SS");
    let endDate = "";
    if (selectTfsItem.selectValue[1].value) {
      const eDate = new Date(selectTfsItem.selectValue[1].value);
      endDate = formatDate(eDate, "DYYYY-mm-ddTHH:MM:SS");
    }
    execArgs.push(`-V:${beginDate}~${endDate}`);
  }
  if (selectTfsItem.selectModel === "变更集") {
    const beginChangeSets = `C${selectTfsItem.selectValue[0].value}`;
    let endChangeSets = "";
    if (selectTfsItem.selectValue[1].value) {
      endChangeSets = `C${selectTfsItem.selectValue[1].value}`;
    }
    execArgs.push(`-V:${beginChangeSets}~${endChangeSets}`);
  }
  execArgs.push("-R");
  execArgs.push("-F:detailed");
  console.log('execArgs',execArgs);
  
  const execResult = await cmdInvoke("execute_local_command", {
    command: tfsItem.tfvcPath,
    args: execArgs,
  });
  if (execResult.code !== 0) {
    console.error(`TFS命令执行失败：${execResult.data}`);
    return null;
  }

  // 筛选变更项
  const lines = execResult.data.split("\n");
  const tfsItems = lines
    .map((line: string) => getTfsChangedPath(line, tfsItem.tfsSourcePath))
    .filter((item: string) => item);
  return await getDllFilesByChangedItems(tfsItems, {
    repositoryPath: tfsItem.tfsLocalPath,
    sourcePath: tfsItem.tfsSourcePath,
  });
};

const getGitDetail = async (id: number) => {
  let dataResult = await useGitDb().getGitById(id);
  if (dataResult.code !== 0) {
    console.error(dataResult.msg);
    return null;
  }
  return dataResult.data.data;
};

export const getGitDllFiles = async (selectGitItem: SelectGitType) => {
  // 获取Git详情
  const gitItem = await getGitDetail(Number(selectGitItem.id));
  if (!gitItem) return null;

  // 构造命令行
  let execArgs = new Array<string | null>();
  execArgs.push("log");
  execArgs.push("--pretty=format:%H|%an|%ae|%ad|%s"); // 格式化输出
  execArgs.push("--name-status"); // 包含文件变更状态

  if (selectGitItem.selectModel === "日期") {
    const bDate = new Date(selectGitItem.selectValue[0].value);
    const beginDate = formatDate(bDate, "YYYY-mm-ddTHH:MM:SS");
    let endDate = "";
    if (selectGitItem.selectValue[1].value) {
      const eDate = new Date(selectGitItem.selectValue[1].value);
      endDate = formatDate(eDate, "YYYY-mm-ddTHH:MM:SS");
    }
    execArgs.push(`--since=${beginDate}`);
    if (endDate) {
      execArgs.push(`--until=${endDate}`);
    }
  }
  if (selectGitItem.selectModel === "commit") {
    const startSha = selectGitItem.selectValue[0].value;
    const endSha = selectGitItem.selectValue[1].value;
    // 如果只填写了起始SHA，则查询从该SHA到HEAD的所有提交（包含起始SHA）
    if (startSha && !endSha) {
      execArgs.push(`${startSha}..HEAD`);
    }
    // 如果填写了起始和结束SHA，则查询范围（包含起始SHA和结束SHA）
    else if (startSha && endSha) {
      execArgs.push(`${startSha}^..${endSha}`);
    }
    // 如果只填写了结束SHA（理论上不应该发生）
    else if (!startSha && endSha) {
      execArgs.push(endSha);
    }
  }
  execArgs.push(gitItem.branchName);
  const execResult = await cmdInvoke("execute_local_command_with_working_dir", {
    command: gitItem.gitPath,
    args: execArgs,
    workingDir: gitItem.gitRepository
  });

  if (execResult.code !== 0) {
    console.error(`Git命令执行失败：${execResult.data}`);
    return null;
  }
  const lines = execResult.data.split("\n");

  // 解析 Git 日志，提取文件变更部分
  let gitItems: string[] = [];
  // 根据提供的Git日志格式，解析包含提交信息和文件变更的格式
  let currentLineIndex = 0;
  while (currentLineIndex < lines.length) {
    const line = lines[currentLineIndex];
    // 匹配提交哈希、作者、邮箱、日期和提交信息的格式
    if (/^[a-f0-9]{40}\|/.test(line)) {
      // 这是包含提交信息的一行，跳过
    } else if (line.trim() && !line.startsWith('commit') && !line.startsWith('Author:') && !line.startsWith('Date:')) {
      // 这可能是文件变更行，格式如：M	Modules/Common/Items/SIE.Items/Items/ItemController.cs
      const fileChangeMatch = line.match(/^([MAD])\s+(.+)$/);
      if (fileChangeMatch) {
        gitItems.push(fileChangeMatch[2].trim());
      }
    }
    currentLineIndex++;
  }
  return await getDllFilesByChangedItems(gitItems, {
    repositoryPath: gitItem.gitRepository,
  });
};

/**
 * 读取所有的dll文件
 * @param clientPath 文件目录
 * @returns
 */
export async function getReadAllDlls(clientPath: string) {
  let allDllFiles = new Array<string>();
  const readDllResult = await cmdInvoke("read_all_dlls", {
    dir: clientPath,
  });
  if (readDllResult.code === 0 && readDllResult.data) {
    allDllFiles.push(...readDllResult.data);
  }
  for (let i = 0; i < allDllFiles.length; i++) {
    let allDllFilePath = removeSlash(allDllFiles[i]);
    const dllFile = allDllFilePath.substring(allDllFilePath.lastIndexOf('/') + 1)
    allDllFiles[i] = dllFile;
  }
  return allDllFiles;
};

// 获取服务器备份项
const getServerBackupItems = async (
  appconfigData: any,
  currentDate: string,
  itemName: string
) => {
  const serverConfigItem = appconfigData.configItems[itemName] as
    | WebApiHostConfigType
    | WebClientConfigType
    | SpcMonitorConfigType;
  if (!serverConfigItem) return null;
  var backupServer: BackupServerType[] = new Array<BackupServerType>();
  for (let i = 0; i < serverConfigItem.serverArr.length; i++) {
    if (!serverConfigItem.clientPath) continue;
    const server = serverConfigItem.serverArr[i];
    var backupPaths: BackupPathType[] = new Array<BackupPathType>();
    for (let j = 0; j < server.serverPathArr.length; j++) {
      const serverPath = server.serverPathArr[j];
      if (!serverPath.value) continue;
      for (let k = 0; k < serverPath.value.length; k++) {
        const pathValue = serverPath.value[k];
        // 备份路径
        const bkPath = removeSlash(String(pathValue.path));
        const bkLastIndex = bkPath.lastIndexOf("/");
        const backupPrefixPath = bkPath.substring(0, bkLastIndex);
        const folderName = currentDate
          .replace(/-/g, "")
          .replace(/:/g, "")
          .replace(/\s+/g, "");

        let backFiles = new Array<string>();
        if (appconfigData.dllMode == "TFS") {
          if (!appconfigData.dllModeValue) {
            console.error("未配置TFS获取程序集的相关信息，请检查.");
            return null;
          }
          const selectTfsItem = JSON.parse(
            appconfigData.dllModeValue
          ) as SelectTfsType;
          const dllFiles = await getTfsDllFiles(selectTfsItem);
          if (dllFiles && dllFiles.length > 0) {
            let allDllFiles = await getReadAllDlls(serverConfigItem.clientPath);
            for (let m = 0; m < allDllFiles.length; m++) {
              const dllFile = allDllFiles[m];
              const tfsDllFile = dllFiles.find((x) => x === dllFile);
              if (tfsDllFile) {
                backFiles.push(dllFile);
              }
            }
          }
        } else {
          let dllModeDateRange = getDllModeDateRange(
            appconfigData.dllMode,
            appconfigData.dllModeValue
          );
          if (dllModeDateRange.length < 1) {
            let allDllFiles = await getReadAllDlls(serverConfigItem.clientPath);
            backFiles.push(...allDllFiles);
          } else {
            const readDllDateResult = await cmdInvoke(
              "read_dlls_in_date_range",
              {
                dir: serverConfigItem.clientPath,
                startDate: dllModeDateRange[0],
                endDate: dllModeDateRange[1],
              }
            );
            if (readDllDateResult.code === 0 && readDllDateResult.data) {
              backFiles.push(...readDllDateResult.data);
            }
          }
          for (let m = 0; m < backFiles.length; m++) {
            const dllFilePath = removeSlash(backFiles[m]);
            backFiles[m] = dllFilePath.substring(
              dllFilePath.lastIndexOf("/") + 1
            );
          }
        }

        // 发布路径
        const publishPath = removeSlash(String(pathValue.path));
        backupPaths.push({
          identity: String(pathValue.identity),
          publishPath,
          backupPath: `${backupPrefixPath}/Backups/${folderName}/${bkPath.substring(
            bkLastIndex + 1
          )}`,
          backFiles,
        });
      }
    }
    backupServer.push({
      serverId: Number(server.id),
      serverName: String(server.name),
      backupPaths,
    });
  }
  return backupServer;
};

// 获取调度服务器备份项
const getScheduleServerBackupItems = async (
  appconfigData: any,
  currentDate: string,
  itemName: string
) => {
  const serverConfigItem = appconfigData.configItems[
    itemName
  ] as ScheduleServerConfigType;
  if (!serverConfigItem || !serverConfigItem.clientPath) return null;
  var backupServer: BackupServerType[] = new Array<BackupServerType>();

  // 遍历所有服务器配置
  for (let i = 0; i < serverConfigItem.serverArr.length; i++) {
    const scheduleServer = serverConfigItem.serverArr[i];
    if (!scheduleServer.id) continue;

    var backupPaths: BackupPathType[] = new Array<BackupPathType>();

    // 遍历服务器的所有路径配置
    for (let j = 0; j < scheduleServer.serverPathArr.length; j++) {
      const serverPath = scheduleServer.serverPathArr[j];
      if (!serverPath.value) continue;

      for (let k = 0; k < serverPath.value.length; k++) {
        const pathValue = serverPath.value[k];

        // 备份路径
        const bkPath = removeSlash(String(pathValue.path));
        const bkLastIndex = bkPath.lastIndexOf("/");
        const backupPrefixPath = bkPath.substring(0, bkLastIndex);
        const folderName = currentDate
          .replace(/-/g, "")
          .replace(/:/g, "")
          .replace(/\s+/g, "");

        let backFiles = new Array<string>();
        if (appconfigData.dllMode == "TFS") {
          if (!appconfigData.dllModeValue) {
            console.error("未配置TFS获取程序集的相关信息，请检查.");
            return null;
          }
          const selectTfsItem = JSON.parse(
            appconfigData.dllModeValue
          ) as SelectTfsType;
          const dllFiles = await getTfsDllFiles(selectTfsItem);
          if (dllFiles && dllFiles.length > 0) {
            let allDllFiles = await getReadAllDlls(serverConfigItem.clientPath);
            for (let m = 0; m < allDllFiles.length; m++) {
              const dllFile = allDllFiles[m];
              const tfsDllFile = dllFiles.find((x) => x === dllFile);
              if (tfsDllFile) {
                backFiles.push(dllFile);
              }
            }
          }
        } else {
          let dllModeDateRange = getDllModeDateRange(
            appconfigData.dllMode,
            appconfigData.dllModeValue
          );
          if (dllModeDateRange.length < 1) {
            let allDllFiles = await getReadAllDlls(serverConfigItem.clientPath);
            backFiles.push(...allDllFiles);
          } else {
            const readDllDateResult = await cmdInvoke("read_dlls_in_date_range", {
              dir: serverConfigItem.clientPath,
              startDate: dllModeDateRange[0],
              endDate: dllModeDateRange[1],
            });
            if (readDllDateResult.code === 0 && readDllDateResult.data) {
              backFiles.push(...readDllDateResult.data);
            }
          }
          for (let m = 0; m < backFiles.length; m++) {
            const dllFilePath = removeSlash(backFiles[m]);
            backFiles[m] = dllFilePath.substring(dllFilePath.lastIndexOf("/") + 1);
          }
        }

        // 发布路径
        const publishPath = removeSlash(String(pathValue.path));
        backupPaths.push({
          identity: String(pathValue.identity),
          publishPath,
          backupPath: `${backupPrefixPath}/Backups/${folderName}/${bkPath.substring(
            bkLastIndex + 1
          )}`,
          backFiles,
        });
      }
    }

    // 如果有备份路径，则添加到backupServer数组
    if (backupPaths.length > 0) {
      backupServer.push({
        serverId: Number(scheduleServer.id),
        serverName: String(scheduleServer.name),
        backupPaths,
      });
    }
  }

  return backupServer;
};

// 获取WPF服务器备份项
const getWpfClientConfigType = async (
  appconfigData: any,
  currentDate: string,
  itemName: string
) => {
  const serverConfigItem = appconfigData.configItems[
    itemName
  ] as WpfClientConfigType;
  if (!serverConfigItem) return null;
  var backupServer: BackupServerType[] = new Array<BackupServerType>();

  // 备份路径
  const bkPath = removeSlash(String(serverConfigItem.serverPath));
  const bkLastIndex = bkPath.lastIndexOf("/");
  const backupPrefixPath = bkPath.substring(0, bkLastIndex);
  const folderName = currentDate
    .replace(/-/g, "")
    .replace(/:/g, "")
    .replace(/\s+/g, "");

  if (!serverConfigItem.generateDirJson || !serverConfigItem.clientPath)
    return null;

  var backFiles = new Array();
  const generateDirs = JSON.parse(serverConfigItem.generateDirJson) as string[];
  for (let i = 0; i < generateDirs.length; i++) {
    const generateDir = generateDirs[i];
    const cPath =
      removeSlash(serverConfigItem.clientPath) + "/" + removeSlash(generateDir);
    if (appconfigData.dllMode == "TFS") {
      if (!appconfigData.dllModeValue) {
        console.error("未配置TFS获取程序集的相关信息，请检查.");
        return null;
      }
      const selectTfsItem = JSON.parse(
        appconfigData.dllModeValue
      ) as SelectTfsType;
      const dllFiles = await getTfsDllFiles(selectTfsItem);
      var cBackFile = {} as any;
      cBackFile[generateDir] = [];
      if (dllFiles && dllFiles.length > 0) {
        let allDllFiles = await getReadAllDlls(cPath);
        for (let m = 0; m < allDllFiles.length; m++) {
          const dllFile = allDllFiles[m];
          const tfsDllFile = dllFiles.find((x) => x === dllFile);
          if (tfsDllFile) {
            cBackFile[generateDir].push(dllFile);
          }
        }
      }
      backFiles.push(cBackFile);
    } else if (appconfigData.dllMode == "DLL名称") {
      const patterns = getDllModePatterns(appconfigData.dllMode, appconfigData.dllModeValue);
      if (!patterns) {
        console.error("未配置DLL名称获取程序集的相关信息，请检查.");
        return null;
      }
      var cBackFile = {} as any;
      cBackFile[generateDir] = [];
      let allDllFiles = await getReadAllDlls(cPath);
      cBackFile[generateDir].push(...allDllFiles);
      backFiles.push(cBackFile);
    } else {
      let dllModeDateRange = getDllModeDateRange(
        appconfigData.dllMode,
        appconfigData.dllModeValue
      );
      if (dllModeDateRange.length < 1) {
        var cBackFile = {} as any;
        cBackFile[generateDir] = [];
        let allDllFiles = await getReadAllDlls(cPath);
        cBackFile[generateDir].push(...allDllFiles);
        backFiles.push(cBackFile);
      } else {
        const readDllDateResult = await cmdInvoke("read_dlls_in_date_range", {
          dir: cPath,
          startDate: dllModeDateRange[0],
          endDate: dllModeDateRange[1],
        });
        if (readDllDateResult.code === 0 && readDllDateResult.data) {
          var cBackFile = {} as any;
          cBackFile[generateDir] = [];
          cBackFile[generateDir].push(...readDllDateResult.data);
          backFiles.push(cBackFile);
        }
      }
    }
    for (let m = 0; m < backFiles.length; m++) {
      const backFile = backFiles[m];
      for (let bfDir in backFile) {
        for (let bf = 0; bf < backFile[bfDir].length; bf++) {
          const dllFilePath = removeSlash(backFile[bfDir][bf]);
          backFile[bfDir][bf] = dllFilePath.substring(
            dllFilePath.lastIndexOf("/") + 1
          );
        }
      }
    }
  }

  // 发布路径
  const publishPath = removeSlash(String(serverConfigItem.serverPath));
  backupServer.push({
    serverId: Number(serverConfigItem.serverId),
    serverName: String(serverConfigItem.serverName),
    backupPaths: [
      {
        identity: "WpfClient",
        publishPath,
        backupPath: `${backupPrefixPath}/Backups/${folderName}/${bkPath.substring(
          bkLastIndex + 1
        )}`,
        backFiles,
      },
    ],
  });
  return backupServer;
};

// 查询服务信息
const getServerDetail = async (id: number) => {
  let dataResult = await useServerDb().getServerById(id);
  if (dataResult.code !== 0) {
    return null;
  }
  return dataResult.data.data;
};

// 获取Dll日期范围
const getDllModeDateRange = (dllMode: string, dllModeValue: string) => {
  let startDate = "";
  let endDate = "";
  if (dllMode == "当天") {
    startDate = formatDate(new Date(), "YYYY-mm-dd 00:00:00");
    endDate = formatDate(new Date(), "YYYY-mm-dd 23:59:59");
  }
  if (dllMode == "最近3天") {
    const threeDaysAgo = new Date(
      new Date().getTime() - 3 * 24 * 60 * 60 * 1000
    );
    startDate = formatDate(threeDaysAgo, "YYYY-mm-dd 00:00:00");
    endDate = formatDate(new Date(), "YYYY-mm-dd 23:59:59");
  }
  if (dllMode == "日期范围") {
    const modeDates = JSON.parse(String(dllModeValue));
    startDate = modeDates[0];
    endDate = modeDates[1];
  }
  if (!startDate || !endDate) return [];
  return [startDate, endDate];
};

// 获取DLL名称模式
const getDllModePatterns = (dllMode: string, dllModeValue: string) => {
  if (dllMode == "DLL名称") {
    return String(dllModeValue || "");
  }
  return "";
};

/**
 * 加载备份项
 * @param appconfigId 配置ID
 * @returns 备份项
 */
export async function loadBackupItems(
  appconfigId: number,
  remark: string = "",
  showLoading: boolean = true
) {
  // 获取应用配置
  const appConfigResult = await useAppconfigDb().getAppconfigById(appconfigId);
  if (appConfigResult.code !== 0) return false;

  // 备份记录
  let appConfigItem = appConfigResult.data.data;
  let currentDate = formatDate(new Date(), "YYYY-mm-dd HH:MM:SS");

  let dllMode = appConfigItem.dllMode;
  let dllModeValue = appConfigItem.dllModeValue;
  if (dllMode === "当天" || dllMode === "最近3天") {
    let mValue = getDllModeDateRange(dllMode, String(dllModeValue));
    dllModeValue = JSON.stringify(mValue);
    dllMode = "日期范围";
  }
  let loading = null;
  if (showLoading) {
    loading = ElLoading.service({
      lock: false,
      text: "正在获取，请稍等...",
      background: "rgba(0, 0, 0, 0)",
    });
  }

  var backupData: RowBackupType = {
    id: 0,
    projectId: appConfigItem.projectId,
    projectName: appConfigItem.projectName,
    environment: appConfigItem.environment,
    backupDate: currentDate,
    remark,
    backupItemsJson: "",
    backupItems: {
      dllMode,
      dllModeValue,
      webApiHost: await getServerBackupItems(
        appConfigItem,
        currentDate,
        "webApiHost"
      ),
      scheduleServer: await getScheduleServerBackupItems(
        appConfigItem,
        currentDate,
        "scheduleServer"
      ),
      webClient: await getServerBackupItems(
        appConfigItem,
        currentDate,
        "webClient"
      ),
      wpfClient: await getWpfClientConfigType(
        appConfigItem,
        currentDate,
        "wpfClient"
      ),
      spcMonitor: await getServerBackupItems(
        appConfigItem,
        currentDate,
        "spcMonitor"
      ),
      isNewVersion: appConfigItem.configItems.isNewVersion
    },
  };
  backupData.backupItemsJson = JSON.stringify(backupData.backupItems);
  if (loading) loading.close();
  return backupData;
}

/**
 * 获取远程备份文件数量
 * @param backupServers 备份服务
 * @returns
 */
export function getUploadFileNumber(
  backupServers: BackupServerType[] | null
) {
  let uploadFileNumber: UploadFileNumberType = {
    currNumber: 0,
    totalNumber: 0,
  };
  if (!backupServers || backupServers.length < 1) return uploadFileNumber;
  for (let i = 0; i < backupServers.length; i++) {
    const backupServer = backupServers[i];
    for (let j = 0; j < backupServer.backupPaths.length; j++) {
      const backupPathItem = backupServer.backupPaths[j];
      for (let bk = 0; bk < backupPathItem.backFiles.length; bk++) {
        const backFile = backupPathItem.backFiles[bk];
        if (typeof backFile === "string") {
          uploadFileNumber.totalNumber += backupPathItem.backFiles.length;
          break;
        } else {
          for (let bfDir in backFile) {
            const bfFiles = backFile[bfDir];
            if (!bfFiles || bfFiles.length < 1) continue;
            uploadFileNumber.totalNumber += bfFiles.length;
            break;
          }
        }
      }
    }
  }
  return uploadFileNumber;
}

/**
 * 备份远程服务
 * @param serverName 服务名称
 * @param backupServers 备份服务
 * @param isNewVision 是否新版本
 * @returns
 */
export async function backupRemoteServer(
  serverName: string,
  backupServers: BackupServerType[] | null,
  callback: Function | null = null,
  isNewVision: boolean = false
) {
  let execResult: DataResultType<boolean> = {
    code: 0,
    msg: "",
    data: true,
  };
  if (!backupServers || backupServers.length < 1) {
    execResult.msg = "没有可备份的服务！";
    return execResult;
  }
  let uploadFileNumber = getUploadFileNumber(backupServers);
  uploadFileNumber.prefix = "已备份：";
  for (let i = 0; i < backupServers.length; i++) {
    const backupServer = backupServers[i];
    const serverDetail = await getServerDetail(backupServer.serverId);
    if (!serverDetail) {
      execResult.code = 1;
      execResult.msg = `服务器[${backupServer.serverName}]不存在，请检查！`;
      return execResult;
    }
    const osName = displayOs(serverDetail.os);
    const username = serverDetail.account;
    const password = serverDetail.pwd;
    const server = `${serverDetail.ip}:${serverDetail.port}`;
    for (let j = 0; j < backupServer.backupPaths.length; j++) {
      const backupPathItem = backupServer.backupPaths[j];
      const publishPath = removeSlash(backupPathItem.publishPath);
      const backupPath = removeSlash(backupPathItem.backupPath);

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
      for (let bk = 0; bk < backupPathItem.backFiles.length; bk++) {
        const backFile = backupPathItem.backFiles[bk];
        if (typeof backFile === "string") {
          let command;
          const pPath = `${publishPath}/${backFile}`;
          const bPath = `${backupPath}/${backFile}`;
          if (osName === "Windows") {
            command = `if exist "${pPath}" copy "${pPath}" "${bPath}"`;
            command = command.replace(/\//g, "\\") + " /Y";
          } else {
            command = `[ -e "${pPath}" ] && cp "${pPath}" "${bPath}"`;
          }
          const execRemoteCmdResult = await cmdInvoke(
            "execute_remote_command",
            {
              username,
              password,
              server,
              command,
            }
          );
          if (execRemoteCmdResult.code !== 0) {
            execResult.code = 1;
            execResult.msg = `服务[${serverName}]备份失败：${execRemoteCmdResult.data}`;
            return execResult;
          }
          uploadFileNumber.currNumber++;
          if (callback) callback(uploadFileNumber);
        } else {
          for (let bfDir in backFile) {
            const bfFiles = backFile[bfDir];
            if (!bfFiles || bfFiles.length < 1) continue;

            // 创建备份目录
            let createDirCmd;
            if (osName === "Windows") {
              createDirCmd = `if not exist "${backupPath}/${bfDir}" mkdir "${backupPath}/${bfDir}"`;
              createDirCmd = createDirCmd.replace(/\//g, "\\");
            } else {
              createDirCmd = `mkdir -p "${backupPath}/${bfDir}"`;
            }
            await cmdInvoke("execute_remote_command", {
              username,
              password,
              server,
              command: createDirCmd,
            });

            // 创建一个缓存目录
            let cacheDir = `${publishPath}/cacheDir`;
            if (bfDir === "Domain" || bfDir === "UI") {
              cacheDir += `/Plugins`;
            }
            /*
            else if(isNewVision && (bfDir == "Plugins" || bfDir == "Lib"))
            {
              // ...
            }
            */
            else {
              cacheDir += `/${bfDir}`;
            }
            let cacheDirCmd;
            if (osName === "Windows") {
              cacheDirCmd = `if not exist "${cacheDir}" mkdir "${cacheDir}"`;
              cacheDirCmd = cacheDirCmd.replace(/\//g, "\\");
            } else {
              cacheDirCmd = `mkdir -p "${cacheDir}"`;
            }
            await cmdInvoke("execute_remote_command", {
              username,
              password,
              server,
              command: cacheDirCmd,
            });

            // 解压
            const zipFileName =
              cacheDir.substring(cacheDir.lastIndexOf("/") + 1) + ".zip";
            let unZipCmd;
            if (osName === "Windows") {
              unZipCmd = `tar -xf "${publishPath}/${zipFileName}" -C "${cacheDir}"`;
              unZipCmd = unZipCmd.replace(/\//g, "\\");
            } else {
              unZipCmd = `unzip -o ${publishPath}/${zipFileName} -d ${cacheDir}`;
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
            for (let bf = 0; bf < bfFiles.length; bf++) {
              let pPath = `${cacheDir}/${bfDir}/${bfFiles[bf]}`;
              if (isNewVision && (bfDir == "Plugins" || bfDir == "Lib")) {
                pPath = `${cacheDir}/${bfFiles[bf]}`;
              }
              const bPath = `${backupPath}/${bfDir}/${bfFiles[bf]}`;
              let command;
              if (osName === "Windows") {
                command = `copy "${pPath}" "${bPath}"`;
                command = command.replace(/\//g, "\\") + " /Y";
              } else {
                command = `cp ${pPath} ${bPath}`;
              }
              const execRemoteCmdResult = await cmdInvoke(
                "execute_remote_command",
                {
                  username,
                  password,
                  server,
                  command,
                }
              );
              if (execRemoteCmdResult.code !== 0) {
                execResult.code = 1;
                execResult.msg = `服务[${serverName}]备份失败，请检查！`;
                return execResult;
              }
              uploadFileNumber.currNumber++;
              if (callback) callback(uploadFileNumber);
            }
          }
        }
      }

      // 删除缓存目录
      let removeTempDirCmd;
      if (osName === "Windows") {
        const rmPath = publishPath.replace(/\//g, "\\") + "\\cacheDir";
        removeTempDirCmd = `if exist "${rmPath}" rd /s /q "${rmPath}"`;
      } else {
        removeTempDirCmd = `rm -rf ${publishPath}/cacheDir`;
      }
      await cmdInvoke("execute_remote_command", {
        username,
        password,
        server,
        command: removeTempDirCmd,
      });
    }
  }
  execResult.msg = `服务[${serverName}]备份成功！`;
  return execResult;
}

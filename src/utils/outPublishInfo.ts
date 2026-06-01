import { path } from "@tauri-apps/api";
import { cmdInvoke } from "@/utils/command";
import { formatDate,formatGitDate } from "@/utils/formatTime";
import {
  removeSlash
} from "@/utils/other";

export type DllResolveOptions = {
    repositoryPath?: string | null;
    sourcePath?: string | null;
};

const getChangedCsprojInfo = (item: string) => {
    const normalizedItem = item.trim().replace(/\\/g, "/");
    const matches = [...normalizedItem.matchAll(/([^\s"'<>|]+?\.csproj)/gi)];
    if (matches.length < 1) return null;

    const projectPath = matches[matches.length - 1][1];
    const fileNameMatch = projectPath.match(/([^/]+)\.csproj$/i);
    if (!fileNameMatch) return null;

    return {
        projectPath,
        projectName: fileNameMatch[1],
    };
};

const getChangedCsprojPath = (projectPath: string, options: DllResolveOptions = {}) => {
    if (/^[a-zA-Z]:\//.test(projectPath) || projectPath.startsWith("//")) return projectPath;
    if (projectPath.startsWith("$/")) {
        if (!options.repositoryPath || !options.sourcePath) return "";
        const normalizedProjectPath = removeSlash(projectPath, "/");
        const normalizedSourcePath = removeSlash(options.sourcePath, "/");
        if (!normalizedProjectPath.toLowerCase().startsWith(normalizedSourcePath.toLowerCase())) return "";
        const relativePath = normalizedProjectPath.slice(normalizedSourcePath.length).replace(/^\/+/, "");
        return relativePath ? `${removeSlash(options.repositoryPath)}/${relativePath}` : removeSlash(options.repositoryPath);
    }
    if (!options.repositoryPath) return "";

    return `${removeSlash(options.repositoryPath)}/${projectPath.replace(/^\/+/, "")}`;
};

const getChangedSieDirectoryInfo = (item: string) => {
    const normalizedItem = item.trim().replace(/\\/g, "/");
    const matches = [...normalizedItem.matchAll(/(^|\/)(SIE\.[^/\s"'<>|]+)(?=\/|$)/g)];
    if (matches.length < 1) return null;

    const match = matches[matches.length - 1];
    const directoryPath = normalizedItem.slice(0, Number(match.index) + match[0].length);

    return {
        directoryPath,
        directoryName: match[2],
    };
};

const getAssemblyName = async (projectPath: string) => {
    if (!projectPath) return "";
    const assemblyNameResult = await cmdInvoke<string | null>("find_assembly_name", {
        projectPath,
    });
    if (assemblyNameResult.code !== 0 || !assemblyNameResult.data) return "";
    return assemblyNameResult.data;
};

const getDllFileByCsprojInfo = async (csprojInfo: NonNullable<ReturnType<typeof getChangedCsprojInfo>>, options: DllResolveOptions = {}) => {
    const projectPath = getChangedCsprojPath(csprojInfo.projectPath, options);
    const assemblyName = await getAssemblyName(projectPath);
    return `${assemblyName || csprojInfo.projectName}.dll`;
};

const getCsprojInfoFromDirectory = async (directoryPath: string, directoryName: string) => {
    const readFilesResult = await cmdInvoke<string[]>("read_files", {
        path: directoryPath,
    });
    if (readFilesResult.code !== 0 || !readFilesResult.data) return null;

    const csprojFiles = readFilesResult.data
        .filter((fileName) => fileName.toLowerCase().endsWith(".csproj"))
        .sort((a, b) => a.localeCompare(b));
    if (csprojFiles.length < 1) return null;

    const preferredProjectFile = csprojFiles.find(
        (fileName) => fileName.slice(0, -".csproj".length).toLowerCase() === directoryName.toLowerCase()
    ) || csprojFiles[0];

    return getChangedCsprojInfo(`${removeSlash(directoryPath)}/${preferredProjectFile}`);
};

const getDllFileBySieDirectory = async (item: string, options: DllResolveOptions = {}) => {
    const sieDirectoryInfo = getChangedSieDirectoryInfo(item);
    if (!sieDirectoryInfo) return "";

    const directoryPath = getChangedCsprojPath(sieDirectoryInfo.directoryPath, options);
    if (directoryPath) {
        const csprojInfo = await getCsprojInfoFromDirectory(directoryPath, sieDirectoryInfo.directoryName);
        if (csprojInfo) return await getDllFileByCsprojInfo(csprojInfo, options);
    }

    return `${sieDirectoryInfo.directoryName}.dll`;
};

export async function getDllFileByChangedItem(item: string, options: DllResolveOptions = {}) {
    const csprojInfo = getChangedCsprojInfo(item);
    if (csprojInfo) return await getDllFileByCsprojInfo(csprojInfo, options);

    return await getDllFileBySieDirectory(item, options);
}

export const getTfsChangedPath = (line: string, sourcePath?: string | null) => {
    const changedPath = line.match(/\$\/[^\r\n]+/)?.[0]?.trim() || "";
    if (!changedPath) return "";
    if (!sourcePath) return changedPath;

    const normalizedChangedPath = removeSlash(changedPath, "/");
    const normalizedSourcePath = removeSlash(sourcePath, "/");
    return normalizedChangedPath.toLowerCase().startsWith(normalizedSourcePath.toLowerCase())
        ? normalizedChangedPath
        : "";
};

export async function getDllFilesByChangedItems(items: string[], options: DllResolveOptions = {}) {
    let dllFiles = new Array<string>();
    for (let i = 0; i < items.length; i++) {
        const dllFile = await getDllFileByChangedItem(items[i], options);
        if (dllFile) dllFiles.push(dllFile);
    }
    return [...new Set(dllFiles)];
}

/**
 * 输出[按用户]日志信息
 * @param content 日志信息
 * @param displayPublishField 显示日志信息
 * @param outPath 输出路径(默认为桌面目录)
 * @param isDelOldFile 删除旧文件
 */
export async function outPublishContentByUsers(content: string, displayPublishField: DisplayPublishFieldType, outPath: string = "", isDelOldFile = true, options: DllResolveOptions = {}): Promise<DataResultType> {
    if (!outPath) {
        outPath = await path.desktopDir();
    }
    if(isDelOldFile) {
        await cmdInvoke("delete_files_with_prefix", {
            dirPath: outPath,
            prefix: 'SMOM发布日志'
        });
    }
    let filePath = `${removeSlash(outPath)}/SMOM发布日志_${formatDate(new Date(), "YYYYmmddHHMMSS")}.log`;
    // 根据内容判断是Git还是TFS
    const isGit = content.includes('|') && !content.includes('变更集:');
    const publishInfos = isGit ? await parseGitContent(content) : await parseTfsContent(content);

    // 按用户分组
    type GroupedData = Record<string, PublishInfoType[]>;
    const groupedByUser: GroupedData = publishInfos.reduce((acc, item) => {
        if (!acc[item.user]) {
            acc[item.user] = [];
        }
        acc[item.user].push(item);
        return acc;
    }, {} as GroupedData);

    let publishContents = new Array<string>();
    for (const user in groupedByUser) {
        const publishItems = groupedByUser[user];
        let userConntens = [`# ${user}\n`];

        let dllArr = new Array<string>();
        let contentArr = [];
        for (let i = 0; i < publishItems.length; i++) {
            const publishInfo = publishItems[i];
            let changeSetText = '';
            if(displayPublishField.isChangeSet) changeSetText = `[${isGit ? '提交' : '变更集'}:${publishInfo.id}]`;

            let dateTimeText = '';
            if(displayPublishField.isDateTime) dateTimeText = `[日期:${publishInfo.dateTime}]`;
            
            if(displayPublishField.isDll) {
                const dllFiles = await getItemsDll(publishInfo.items, options);
                if (dllFiles.length > 0) dllArr.push(...new Set(dllFiles));
            }
            contentArr.push(`${(i+1)}.${changeSetText}${dateTimeText}${publishInfo.commentText}`);
        }
        if(dllArr.length > 0) {
            dllArr = [...new Set(dllArr)]; // 去重
            userConntens.push(`DLL文件: ${dllArr.join('、')}\n`);
        }
        if(contentArr.length > 0) {
            userConntens.push(`更新内容如下:\n${contentArr.join('\n')}\n`);
        }
        publishContents.push('\n');
        publishContents = publishContents.concat(userConntens);
    }
    let outContent = publishContents.join('') ?? "";
    const saveResult = await cmdInvoke("save_content_to_file", {
        content: outContent,
        filePath
    });
    if (saveResult.code === 0) {
        saveResult.msg = `日志信息已保存到: ${filePath}`;
        saveResult.data = outContent;
    }
    return saveResult;
}

/**
 * 输出[按日期]日志信息
 * @param content 日志信息
 * @param displayPublishField 显示日志信息
 * @param outPath 输出路径(默认为桌面目录)
 * @param isDelOldFile 删除旧文件
 */
export async function outPublishContentByDates(content: string, displayPublishField: DisplayPublishFieldType, outPath: string = "", isDelOldFile = true, options: DllResolveOptions = {}): Promise<DataResultType> {
    if (!outPath) {
        outPath = await path.desktopDir();
    }
    if(isDelOldFile) {
        await cmdInvoke("delete_files_with_prefix", {
            dirPath: outPath,
            prefix: 'SMOM发布日志'
        });
    }
    let filePath = `${removeSlash(outPath)}/SMOM发布日志_${formatDate(new Date(), "YYYYmmddHHMMSS")}.log`;
    // 根据内容判断是Git还是TFS
    const isGit = content.includes('|') && !content.includes('变更集:');
    const publishInfos = isGit ? await parseGitContent(content) : await parseTfsContent(content);

    // 按日期分组
    type GroupedData = Record<string, PublishInfoType[]>;
    const groupedByDate: GroupedData = publishInfos.reduce((acc, item) => {
        if (!acc[item.date]) {
            acc[item.date] = [];
        }
        acc[item.date].push(item);
        return acc;
    }, {} as GroupedData);

    let publishContents = new Array<string>();
    for (const date in groupedByDate) {
        const publishItems = groupedByDate[date];
        let dateConntens = [`# ${date}\n`];

        let dllArr = new Array<string>();
        let contentArr = [];
        for (let i = 0; i < publishItems.length; i++) {
            const publishInfo = publishItems[i];
            let changeSetText = '';
            if(displayPublishField.isChangeSet) changeSetText = `[${isGit ? '提交' : '变更集'}:${publishInfo.id}]`;

            let userText = '';
            if(displayPublishField.isUser) userText = `[用户:${publishInfo.user}]`;

            let dateTimeText = '';
            if(displayPublishField.isDateTime) dateTimeText = `[日期:${publishInfo.dateTime}]`;
            
            if(displayPublishField.isDll) {
                const dllFiles = await getItemsDll(publishInfo.items, options);
                if (dllFiles.length > 0) dllArr.push(...new Set(dllFiles));
            }
            contentArr.push(`${(i+1)}.${changeSetText}${userText}${dateTimeText}${publishInfo.commentText}`);
        }
        if(dllArr.length > 0) {
            dllArr = [...new Set(dllArr)]; // 去重
            dateConntens.push(`DLL文件: ${dllArr.join('、')}\n`);
        }
        if(contentArr.length > 0) {
            dateConntens.push(`更新内容如下:\n${contentArr.join('\n')}\n`);
        }
        publishContents.push('\n');
        publishContents = publishContents.concat(dateConntens);
    }
    let outContent = publishContents.join('') ?? "";
    const saveResult = await cmdInvoke("save_content_to_file", {
        content: outContent,
        filePath
    });
    if (saveResult.code === 0) {
        saveResult.msg = `日志信息已保存到: ${filePath}`;
        saveResult.data = outContent;
    }
    return saveResult;
}

/**
 * 输出[仅内容]日志信息
 * @param content 日志信息
 * @param outPath 输出路径(默认为桌面目录)
 * @param isDelOldFile 删除旧文件
 */
export async function outPublishContents(content: string, outPath: string = "", isDelOldFile = true): Promise<DataResultType> {
    if (!outPath) {
        outPath = await path.desktopDir();
    }
    if(isDelOldFile) {
        await cmdInvoke("delete_files_with_prefix", {
            dirPath: outPath,
            prefix: 'SMOM发布日志'
        });
    }
    let filePath = `${removeSlash(outPath)}/SMOM发布日志_${formatDate(new Date(), "YYYYmmddHHMMSS")}.log`;
    console.log('222222')
    console.log('content',content);
    
    // 根据内容判断是Git还是TFS
    const isGit = content.includes('|') && !content.includes('变更集:');
    const publishInfos = isGit ? await parseGitContent(content) : await parseTfsContent(content);
    let publishContents = ["更新内容如下：\n"];
    for (let i = 0; i < publishInfos.length; i++) {
        const publishInfo = publishInfos[i];
        publishContents.push(`${(i+1)}.${publishInfo.commentText}\n`);
    }
    let outContent = publishContents.join('') ?? "";
    const saveResult = await cmdInvoke("save_content_to_file", {
        content: outContent,
        filePath
    });
    if (saveResult.code === 0) {
        saveResult.msg = `日志信息已保存到: ${filePath}`;
        saveResult.data = outContent;
    }
    return saveResult;
}

/**
 * 输出[默认]日志信息
 * @param content 日志信息
 * @param displayPublishField 显示日志信息
 * @param outPath 输出路径(默认为桌面目录)
 * @param isDelOldFile 删除旧文件
 */
export async function outDetaultPublishContents(content: string, displayPublishField: DisplayPublishFieldType, outPath: string = "", isDelOldFile = true, options: DllResolveOptions = {}): Promise<DataResultType> {
    if (!outPath) {
        outPath = await path.desktopDir();
    }
    if(isDelOldFile) {
        await cmdInvoke("delete_files_with_prefix", {
            dirPath: outPath,
            prefix: 'SMOM发布日志'
        });
    }
    let filePath = `${removeSlash(outPath)}/SMOM发布日志_${formatDate(new Date(), "YYYYmmddHHMMSS")}.log`;
    // 根据内容判断是Git还是TFS
    const isGit = content.includes('|') && !content.includes('变更集:');
    console.log('isGit',isGit);
    const publishInfos = isGit ? await parseGitContent(content) : await parseTfsContent(content);
    console.log('publishInfos',publishInfos);
    let publishContents = new Array<string>();
    for (let i = 0; i < publishInfos.length; i++) {
        const publishInfo = publishInfos[i];
        if(displayPublishField.isChangeSet) {
            publishContents.push(`${isGit ? '提交' : '变更集'}: ${publishInfo.id}\n`);
        }
        if(displayPublishField.isUser) {
            publishContents.push(`用户: ${publishInfo.user}\n`);
        }
        if(displayPublishField.isDateTime) {
            publishContents.push(`日期: ${publishInfo.dateTime}\n`);
        }
        if(displayPublishField.isDll) {
            const dllFiles = await getItemsDll(publishInfo.items, options);
            if (dllFiles.length > 0) {
                publishContents.push(`DLL文件: ${dllFiles.join('、')}\n`);
            }
        }
        publishContents.push(`更新内容：${publishInfo.commentText}\n`);
        publishContents.push("\n");
    }
    let outContent = publishContents.join('') ?? "";
    const saveResult = await cmdInvoke("save_content_to_file", {
        content: outContent,
        filePath
    });
    if (saveResult.code === 0) {
        saveResult.msg = `日志信息已保存到: ${filePath}`;
        saveResult.data = outContent;
    }
    return saveResult;
}

/**
 * 获取DLL发布文件
 * @param items 日志信息中的项
 */
export async function getItemsDll(items: string[], options: DllResolveOptions = {}): Promise<string[]> {
    return await getDllFilesByChangedItems(items, options);
}

/**
 * 解析TFS内容
 * @param content 日志信息
 * @returns
 */
export async function parseTfsContent(content: string): Promise<PublishInfoType[]> {
const blocks = content.trim().split("-------------------------------------------------------------------------------");
  const result: PublishInfoType[] = [];

  for (const block of blocks) {
    if (!block.trim()) continue;

    const lines = block.trim().split(/\r?\n|\r/g);

    let cs: Partial<PublishInfoType> = {};
    let currentSection: 'comments' | 'items' | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith("变更集:")) {
        cs.id = parseInt(trimmed.replace("变更集:", "").trim(), 10);
      } else if (trimmed.startsWith("用户:")) {
        cs.user = trimmed.replace("用户:", "").trim();
      } else if (trimmed.startsWith("日期:")) {
        cs.date = trimmed.replace("日期:", "").trim();
      } else if (trimmed === "注释:") {
        currentSection = 'comments';
        cs.comments = [];
      } else if (trimmed === "项:") {
        currentSection = 'items';
        cs.items = [];
      } else if (currentSection === 'comments') {
        // 合并所有注释行成一个字符串，并去除换行和首尾空格
        cs.comments?.push(trimmed.trim())
      } else if (currentSection === 'items' && 
            ( 
                trimmed.startsWith("编辑 ") ||
                trimmed.startsWith("添加 ") ||
                trimmed.startsWith("删除 ") ||
                trimmed.startsWith("合并,编辑 ") ||
                trimmed.startsWith("合并,添加 ") ||
                trimmed.startsWith("合并,删除 ")
            )
      ) {
        const path = trimmed
            .replace("编辑 ", "")
            .replace("添加 ", "")
            .replace("删除 ", "")
            .replace("合并,编辑 ", "")
            .replace("合并,添加 ", "")
            .replace("合并,删除 ", "")
            .trim();
        cs.items?.push(path);
      }
    }

    if (cs.id && cs.user && cs.date && cs.comments && cs.items) {
      // 处理 comment 文本
      cs.comments = cs.comments.filter(str => str.trim());
      let conmentText = cs.comments.join('\n').trim();
      cs.commentText = conmentText
        .trim() // 去除首尾空白和换行
        .replace(/[\r\n]+/g, '') // 去除中间所有换行符
        .replace(/\d+\.|\d+、/g, ';') // 替换 "数字." 或 "数字、" 为 ";"
        .replace(/^;/, '');

      result.push({
        id: cs.id,
        user: cs.user,
        date: cs.date.split(' ')[0], // 只保留日期部分
        dateTime: cs.date, // 保留完整的日期时间
        comments: cs.comments,
        commentText: cs.commentText,
        items: cs.items!
      });
    }
  }

  return result;
};

/**
 * 解析Git内容
 * @param content 日志信息
 * @returns
 */
export async function parseGitContent(content: string): Promise<PublishInfoType[]> {
  const lines = content.trim().split(/\r?\n/);
  const result: PublishInfoType[] = [];
  
  let currentCommit: PublishInfoType | null = null;
  
  for (const line of lines) {
    if (!line.trim()) continue;
    // console.log('line:', line);
    
    // 检查是否是提交信息行（包含 | 分隔符，且格式为 commitHash|authorName|authorEmail|date|subject）
    const commitParts = line.split('|');
    if (commitParts.length >= 5 && /^[a-fA-F0-9]{8,40}/.test(commitParts[0])) {
      // 如果当前已经有提交信息，将其添加到结果中
      if (currentCommit) {
        result.push(currentCommit);
      }
      
      // 解析新的提交信息
      const id = parseInt(commitParts[0].substring(0, 8), 16); // 取前8位作为简短ID并转换为数字
      const user = commitParts[1];
    //   const email = commitParts[2];
      const dateTime = formatGitDate(commitParts[3]); // 转换为标准时间格式
      const date = formatDate(new Date(commitParts[3]), "YYYY-mm-dd");
      const commentText = commitParts.slice(4).join('|'); // 合并剩余部分作为提交信息
      
      // 创建新的提交对象，包含空的items数组
      currentCommit = {
        id: id,
        user: user,
        date: date,
        dateTime: dateTime,
        comments: [commentText],
        commentText: commentText,
        items: []
      };
    } else if (currentCommit && line.trim() !== '') {
      // 如果当前行不是提交信息行，而是文件变更信息（使用--name-status格式）
      // 格式为: 状态 文件路径 (例如: M    src/file.ts 或 A    new/file.ts)
      const statusMatch = line.match(/^([A-Z])\s+(.*)$/);
      if (statusMatch) {
        const filePath = statusMatch[2].trim();
        if (filePath) {
          currentCommit.items.push(filePath);
        }
      }
    }
  }
  
  // 添加最后一个提交（如果存在）
  if (currentCommit) {
    result.push(currentCommit);
  }
  
  return result;
};
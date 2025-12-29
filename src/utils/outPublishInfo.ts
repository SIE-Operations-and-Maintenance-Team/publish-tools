import { path } from "@tauri-apps/api";
import { cmdInvoke } from "@/utils/command";
import { formatDate } from "@/utils/formatTime";
import {
  removeSlash
} from "@/utils/other";

/**
 * 输出[按用户]日志信息
 * @param content 日志信息
 * @param displayPublishField 显示日志信息
 * @param outPath 输出路径(默认为桌面目录)
 * @param isDelOldFile 删除旧文件
 */
export async function outPublishContentByUsers(content: string, displayPublishField: DisplayPublishFieldType, outPath: string = "", isDelOldFile = true): Promise<DataResultType> {
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
    const publishInfos = await parseTfsContent(content);

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
            if(displayPublishField.isChangeSet) changeSetText = `[变更集:${publishInfo.id}]`;

            let dateTimeText = '';
            if(displayPublishField.isDateTime) dateTimeText = `[日期:${publishInfo.dateTime}]`;
            
            if(displayPublishField.isDll) {
                const dllFiles = await getItemsDll(publishInfo.items);
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
export async function outPublishContentByDates(content: string, displayPublishField: DisplayPublishFieldType, outPath: string = "", isDelOldFile = true): Promise<DataResultType> {
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
    const publishInfos = await parseTfsContent(content);

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
            if(displayPublishField.isChangeSet) changeSetText = `[变更集:${publishInfo.id}]`;

            let userText = '';
            if(displayPublishField.isUser) userText = `[用户:${publishInfo.user}]`;

            let dateTimeText = '';
            if(displayPublishField.isDateTime) dateTimeText = `[日期:${publishInfo.dateTime}]`;
            
            if(displayPublishField.isDll) {
                const dllFiles = await getItemsDll(publishInfo.items);
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
    const publishInfos = await parseTfsContent(content);
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
export async function outDetaultPublishContents(content: string, displayPublishField: DisplayPublishFieldType, outPath: string = "", isDelOldFile = true): Promise<DataResultType> {
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
    const publishInfos = await parseTfsContent(content);
    let publishContents = new Array<string>();
    for (let i = 0; i < publishInfos.length; i++) {
        const publishInfo = publishInfos[i];
        if(displayPublishField.isChangeSet) {
            publishContents.push(`变更集: ${publishInfo.id}\n`);
        }
        if(displayPublishField.isUser) {
            publishContents.push(`用户: ${publishInfo.user}\n`);
        }
        if(displayPublishField.isDateTime) {
            publishContents.push(`日期: ${publishInfo.dateTime}\n`);
        }
        if(displayPublishField.isDll) {
            const dllFiles = await getItemsDll(publishInfo.items);
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
export async function getItemsDll(items: string[]): Promise<string[]> {
    let dllFiles = new Array<string>();
    const regex = new RegExp(`(SIE\.[^/]+)|([^/]+)\\.csproj$`);
    for (let i = 0; i < items.length; i++) {
        const tfsItem = items[i];
        const matches = regex.exec(tfsItem);
        if (!matches) continue;
        if (matches.length > 0) {
            let dllName = matches[0];
            if (dllName.endsWith(".csproj")) dllName = dllName.slice(0, -".csproj".length);
            dllFiles.push(dllName + ".dll");
        }
    }
    return [...new Set(dllFiles)];
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
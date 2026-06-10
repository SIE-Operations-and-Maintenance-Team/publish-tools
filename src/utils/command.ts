import { invoke } from "@tauri-apps/api/core";
import type { InvokeArgs } from "@tauri-apps/api/core";

/**
 * 调用Rust后台命令
 * @param cmd 命令(函数)名称
 * @param args 参数
 */
export function cmdInvoke<T = any>(cmd: string, args?: InvokeArgs): Promise<DataResultType<T>> {
    return new Promise(resolve => {
      invoke(cmd, args)
        .then((result: any) => {
          resolve({
            code: 0,
            msg: `调用[${cmd}]成功！`,
            data: result
          });
        })
        .catch((err: any) => {
          const errMsg = `调用[${cmd}]失败！`;
          resolve({
            code: -1,
            msg: errMsg,
            data: err
          });
          console.error(errMsg, err);
        });
        // reject(err);
    });
}

/**
 * 将 Windows 远程命令兼容处理
 * @param command 原始命令（可能含 cmd 内置语法：if / mkdir / cd /d / && 等）
 */
export const wrapWinCmd = (command: string): string => {
  return command;
};
use encoding_rs::GBK;
use std::io::ErrorKind;
use std::process::Command;
use std::thread;
use std::time::Duration;

// 添加Windows平台特定的trait导入
#[cfg(windows)]
use std::os::windows::process::CommandExt;

const MAX_RETRIES: u32 = 3;
const RETRY_DELAY: Duration = Duration::from_millis(500);

/// 执行Git命令并返回输出
///
/// # Arguments
/// * `command` - Git命令路径（如 "git" 或完整路径）
/// * `args` - 命令参数
/// * `cwd` - 工作目录
///
/// # Returns
/// * `Ok(CommandResult)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn execute_git_command(
    command: &str,
    args: Vec<String>,
    cwd: &str,
) -> Result<CommandResult, String> {
    execute_git_command_internal(command, args, cwd).await
}

pub async fn execute_git_command_internal(
    command: &str,
    args: Vec<String>,
    cwd: &str,
) -> Result<CommandResult, String> {
    let mut attempts = 0;
    let mut err_msg = String::new();

    while attempts < MAX_RETRIES {
        match exec_git_command(command, args.clone(), cwd) {
            // 移除 .await
            Ok(result) => return Ok(result),
            Err(e) => {
                eprintln!("Git命令尝试 {} 失败: {}，正在重试...", attempts + 1, e);
                attempts += 1;
                if attempts < MAX_RETRIES {
                    thread::sleep(RETRY_DELAY);
                }
                err_msg = e;
            }
        }
    }

    Err(format!(
        "Git命令尝试 {} 次后仍然失败: {}",
        attempts, err_msg
    ))
}

fn exec_git_command(command: &str, args: Vec<String>, cwd: &str) -> Result<CommandResult, String> {
    let mut cmd = Command::new(command);
    cmd.args(&args).current_dir(cwd);

    // 只在Windows平台上设置创建标志
    #[cfg(windows)]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    match cmd.output() {
        Ok(output) => {
            let (stdout, _, _) = GBK.decode(&output.stdout);
            let stdout_str = stdout.to_string();

            if output.status.success() {
                Ok(CommandResult {
                    code: 0,
                    data: stdout_str,
                })
            } else {
                let (stderr, _, _) = GBK.decode(&output.stderr);
                let stderr_str = stderr.to_string();

                // 如果stderr为空，使用stdout
                let error_msg = if stderr_str.is_empty() {
                    stdout_str
                } else {
                    stderr_str
                };

                Ok(CommandResult {
                    code: output.status.code().unwrap_or(1),
                    data: error_msg,
                })
            }
        }
        Err(e) => {
            let error_msg = if e.kind() == ErrorKind::NotFound {
                format!("找不到命令: {}", command)
            } else {
                format!("无法执行命令: {}", e)
            };
            Err(error_msg)
        }
    }
}

/// 获取Git分支列表
///
/// # Arguments
/// * `command` - Git命令路径
/// * `cwd` - 工作目录
///
/// # Returns
/// * `Ok(Vec<String>)` 分支列表
/// * `Err(String)` 失败
#[tauri::command]
pub async fn get_git_branches(command: &str, cwd: &str) -> Result<Vec<String>, String> {
    let args = vec!["branch".to_string(), "-a".to_string()];

    let result = execute_git_command_internal(command, args, cwd).await?;

    if result.code != 0 {
        return Err(result.data);
    }

    let branches = result
        .data
        .lines()
        .map(|line| line.trim_start_matches("*").trim().to_string())
        .filter(|line| !line.is_empty())
        .collect();

    Ok(branches)
}

/// 获取Git状态
///
/// # Arguments
/// * `command` - Git命令路径
/// * `cwd` - 工作目录
///
/// # Returns
/// * `Ok(String)` Git状态
/// * `Err(String)` 失败
#[tauri::command]
pub async fn get_git_status(command: &str, cwd: &str) -> Result<String, String> {
    let args = vec!["status".to_string()];

    let result = execute_git_command_internal(command, args, cwd).await?;

    if result.code != 0 {
        return Err(result.data);
    }

    Ok(result.data)
}

/// 获取Git提交历史
///
/// # Arguments
/// * `command` - Git命令路径
/// * `args` - git log 命令参数
/// * `cwd` - 工作目录
///
/// # Returns
/// * `Ok(String)` 提交历史
/// * `Err(String)` 失败
#[tauri::command]
pub async fn get_git_log(command: &str, args: Vec<String>, cwd: &str) -> Result<String, String> {
    let result = execute_git_command_internal(command, args, cwd).await?;

    if result.code != 0 {
        return Err(result.data);
    }

    Ok(result.data)
}

/// 获取单个提交的详细信息
///
/// # Arguments
/// * `command` - Git命令路径
/// * `commit_hash` - 提交哈希
/// * `cwd` - 工作目录
///
/// # Returns
/// * `Ok(String)` 提交详情
/// * `Err(String)` 失败
#[tauri::command]
pub async fn get_git_show(command: &str, commit_hash: &str, cwd: &str) -> Result<String, String> {
    let args = vec!["show".to_string(), commit_hash.to_string()];

    let result = execute_git_command_internal(command, args, cwd).await?;

    if result.code != 0 {
        return Err(result.data);
    }

    Ok(result.data)
}

/// Git提交
///
/// # Arguments
/// * `command` - Git命令路径
/// * [message](file://d:\develop\Rex.SmomPublish-master\src\database\git\index.ts#L7-L7) - 提交消息
/// * `cwd` - 工作目录
/// * `all` - 是否添加所有变更文件
///
/// # Returns
/// * `Ok(String)` 提交结果
/// * `Err(String)` 失败
#[tauri::command]
pub async fn git_commit(
    command: &str,
    message: &str,
    cwd: &str,
    all: Option<bool>,
) -> Result<String, String> {
    let mut args = vec!["commit".to_string(), "-m".to_string(), message.to_string()];

    if all.unwrap_or(false) {
        args.insert(1, "--all".to_string());
    }

    let result = execute_git_command_internal(command, args, cwd).await?;

    if result.code != 0 {
        return Err(result.data);
    }

    Ok(result.data)
}

/// Git添加文件到暂存区
///
/// # Arguments
/// * `command` - Git命令路径
/// * [files](file://d:\develop\Rex.SmomPublish-master\src-tauri\target\debug\build\tauri-2708a058796a6c45\out\tauri-core-permission-files) - 文件列表，空表示添加所有文件
/// * `cwd` - 工作目录
///
/// # Returns
/// * `Ok(String)` 添加结果
/// * `Err(String)` 失败
#[tauri::command]
pub async fn git_add(command: &str, files: Vec<String>, cwd: &str) -> Result<String, String> {
    let mut args = vec!["add".to_string()];

    if files.is_empty() {
        args.push(".".to_string()); // 添加所有文件
    } else {
        args.extend(files);
    }

    let result = execute_git_command_internal(command, args, cwd).await?;

    if result.code != 0 {
        return Err(result.data);
    }

    Ok(result.data)
}

/// Git命令执行结果
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CommandResult {
    pub code: i32,
    pub data: String,
}

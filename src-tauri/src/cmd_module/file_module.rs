use crate::cmd_module::ssh_pool;
use crate::utils::compression::{create_zip, unzip_files};
use crate::utils::msbuild::build_project;
use chrono::{DateTime, Local, NaiveDateTime};
use encoding_rs::GBK;
use encoding_rs::UTF_8;
use std::env;
use std::ffi::OsStr;
use std::fs;
use std::fs::File;
use std::io::ErrorKind;
use std::io::{self, Read, Write};
use std::os::windows::process::CommandExt;
use std::path::Path;
use std::process::{Command, Stdio};
use std::str;
use std::time::Instant;
use std::{thread, time::Duration};
use walkdir::WalkDir;
use zip::{write::FileOptions, ZipWriter};

const MAX_RETRIES: u32 = 3;
const RETRY_DELAY: Duration = Duration::from_secs(2);

/// 智能解码字节流：优先尝试 UTF-8，失败回退到 GBK
///
/// 适配混合服务器场景：
/// - Linux 服务器：默认输出为 UTF-8
/// - Windows 服务器/本地 cmd：默认输出为 GBK（简体中文 ANSI 代码页）
///
/// 由于 UTF-8 格式严格（非法字节序列一定校验失败），可作为安全的首选尝试；
/// 失败后再回退到 GBK，避免 Linux 输出被当作 GBK 解码产生乱码。
fn smart_decode_bytes(bytes: &[u8]) -> String {
    match std::str::from_utf8(bytes) {
        Ok(s) => s.to_string(),
        Err(_) => {
            let (cow, _, _) = GBK.decode(bytes);
            cow.to_string()
        }
    }
}

/// 连接远程服务器
///
/// # Arguments
/// * `username` - 用户名称
/// * `password` - 用户密码
/// * `server` - 服务器地址
///
/// # Returns
/// * `Ok(true)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn server_connection(
    username: &str,
    password: &str,
    server: &str,
) -> Result<bool, String> {
    // 测试连接需要严格校验"当前传入的密码"，先丢弃池中可能存在的旧会话，
    // 否则若用户改了密码但池中仍缓存着旧会话，会误报连通成功。
    ssh_pool::invalidate(username, server);

    match ssh_pool::get_session(username, password, server) {
        Ok(_) => Ok(true),
        Err(e) => Err(e),
    }
}

/// 在远程服务器上执行命令
///
/// # Arguments
/// * `username` - 用户名称
/// * `password` - 用户密码
/// * `server` - 服务器地址
/// * `command` - 执行的命令
///
/// # Returns
/// * `Ok(true)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn execute_remote_command(
    username: &str,
    password: &str,
    server: &str,
    command: &str,
    retry_count: Option<u32>,
    retry_interval_secs: Option<u64>,
) -> Result<String, String> {
    let max_attempts = retry_count.unwrap_or(MAX_RETRIES).max(1);
    let delay = retry_interval_secs
        .filter(|s| *s > 0)
        .map(Duration::from_secs)
        .unwrap_or(RETRY_DELAY);
    let mut attempts = 0;

    while attempts < max_attempts {
        match remote_command(username, password, server, command).await {
            Ok(output) => return Ok(output),
            Err(e) => {
                eprintln!("尝试 {} 失败: {}，正在重试...", attempts + 1, e);
                attempts += 1;
                if attempts < max_attempts {
                    thread::sleep(delay);
                }
            }
        }
    }
    Err(format!(
        "尝试 {} 次后，仍无法执行命令：{}",
        attempts, command
    ))
}

/// 服务器上执行命令
///
/// # Arguments
/// * `username` - 用户名称
/// * `password` - 用户密码
/// * `server` - 服务器地址
/// * `command` - 执行的命令
///
/// # Returns
/// * `Ok(true)` 成功
/// * `Err(String)` 失败
async fn remote_command(
    username: &str,
    password: &str,
    server: &str,
    command: &str,
) -> Result<String, String> {
    // 从连接池取（或新建）已认证的 SSH 会话
    let shared = ssh_pool::get_session(username, password, server)?;

    // 在锁内完成 channel 全生命周期，避免 libssh2 同会话并发使用
    let channel_outcome: Result<(i32, String, String), String> = (|| {
        let mut entry = shared
            .lock()
            .map_err(|_| "SSH 会话锁中毒".to_string())?;

        let (exit_status, stdout, stderr) = {
            let mut channel = entry
                .session
                .channel_session()
                .map_err(|_| "无法打开远程命令通道".to_string())?;
            println!("执行远程命令: {}", command);
            channel
                .exec(command)
                .map_err(|_| "无法执行命令".to_string())?;

            let mut stdout_bytes = Vec::new();
            let mut stderr_bytes = Vec::new();
            channel
                .read_to_end(&mut stdout_bytes)
                .map_err(|_| "无法读取命令输出".to_string())?;
            channel
                .stderr()
                .read_to_end(&mut stderr_bytes)
                .map_err(|_| "无法读取命令错误输出".to_string())?;
            channel
                .wait_close()
                .map_err(|_| "无法关闭命令通道".to_string())?;
            let status = channel
                .exit_status()
                .map_err(|_| "无法获取命令退出状态".to_string())?;

            (
                status,
                smart_decode_bytes(&stdout_bytes),
                smart_decode_bytes(&stderr_bytes),
            )
        };

        entry.last_used = Instant::now();
        Ok((exit_status, stdout, stderr))
    })();

    match channel_outcome {
        Ok((exit_status, stdout, stderr)) => {
            if exit_status == 0 {
                Ok(stdout)
            } else {
                // 命令业务级失败：会话本身仍可继续复用，无需丢弃
                Err(format!(
                    "命令执行异常。退出状态：{}。输出：{}；错误输出：{}",
                    exit_status, stdout, stderr
                ))
            }
        }
        Err(e) => {
            // 通道级错误（连接断开等），使会话失效以便下次重建
            ssh_pool::invalidate(username, server);
            Err(e)
        }
    }
}

/// 使某个 SSH 连接池中的会话失效（切换项目后调用）
#[tauri::command]
pub async fn invalidate_ssh_session(username: &str, server: &str) -> Result<bool, String> {
    ssh_pool::invalidate(username, server);
    Ok(true)
}

/// 判断文件或目录是否存在
///
/// # Arguments
/// * `path` - 文件目录路径
///
/// # Returns
/// * `Ok(true)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn exists(path: &str) -> Result<bool, String> {
    let path = Path::new(path);
    if path.exists() {
        Ok(true)
    } else {
        Err(format!("路径[{}]不存在！", path.display()))
    }
}

/// 判断文件或目录是否存在
///
/// # Arguments
/// * `path` - 文件目录路径
/// * `is_rebuild` - 是否重新编译
///
/// # Returns
/// * `Ok(true)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn build_project_release(
    project_file_path: &str,
    msbuild_path: &str,
    is_rebuild: bool,
    build_mode: &str,
) -> Result<bool, String> {
    match build_project(project_file_path, msbuild_path, is_rebuild, build_mode) {
        Ok(_) => Ok(true),
        Err(e) => Err(e),
    }
}

/// 判断文件夹是否为空目录
///
/// # Arguments
/// * `path` - 文件目录路径
///
/// # Returns
/// * `Ok(true)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn is_dir_empty(path: &str) -> Result<bool, String> {
    match fs::read_dir(path) {
        Ok(entries) => Ok(entries.peekable().peek().is_none()),
        Err(e) => Err(e.to_string()),
    }
}

/// 创建文件目录
///
/// # Arguments
/// * `path` - 文件目录路径
///
/// # Returns
/// * `Ok(true)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn create_dir(path: &str) -> Result<bool, String> {
    let path = Path::new(path);
    match fs::create_dir_all(path) {
        Ok(_) => Ok(true),
        Err(e) => Err(e.to_string()),
    }
}

/// 目录压缩[ZIP]文件
///
/// # Arguments
/// * `src_dir` - 文件夹路径
/// * `dst_file` - 输出的zip文件路径
///
/// # Returns
/// * `Ok(true)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn zip_dir(src_dir: &str, dst_file: &str) -> Result<bool, String> {
    let path = Path::new(src_dir);
    let file = File::create(dst_file).map_err(|e| e.to_string())?;
    let mut zip = ZipWriter::new(file);

    let options = FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);

    for entry in WalkDir::new(path) {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = path
            .strip_prefix(Path::new(src_dir))
            .map_err(|e| e.to_string())?;

        if path.is_file() {
            // zip.start_file_from_path(name, options)
            zip.start_file(path_to_string(name), options)
                .map_err(|e| e.to_string())?;
            let mut f = File::open(path).map_err(|e| e.to_string())?;
            io::copy(&mut f, &mut zip).map_err(|e| e.to_string())?;
        } else if path.is_dir() && !name.as_os_str().is_empty() {
            // zip.add_directory_from_path(name, options)
            zip.add_directory(path_to_string(name), options)
                .map_err(|e| e.to_string())?;
        }
    }

    zip.finish().map_err(|e| e.to_string())?;
    Ok(true)
}

fn path_to_string(path: &std::path::Path) -> String {
    let mut path_str = String::new();
    for component in path.components() {
        if let std::path::Component::Normal(os_str) = component {
            if !path_str.is_empty() {
                path_str.push('/');
            }
            path_str.push_str(&os_str.to_string_lossy());
        }
    }
    path_str
}

/// 压缩[ZIP]文件
///
/// # Arguments
/// * `file_paths` - 文件|文件夹路径
/// * `dst_file` - 输出的zip文件路径
///
/// # Returns
/// * `Ok(true)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn compress_zip(file_paths: Vec<String>, dst_file: &str) -> Result<bool, String> {
    // 直接将Vec<String>转换为Vec<&str>，减少中间步骤
    let file_paths: Vec<&str> = file_paths.iter().map(String::as_str).collect();
    // 调用create_zip函数并处理结果
    create_zip(&file_paths, dst_file)
        .map_err(|e| e.to_string())
        .map(|_| true)
}

/// 解压压缩文件
///
/// # Arguments
/// * `file_paths` - 文件路径
/// * `destination` - 输出解压路径
///
/// # Returns
/// * `Ok(true)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn un_zip(file_paths: Vec<String>, destination: &str) -> Result<bool, String> {
    let file_paths: Vec<&str> = file_paths.iter().map(String::as_str).collect();
    unzip_files(&file_paths, destination)
        .map_err(|e| e.to_string())
        .map(|_| true)
}

/// 读取文件目录中的文件
///
/// # Arguments
/// * `path` - 文件目录
///
/// # Returns
/// * `Ok(true)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn read_files(path: &str) -> Result<Vec<String>, String> {
    match fs::read_dir(path) {
        Ok(entries) => {
            let mut file_names = Vec::new();
            for entry in entries {
                match entry {
                    Ok(entry) => {
                        if let Ok(file_name) = entry.file_name().into_string() {
                            file_names.push(file_name);
                        }
                    }
                    Err(e) => return Err(format!("获取条目出错: {}", e)),
                }
            }
            Ok(file_names)
        }
        Err(e) => Err(format!("读取目录出错: {}", e)),
    }
}

/// 打开文件目录
///
/// # Arguments
/// * `path` - 文件目录路径
///
/// # Returns
/// * `Ok(true)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn open_dir(path: &str) -> Result<bool, String> {
    // 处理路径
    let path = Path::new(path);
    let path = match path.canonicalize() {
        Ok(p) => p,
        Err(_) => {
            return Err("路径无效！".to_string());
        }
    };
    let path_str = path.to_str().ok_or_else(|| "路径转换失败".to_string())?;

    // 获取当前操作系统信息
    let os_type = env::consts::OS;

    // 根据操作系统类型执行不同的命令
    let result = match os_type {
        "windows" => Command::new("explorer").arg(path_str).spawn(),
        "macos" => Command::new("open").arg(path_str).spawn(),
        "linux" => Command::new("xdg-open").arg(path_str).spawn(),
        _ => {
            return Err("不支持的操作系统".to_string());
        }
    };

    match result {
        Ok(_) => Ok(true),
        Err(e) => Err(format!("无法打开目录: {}", e)),
    }
}

/// 复制路径文件
///
/// # Arguments
/// * `source` - 文件|文件夹来源路径
/// * `destination` - 文件|文件夹目标路径
///
/// # Returns
/// * `Ok(true)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn copy_path(
    source: &str,
    destination: &str,
    retry_count: Option<u32>,
    retry_interval_secs: Option<u64>,
) -> Result<bool, String> {
    let source = Path::new(source);
    let destination = Path::new(destination);

    if !source.exists() {
        // 不存在源文件直接忽略吧
        return Ok(true);
    }

    if source.is_dir() {
        // 检查并创建目标文件夹
        if !destination.exists() {
            if let Err(e) = fs::create_dir_all(destination) {
                return Err(e.to_string());
            }
        }

        for entry in match fs::read_dir(source) {
            Ok(entries) => entries,
            Err(e) => return Err(e.to_string()),
        } {
            let entry = match entry {
                Ok(e) => e,
                Err(e) => return Err(e.to_string()),
            };
            let entry_path = entry.path();
            let entry_name = entry.file_name();

            // 递归复制子文件或子目录（透传重试参数）
            let source_path = entry_path.to_str().ok_or("源路径无效")?;
            let destination_path_tmp = destination.join(entry_name);
            let destination_path = destination_path_tmp.to_str().ok_or("目标路径无效")?;
            Box::pin(copy_path(source_path, destination_path, retry_count, retry_interval_secs)).await?;
        }
        return Ok(true);
    }

    // 复制文件（带重试）
    // retry_count = None 或 0 → 单次尝试（旧行为）；否则按 retry_count 次尝试，间隔 retry_interval_secs 秒
    let max_attempts = retry_count.unwrap_or(0).max(1);
    let delay = retry_interval_secs
        .filter(|s| *s > 0)
        .map(Duration::from_secs)
        .unwrap_or(RETRY_DELAY);
    let mut last_err = String::new();
    for attempt in 1..=max_attempts {
        match fs::copy(source, destination) {
            Ok(_) => return Ok(true),
            Err(e) => {
                last_err = e.to_string();
                eprintln!(
                    "复制失败 [{}/{}]: {} -> {}",
                    attempt,
                    max_attempts,
                    source.display(),
                    last_err
                );
                if attempt < max_attempts {
                    thread::sleep(delay);
                }
            }
        }
    }
    Err(format!("复制失败（尝试 {} 次）：{}", max_attempts, last_err))
}

/// 复制路径(时间段内)文件
///
/// # Arguments
/// * `source` - 文件|文件夹来源路径
/// * `destination` - 文件|文件夹目标路径
/// * `start_time` - 开始时间 格式: "%Y-%m-%d %H:%M:%S"
/// * `end_time` - 结束时间 格式: "%Y-%m-%d %H:%M:%S"
///
/// # Returns
/// * `Ok(true)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn copy_path_by_time(
    source: &str,
    destination: &str,
    start_time: &str,
    end_time: &str,
) -> Result<bool, String> {
    // 解析时间
    let start_date = match NaiveDateTime::parse_from_str(start_time, "%Y-%m-%d %H:%M:%S") {
        Ok(dt) => dt,
        Err(e) => return Err(format!("解析开始时间失败: {}", e)),
    };

    let end_date = match NaiveDateTime::parse_from_str(end_time, "%Y-%m-%d %H:%M:%S") {
        Ok(dt) => dt,
        Err(e) => return Err(format!("解析结束时间失败: {}", e)),
    };

    let source = Path::new(source);
    if !source.exists() {
        // 不存在源文件直接忽略吧
        return Ok(true);
    }

    let destination = Path::new(destination);
    if source.is_dir() {
        // 检查并创建目标文件夹
        if !destination.exists() {
            if let Err(e) = fs::create_dir_all(destination) {
                return Err(format!("创建目标文件夹失败: {}", e));
            }
        }
        for entry in match fs::read_dir(source) {
            Ok(entries) => entries,
            Err(e) => return Err(format!("读取源文件夹失败: {}", e)),
        } {
            let entry = match entry {
                Ok(e) => e,
                Err(e) => return Err(format!("读取文件夹条目失败: {}", e)),
            };
            let entry_path = entry.path();
            let entry_name = entry.file_name();

            // 递归复制子文件或子目录
            let source_path = entry_path.to_str().ok_or("无效的源路径字符串")?;
            let destination_path_tmp = destination.join(entry_name); // 创建一个临时变量
            let destination_path = destination_path_tmp
                .to_str()
                .ok_or("无效的目标路径字符串")?; // 借用这个临时变量
                                                 /*
                                                 let copy_result = copy_path_by_time(source_path, destination_path, start_time, end_time);
                                                 if let Err(e) = copy_result {
                                                     return Err(format!("递归复制失败: {}", e));
                                                 }
                                                 */
            Box::pin(copy_path_by_time(
                source_path,
                destination_path,
                start_time,
                end_time,
            ))
            .await?;
        }
        return Ok(true);
    }

    // 复制文件
    let metadata = match fs::metadata(source) {
        Ok(meta) => meta,
        Err(e) => return Err(format!("获取文件元数据失败: {}", e)),
    };
    let modified_time: NaiveDateTime = match metadata.modified() {
        Ok(time) => {
            let datetime: DateTime<Local> = time.into();
            datetime.naive_local()
        }
        Err(e) => return Err(format!("获取文件修改时间失败: {}", e)),
    };
    if modified_time >= start_date && modified_time <= end_date {
        if let Err(e) = fs::copy(source, destination) {
            return Err(format!("复制文件失败: {}", e));
        }
    }
    Ok(true)
}

/// 复制文件夹中的所有*.dll文件
///
/// # Arguments
/// * `source` - 来源路径
/// * `destination` - 目标路径
/// * `del_destination` - 删除目标路径
///
/// # Returns
/// * `Ok(true)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn copy_dll_files(
    source: &str,
    destination: &str,
    del_destination: bool,
) -> Result<bool, String> {
    let src_dir = Path::new(source);
    let dst_dir = Path::new(destination);

    // 删除目标文件夹
    if del_destination {
        if let Err(e) = delete_dir(destination).await {
            return Err(e.to_string());
        }
    }

    // 检查并创建目标文件夹
    if !dst_dir.exists() {
        if let Err(e) = fs::create_dir_all(dst_dir) {
            return Err(format!("无法创建目标目录: {}", e));
        }
    }

    for entry in match fs::read_dir(src_dir) {
        Ok(entries) => entries,
        Err(e) => return Err(format!("无法读取源目录: {}", e)),
    } {
        let entry = match entry {
            Ok(e) => e,
            Err(e) => return Err(format!("无法读取目录条目: {}", e)),
        };
        let path = entry.path();
        if path.is_file() && path.extension().is_some_and(|ext| ext == "dll") {
            let destination_file = dst_dir.join(path.file_name().ok_or("无效的文件名")?);
            if let Err(e) = fs::copy(&path, &destination_file) {
                return Err(format!("无法复制文件: {}", e));
            }
        }
    }

    Ok(true)
}

/// 复制文件夹中的所有(时间段内)*.dll文件
///
/// # Arguments
/// * `source` - 来源路径
/// * `destination` - 目标路径
/// * `del_destination` - 删除目标路径
/// * `start_time` - 开始时间 格式: "%Y-%m-%d %H:%M:%S"
/// * `end_time` - 结束时间 格式: "%Y-%m-%d %H:%M:%S"
///
/// # Returns
/// * `Ok(true)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn copy_dll_files_by_time(
    source: &str,
    destination: &str,
    del_destination: bool,
    start_time: &str,
    end_time: &str,
) -> Result<bool, String> {
    // 解析时间
    let start_date = match NaiveDateTime::parse_from_str(start_time, "%Y-%m-%d %H:%M:%S") {
        Ok(dt) => dt,
        Err(e) => return Err(format!("无法解析开始时间: {}", e)),
    };

    let end_date = match NaiveDateTime::parse_from_str(end_time, "%Y-%m-%d %H:%M:%S") {
        Ok(dt) => dt,
        Err(e) => return Err(format!("无法解析结束时间: {}", e)),
    };

    let src_dir = Path::new(source);
    let dst_dir = Path::new(destination);

    // 删除目标文件夹
    if del_destination {
        if let Err(e) = delete_dir(destination).await {
            return Err(e.to_string());
        }
    }

    // 检查并创建目标文件夹
    if !dst_dir.exists() {
        if let Err(e) = fs::create_dir_all(dst_dir) {
            return Err(format!("无法创建目标目录: {}", e));
        }
    }

    for entry in match fs::read_dir(src_dir) {
        Ok(entries) => entries,
        Err(e) => return Err(format!("无法读取源目录: {}", e)),
    } {
        let entry = match entry {
            Ok(e) => e,
            Err(e) => return Err(format!("无法读取目录条目: {}", e)),
        };
        let path = entry.path();
        if path.is_file() && path.extension().unwrap_or_default() == "dll" {
            let metadata = match fs::metadata(&path) {
                Ok(meta) => meta,
                Err(e) => return Err(format!("无法获取文件的元数据: {}", e)),
            };
            let modified_time: NaiveDateTime = match metadata.modified() {
                Ok(time) => {
                    let datetime: DateTime<Local> = time.into();
                    datetime.naive_local()
                }
                Err(e) => return Err(format!("无法获取文件的修改时间: {}", e)),
            };

            if modified_time >= start_date && modified_time <= end_date {
                let destination_file = match path.file_name() {
                    Some(filename) => dst_dir.join(filename),
                    None => return Err("无法获取文件名".to_string()),
                };
                if let Err(e) = fs::copy(&path, &destination_file) {
                    return Err(format!("无法复制文件: {}", e));
                }
            }
        }
    }

    Ok(true)
}

/// 移动文件
///
/// # Arguments
/// * `source` - 来源路径
/// * `destination` - 目标路径
///
/// # Returns
/// * `Ok(true)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn move_file(source: &str, destination: &str) -> Result<bool, String> {
    let src_path = Path::new(source);
    let dest_path = Path::new(destination);

    // 检查是否在同一个盘符
    if let (Some(src_drive), Some(dest_drive)) =
        (src_path.components().next(), dest_path.components().next())
    {
        if src_drive == dest_drive {
            // 尝试重命名
            return match fs::rename(source, destination) {
                Ok(_) => Ok(true),
                Err(e) => Err(format!("移动文件失败: {}", e)),
            };
        }
    }

    // 不在同一个盘符，使用复制+删除
    if let Err(e) = fs::copy(source, destination) {
        return Err(format!("复制文件失败: {}", e));
    }
    if let Err(e) = fs::remove_file(source) {
        return Err(format!("删除原文件失败: {}", e));
    }
    Ok(true)
}

/// 删除给定路径列表中的文件或文件夹
///
/// # Arguments
/// * `paths` - 要删除的文件或目录路径列表
///
/// # Returns
/// * `Ok(true)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn delete_paths(paths: Vec<String>) -> Result<bool, String> {
    for src in paths {
        let path = Path::new(&src);
        if path.is_file() {
            if let Err(e) = delete_file(&src).await {
                return Err(e.to_string());
            }
        } else if path.is_dir() {
            if let Err(e) = delete_dir(&src).await {
                return Err(e.to_string());
            }
        } else {
            return Err(format!("路径 {} 不是文件或目录", src));
        }
    }
    Ok(true)
}

/// 删除文件
///
/// # Arguments
/// * `path` - 要删除的文件路径
///
/// # Returns
/// * `Ok(true)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn delete_file(path: &str) -> Result<bool, String> {
    let path = Path::new(path);
    match fs::remove_file(path) {
        Ok(_) => Ok(true),
        Err(e) => Err(e.to_string()),
    }
}

/// 删除目录,包括所有子文件和子目录
///
/// # Arguments
/// * `path` - 要删除的目录路径
///
/// # Returns
/// * `Ok(true)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn delete_dir(path: &str) -> Result<bool, String> {
    let path = Path::new(path);
    match fs::remove_dir_all(path) {
        Ok(_) => Ok(true),
        Err(e) => Err(e.to_string()),
    }
}

/// 下载远程服务器文件到本地
///
/// # Arguments
/// * `username` - 用户名称
/// * `password` - 用户密码
/// * `server` - 远程服务器地址
/// * `remote_paths` - 远程文件路径
/// * `local_paths` - 本地文件路径
///
/// # Returns
/// * `Ok(true)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn download_server_files(
    local_paths: Vec<String>,
    remote_paths: Vec<String>,
    username: &str,
    password: &str,
    server: &str,
) -> Result<bool, String> {
    let mut attempts = 0;
    let mut err_msg = String::new();
    while attempts < MAX_RETRIES {
        match exec_download_server_files(
            local_paths.clone(),
            remote_paths.clone(),
            username,
            password,
            server,
        )
        .await
        {
            Ok(output) => return Ok(output),
            Err(e) => {
                eprintln!("尝试 {} 失败: {}，正在重试...", attempts + 1, e);
                attempts += 1;
                thread::sleep(RETRY_DELAY);
                err_msg = e.to_string();
            }
        }
    }
    Err(format!(
        "尝试 {} 次后，仍无法下载远程服务器文件到本地：{}",
        attempts, err_msg
    ))
}

/// 下载远程服务器文件到本地
///
/// # Arguments
/// * `username` - 用户名称
/// * `password` - 用户密码
/// * `server` - 远程服务器地址
/// * `remote_paths` - 远程文件路径
/// * `local_paths` - 本地文件路径
///
/// # Returns
/// * `Ok(true)` 成功
/// * `Err(String)` 失败
async fn exec_download_server_files(
    local_paths: Vec<String>,
    remote_paths: Vec<String>,
    username: &str,
    password: &str,
    server: &str,
) -> Result<bool, String> {
    if local_paths.len() != remote_paths.len() {
        return Err("本地路径和远程路径的数量必须相同.".into());
    }

    // 从连接池取（或新建）已认证的 SSH 会话
    let shared = ssh_pool::get_session(username, password, server)?;

    let outcome: Result<bool, String> = (|| {
        let mut entry = shared
            .lock()
            .map_err(|_| "SSH 会话锁中毒".to_string())?;

        let sftp = entry
            .session
            .sftp()
            .map_err(|e| format!("无法创建 SFTP 会话: {}", e))?;
        for (local_path, remote_path) in local_paths.iter().zip(remote_paths.iter()) {
            let local_path = Path::new(local_path);
            let remote_path = Path::new(remote_path);
            if remote_path_is_dir(&sftp, remote_path) {
                // 递归下载目录
                for entry in WalkDir::new(remote_path) {
                    let entry = entry.map_err(|e| format!("无法读取目录条目: {}", e))?;
                    let entry_path = entry.path();
                    let relative_path = entry_path.strip_prefix(remote_path).unwrap();
                    let local_file_path = local_path.join(relative_path);
                    if remote_path_is_dir(&sftp, entry_path) {
                        // 创建本地目录
                        std::fs::create_dir_all(&local_file_path)
                            .map_err(|e| format!("无法创建本地目录: {:?}", e))?;
                    } else {
                        // 下载文件
                        if !download_server_file(entry_path, &local_file_path, &sftp) {
                            return Err(format!("下载文件[{}]失败！", entry_path.display()));
                        }
                    }
                }
            } else {
                // 下载单个文件
                if !download_server_file(remote_path, local_path, &sftp) {
                    return Err(format!("下载文件[{}]失败！", remote_path.display()));
                }
            }
        }

        entry.last_used = Instant::now();
        Ok(true)
    })();

    match outcome {
        Ok(_) => Ok(true),
        Err(e) => {
            ssh_pool::invalidate(username, server);
            Err(e)
        }
    }
}

/// 验证远程服务器路径是否是目录
///
/// # Arguments
/// * `sftp` - SFTP会话
/// * `path` - 远程路径
///
/// # Returns
/// * `true` 成功 - 路径是目录
/// * `false` 失败 - 路径不是目录
// 这是一个辅助函数，用于确定远程路径是否是目录
fn remote_path_is_dir(sftp: &ssh2::Sftp, path: &Path) -> bool {
    if let Ok(metadata) = sftp.stat(path) {
        metadata.is_dir()
    } else {
        false
    }
}

/// 下载远程服务器文件
///
/// # Arguments
/// * `remote_path` - 远程文件路径
/// * `local_path` - 本地文件路径
/// * `sftp` - SFTP会话
///
/// # Returns
/// * `true` 成功
/// * `false` 失败
fn download_server_file(remote_path: &Path, local_path: &Path, sftp: &ssh2::Sftp) -> bool {
    match sftp.open(remote_path) {
        Ok(mut remote_file) => {
            if let Ok(mut local_file) = File::create(local_path) {
                let mut buffer = Vec::new();
                if remote_file.read_to_end(&mut buffer).is_ok()
                    && local_file.write_all(&buffer).is_ok() {
                        return true;
                    }
            }
        }
        Err(e) => {
            eprintln!("无法打开远程文件: {:?}", e);
        }
    }
    false
}

/// 上传文件到服务器
///
/// # Arguments
/// * `local_paths` - 本地文件|目录路径
/// * `remote_paths` - 远程文件|目录路径
/// * `username` - 用户名称
/// * `password` - 用户密码
/// * `server` - 服务器地址
///
/// # Returns
/// * `Ok(true)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn upload_server_files(
    remote_paths: Vec<String>,
    local_paths: Vec<String>,
    username: &str,
    password: &str,
    server: &str,
) -> Result<bool, String> {
    let mut attempts = 0;
    let mut err_msg = String::new();
    while attempts < MAX_RETRIES {
        match exec_upload_server_files(
            remote_paths.clone(),
            local_paths.clone(),
            username,
            password,
            server,
        )
        .await
        {
            Ok(output) => return Ok(output),
            Err(e) => {
                eprintln!("尝试 {} 失败: {}，正在重试...", attempts + 1, e);
                attempts += 1;
                thread::sleep(RETRY_DELAY);
                err_msg = e.to_string();
            }
        }
    }
    Err(format!(
        "尝试 {} 次后，仍无法将上传文件到服务器：{}",
        attempts, err_msg
    ))
}

/// 上传文件到服务器
///
/// # Arguments
/// * `local_paths` - 本地文件|目录路径
/// * `remote_paths` - 远程文件|目录路径
/// * `username` - 用户名称
/// * `password` - 用户密码
/// * `server` - 服务器地址
///
/// # Returns
/// * `Ok(true)` 成功
/// * `Err(String)` 失败
async fn exec_upload_server_files(
    remote_paths: Vec<String>,
    local_paths: Vec<String>,
    username: &str,
    password: &str,
    server: &str,
) -> Result<bool, String> {
    if local_paths.len() != remote_paths.len() {
        return Err("本地路径和远程路径的数量必须相同.".into());
    }

    // 从连接池取（或新建）已认证的 SSH 会话
    let shared = ssh_pool::get_session(username, password, server)?;

    let outcome: Result<bool, String> = (|| {
        let mut entry = shared
            .lock()
            .map_err(|_| "SSH 会话锁中毒".to_string())?;

        let sftp = entry
            .session
            .sftp()
            .map_err(|e| format!("无法创建 SFTP 会话: {}", e))?;
        for (local_path, remote_path) in local_paths.iter().zip(remote_paths.iter()) {
            let local_path = Path::new(local_path);
            let remote_path = Path::new(remote_path);
            if local_path.is_dir() {
                // 递归上传目录
                for entry in WalkDir::new(local_path) {
                    let entry = entry.map_err(|e| format!("无法读取目录条目: {}", e))?;
                    let entry_path = entry.path();
                    let relative_path = entry_path.strip_prefix(local_path).unwrap();
                    let remote_file_path = remote_path.join(relative_path);
                    if entry_path.is_dir() {
                        // 创建远程目录
                        println!("创建远程目录: {}", remote_file_path.display());
                        sftp.mkdir(&remote_file_path, 0o755)
                            .map_err(|e| format!("无法创建远程目录: {:?}", e))?;
                    } else {
                        // 上传文件
                        if !upload_server_file(entry_path, &remote_file_path, &sftp) {
                            return Err(format!("上传文件[{}]失败！", entry_path.display()));
                        }
                    }
                }
            } else {
                // 上传单个文件
                if !upload_server_file(local_path, remote_path, &sftp) {
                    return Err(format!("上传文件[{}]失败！", local_path.display()));
                }
            }
        }

        entry.last_used = Instant::now();
        Ok(true)
    })();

    match outcome {
        Ok(_) => Ok(true),
        Err(e) => {
            ssh_pool::invalidate(username, server);
            Err(e)
        }
    }
}

/// 上传服务器文件
///
/// # Arguments
/// * `local_paths` - 本地文件|目录路径
/// * `remote_paths` - 远程文件|目录路径
/// * `sftp` - SFTP会话
///
/// # Returns
/// * `true` 成功
/// * `false` 失败
fn upload_server_file(local_path: &Path, remote_path: &Path, sftp: &ssh2::Sftp) -> bool {
    // 打开本地文件
    let local_file_result = File::open(local_path);
    let mut local_file = match local_file_result {
        Ok(file) => file,
        Err(e) => {
            println!("无法打开本地文件 {}: {}", local_path.display(), e);
            return false;
        }
    };

    // 创建远程文件
    let mut remote_file = match sftp.create(remote_path) {
        Ok(file) => file,
        Err(e) => {
            println!("无法创建远程文件 {}: {}", remote_path.display(), e);
            return false;
        }
    };

    // 将本地文件内容写入远程文件
    let mut buffer = Vec::new();
    if local_file.read_to_end(&mut buffer).is_err() {
        println!("无法读取本地文件 {}", local_path.display());
        return false;
    }
    if remote_file.write_all(&buffer).is_err() {
        println!("无法写入远程文件 {}", remote_path.display());
        return false;
    }

    true
}

/// 执行本地命令
///
/// # Arguments
/// * `command` - 执行的命令
/// * `args` - 执行的参数
///
/// # Returns
/// * `Ok(String)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn execute_local_command(
    command: &str,
    args: Vec<String>,
    retry_count: Option<u32>,
    retry_interval_secs: Option<u64>,
) -> Result<String, String> {
    let max_attempts = retry_count.unwrap_or(MAX_RETRIES).max(1);
    let delay = retry_interval_secs
        .filter(|s| *s > 0)
        .map(Duration::from_secs)
        .unwrap_or(RETRY_DELAY);
    let mut attempts = 0;
    let mut err_msg = String::new();
    while attempts < max_attempts {
        match exec_local_command(command, args.clone()).await {
            Ok(output) => return Ok(output),
            Err(e) => {
                eprintln!("尝试 {} 失败: {}，正在重试...", attempts + 1, e);
                attempts += 1;
                if attempts < max_attempts {
                    thread::sleep(delay);
                }
                err_msg = e.to_string();
            }
        }
    }
    Err(format!(
        "尝试 {} 次后，该命令仍无法执行：{}",
        attempts, err_msg
    ))
}

/// 执行本地命令
///
/// # Arguments
/// * `command` - 执行的命令
/// * `args` - 执行的参数
///
/// # Returns
/// * `Ok(String)` 成功
/// * `Err(String)` 失败
async fn exec_local_command(command: &str, args: Vec<String>) -> Result<String, String> {
    match Command::new(command)
        .args(args)
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output()
    {
        Ok(output) => {
            if output.status.success() {
                let (stdout, _, _) = GBK.decode(&output.stdout);
                Ok(stdout.to_string())
            } else {
                let (stderr, _, _) = GBK.decode(&output.stderr);
                Err(format!("命令失败，出现错误:\n{}", stderr))
            }
        }
        Err(e) => {
            if e.kind() == ErrorKind::NotFound {
                Err("找不到命令".to_string())
            } else {
                Err(format!("无法执行命令: {}", e))
            }
        }
    }
}

/// 运行命令
///
/// # Arguments
/// * `command` - 执行的命令
/// * `args` - 执行的参数
///
/// # Returns
/// * `Ok(String)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn exec_local_command_spawn(command: &str, args: Vec<String>) -> Result<(), String> {
    let mut child = Command::new(command)
        .args(args)
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .spawn()
        .map_err(|e| format!("命令失败，出现错误: {}", e))?;

    let status = child.wait().map_err(|e| format!("无法等待 child: {}", e))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("命令已退出，状态为： {}", status))
    }
}

/// 执行本地命令（指定工作目录）
///
/// # Arguments
/// * `command` - 执行的命令
/// * `args` - 执行的参数
/// * `working_dir` - 工作目录
///
/// # Returns
/// * `Ok(String)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn execute_local_command_with_working_dir(
    command: &str,
    args: Vec<String>,
    working_dir: &str,
) -> Result<String, String> {
    let mut attempts = 0;
    let mut err_msg = String::new();
    while attempts < MAX_RETRIES {
        match exec_local_command_with_working_dir(command, args.clone(), working_dir).await {
            Ok(output) => return Ok(output),
            Err(e) => {
                eprintln!("尝试 {} 失败: {}，正在重试...", attempts + 1, e);
                attempts += 1;
                thread::sleep(RETRY_DELAY);
                err_msg = e.to_string();
            }
        }
    }
    Err(format!(
        "尝试 {} 次后，该命令仍无法执行：{}",
        attempts, err_msg
    ))
}

/// 执行本地命令（指定工作目录）
///
/// # Arguments
/// * `command` - 执行的命令
/// * `args` - 执行的参数
/// * `working_dir` - 工作目录
///
/// # Returns
/// * `Ok(String)` 成功
/// * `Err(String)` 失败
async fn exec_local_command_with_working_dir(
    command: &str,
    args: Vec<String>,
    working_dir: &str,
) -> Result<String, String> {
    match Command::new(command)
        .args(args)
        .current_dir(working_dir)
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output()
    {
        Ok(output) => {
            if output.status.success() {
                // 尝试使用 UTF-8 解码，如果失败则回退到 GBK 解码
                let (stdout, _encoding_used, is_errors) = UTF_8.decode(&output.stdout);
                if is_errors {
                    // 如果 UTF-8 解码出现错误，使用 GBK 解码
                    let (gbk_stdout, _, _) = GBK.decode(&output.stdout);
                    Ok(gbk_stdout.to_string())
                } else {
                    Ok(stdout.to_string())
                }
            } else {
                // 错误信息同样处理编码问题
                let (stderr, _encoding_used, is_errors) = UTF_8.decode(&output.stderr);
                if is_errors {
                    let (gbk_stderr, _, _) = GBK.decode(&output.stderr);
                    Err(format!("命令失败，出现错误:\n{}", gbk_stderr))
                } else {
                    Err(format!("命令失败，出现错误:\n{}", stderr))
                }
            }
        }
        Err(e) => {
            if e.kind() == ErrorKind::NotFound {
                Err("找不到命令".to_string())
            } else {
                Err(format!("无法执行命令: {}", e))
            }
        }
    }
}

/// 读取目录中的所有DLL文件
///
/// # Arguments
/// * `dir` - 目录路径
///
/// # Returns
/// * `Ok(Vec<String>)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn read_all_dlls(dir: &str) -> Result<Vec<String>, String> {
    let mut dll_files = Vec::new();

    // 迭代指定目录中的文件
    let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        // 检查文件是否为 DLL
        if path.extension() == Some(OsStr::new("dll")) {
            if let Some(file_name) = path.to_str() {
                dll_files.push(file_name.to_string());
            }
        }
    }

    Ok(dll_files)
}

/// 读取日期范围内的DLL文件
///
/// # Arguments
/// * `dir` - 目录路径
/// * `start_date` - 起始日期
/// * `end_date` - 结束日期
///
/// # Returns
/// * `Ok(Vec<String>)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn read_dlls_in_date_range(
    dir: &str,
    start_date: &str,
    end_date: &str,
) -> Result<Vec<String>, String> {
    let start_date: NaiveDateTime = NaiveDateTime::parse_from_str(start_date, "%Y-%m-%d %H:%M:%S")
        .map_err(|e| format!("无效的起始日期: {}", e))?;
    let end_date = NaiveDateTime::parse_from_str(end_date, "%Y-%m-%d %H:%M:%S")
        .map_err(|e| format!("无效的结束日期: {}", e))?;

    let mut dll_files = Vec::new();

    // 迭代指定目录中的文件
    let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        // 检查文件是否为 DLL
        if path.extension() == Some(OsStr::new("dll")) {
            let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;

            if let Ok(modified) = metadata.modified() {
                let modified_date: DateTime<Local> = modified.into();
                let file_date = modified_date.naive_local();

                // 检查文件的修改日期是否在指定范围内
                if file_date >= start_date && file_date <= end_date {
                    if let Some(file_name) = path.to_str() {
                        dll_files.push(file_name.to_string());
                    }
                }
            }
        }
    }

    Ok(dll_files)
}

/// 保存内容到文件
///
/// # Arguments
/// * `content` - 内容
/// * `file_path` - 文件路径
///
/// # Returns
/// * `Ok(true)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn save_content_to_file(content: &str, file_path: &str) -> Result<bool, String> {
    // 创建或打开文件
    let mut file = File::create(file_path).map_err(|e| e.to_string())?;
    // 将内容值写入文件
    file.write_all(content.as_bytes())
        .map_err(|e| e.to_string())?;
    Ok(true)
}

/// 读取内容文件
///
/// # Arguments
/// * `file_path` - 文件路径
///
/// # Returns
/// * `Ok(String)` 成功
/// * `Err(String)` 失败
#[tauri::command]
pub async fn read_content_to_file(file_path: &str) -> Result<String, String> {
    match File::open(file_path) {
        Ok(mut file) => {
            let mut contents = String::new();
            if file.read_to_string(&mut contents).is_ok() {
                Ok(contents)
            } else {
                Err("无法读取文件".to_string())
            }
        }
        Err(e) => Err(format!("打开文件时出错: {}", e)),
    }
}

/// 获取加密Key
///
/// # Returns
/// * `Ok(String)` 成功
#[tauri::command]
pub async fn get_encryption_key() -> String {
    // 先写死
    let key = "REX_SMOM_15200";
    // ...
    key.to_string()
}

/// 删除指定目录中所有以给定前缀开头的文件
///
/// # 参数
/// - `dir_path`: 要扫描并删除文件的目录路径
/// - `prefix`: 文件名前缀，用于匹配需要删除的文件
///
/// # 返回值
/// - `Ok(true)` 表示操作完成（不一定有文件被删除）
/// - `Err(String)` 表示过程中发生错误
#[tauri::command]
pub async fn delete_files_with_prefix(dir_path: &str, prefix: &str) -> Result<bool, String> {
    let path = Path::new(dir_path);

    if !path.exists() {
        return Err(format!("目录不存在: {}", dir_path));
    }

    if !path.is_dir() {
        return Err(format!("提供的路径不是一个目录: {}", dir_path));
    }

    for entry in fs::read_dir(path).map_err(|e| format!("读取目录失败: {}", e))? {
        let entry = entry.map_err(|e| format!("读取目录条目失败: {}", e))?;
        let path = entry.path();

        if path.is_file() {
            if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                if file_name.starts_with(prefix) {
                    if let Err(e) = fs::remove_file(&path) {
                        return Err(format!("删除文件失败 {}: {}", path.display(), e));
                    }
                }
            }
        }
    }

    Ok(true)
}

/// 根据文件名过滤器复制
///
/// # 参数
/// - `src_dir`: 源目录
/// - `dest_dir`: 目标目录
/// - `filter`: 过滤条件
///
/// # 返回值
/// - `Ok(true)` 表示操作完成
/// - `Err(String)` 表示过程中发生错误
fn copy_dlls_with_filter<P, F>(src_dir: P, dest_dir: P, filter: F) -> Result<bool, String>
where
    P: AsRef<Path>,
    F: Fn(&str) -> bool,
{
    let src = src_dir.as_ref();
    let dest = dest_dir.as_ref();

    // 确保目标目录存在
    fs::create_dir_all(dest).map_err(|e| format!("无法创建目标目录 {:?}: {}", dest, e))?;

    for entry in fs::read_dir(src).map_err(|e| format!("无法读取源目录 {:?}: {}", src, e))? {
        let entry = entry.map_err(|e| format!("读取目录项失败: {}", e))?;
        let path = entry.path();

        // 跳过非文件项（如子目录）
        if !path.is_file() {
            continue;
        }

        let file_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(name) => name,
            None => continue, // 跳过非 UTF-8 文件名（不视为错误）
        };

        // 检查是否是 .dll 文件（不区分大小写）
        if !file_name.to_lowercase().ends_with(".dll") {
            continue;
        }

        if filter(file_name) {
            let dest_path = dest.join(file_name);
            fs::copy(&path, &dest_path)
                .map_err(|e| format!("复制文件 {:?} 到 {:?} 失败: {}", path, dest_path, e))?;
        }
    }

    Ok(true) // 成功完成
}

/// 复制以SIE开头的dll文件
///
/// # 参数
/// - `src_dir`: 源目录
/// - `dest_dir`: 目标目录
///
/// # 返回值
/// - `Ok(true)` 表示操作完成
/// - `Err(String)` 表示过程中发生错误
#[tauri::command]
pub async fn copy_sie_dlls(src_dir: &str, dest_dir: &str) -> Result<bool, String> {
    copy_dlls_with_filter(src_dir, dest_dir, |file_name| file_name.starts_with("SIE"))
}

/// 复制不以SIE开头的dll文件
///
/// # 参数
/// - `src_dir`: 源目录
/// - `dest_dir`: 目标目录
///
/// # 返回值
/// - `Ok(true)` 表示操作完成
/// - `Err(String)` 表示过程中发生错误
#[tauri::command]
pub async fn copy_non_sie_dlls(src_dir: &str, dest_dir: &str) -> Result<bool, String> {
    copy_dlls_with_filter(src_dir, dest_dir, |file_name| !file_name.starts_with("SIE"))
}

use regex::Regex;
use std::collections::HashMap;
use std::time::SystemTime;

/// 将通配符模式转换为正则表达式
fn wildcard_to_regex(pattern: &str) -> Result<Regex, regex::Error> {
    let pattern = pattern.trim();
    if pattern.is_empty() {
        return Regex::new("^$");
    }
    let regex_str = if pattern.to_lowercase().ends_with(".dll") {
        regex::escape(pattern)
    } else {
        format!("{}\\.dll", regex::escape(pattern))
    };
    let regex_str = regex_str.replace(r"\*", ".*").replace(r"\?", ".");
    Regex::new(&format!("^{}$", regex_str))
}

/// 解析模式文本，支持换行和顿号分隔
fn parse_patterns(patterns_text: &str) -> Vec<Regex> {
    let mut patterns = Vec::new();
    for line in patterns_text.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        // 如果行中包含顿号且不含通配符，则按顿号分割
        if line.contains('、') && !line.contains('*') && !line.contains('?') {
            for item in line.split('、') {
                let item = item.trim();
                if item.is_empty() {
                    continue;
                }
                if let Ok(re) = wildcard_to_regex(item) {
                    patterns.push(re);
                }
            }
        } else if let Ok(re) = wildcard_to_regex(line) {
            patterns.push(re);
        }
    }
    patterns
}

/// 根据DLL名称模式复制文件（支持*和?通配符，同名文件保留最新的）
///
/// # 参数
/// - `source`: 源目录
/// - `destination`: 目标目录
/// - `patterns`: DLL名称模式文本，每行一个，支持顿号分隔
///
/// # 返回值
/// - `Ok(true)` 表示操作完成
/// - `Err(String)` 表示过程中发生错误
#[tauri::command]
pub async fn copy_dll_files_by_name(
    source: &str,
    destination: &str,
    patterns: &str,
) -> Result<bool, String> {
    let src_dir = Path::new(source);
    let dst_dir = Path::new(destination);

    if !src_dir.exists() {
        return Err(format!("源目录不存在: {}", source));
    }

    // 确保目标目录存在
    fs::create_dir_all(dst_dir).map_err(|e| format!("无法创建目标目录 {:?}: {}", dst_dir, e))?;

    let regex_patterns = parse_patterns(patterns);
    if regex_patterns.is_empty() {
        return Err("未提供有效的DLL匹配模式".to_string());
    }

    // 字典：filename -> (mtime, full_path)
    let mut latest_files: HashMap<String, (SystemTime, std::path::PathBuf)> = HashMap::new();

    // 遍历源目录中的所有文件
    for entry in
        fs::read_dir(src_dir).map_err(|e| format!("无法读取源目录 {:?}: {}", src_dir, e))?
    {
        let entry = entry.map_err(|e| format!("读取目录项失败: {}", e))?;
        let path = entry.path();

        // 跳过非文件项
        if !path.is_file() {
            continue;
        }

        let file_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(name) => name,
            None => continue,
        };

        // 检查是否是 .dll 文件（不区分大小写）
        if !file_name.to_lowercase().ends_with(".dll") {
            continue;
        }

        // 尝试匹配任一模式
        let mut matched = false;
        for re in &regex_patterns {
            if re.is_match(file_name) {
                matched = true;
                break;
            }
        }

        if !matched {
            continue;
        }

        let mtime = match fs::metadata(&path).and_then(|m| m.modified()) {
            Ok(time) => time,
            Err(_) => SystemTime::UNIX_EPOCH,
        };

        // 以文件名（忽略大小写）作为唯一键，保留修改时间最新的
        let key = file_name.to_lowercase();
        if let Some((existing_mtime, _)) = latest_files.get(&key) {
            if mtime <= *existing_mtime {
                continue;
            }
        }
        latest_files.insert(key, (mtime, path));
    }

    // 复制匹配的文件
    for (_, (_, src_path)) in latest_files {
        let dest_path = dst_dir.join(
            src_path
                .file_name()
                .ok_or_else(|| "无法获取文件名".to_string())?,
        );
        fs::copy(&src_path, &dest_path)
            .map_err(|e| format!("复制文件 {:?} 到 {:?} 失败: {}", src_path, dest_path, e))?;
    }

    Ok(true)
}
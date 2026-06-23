use std::os::windows::process::CommandExt;
use std::process::{Command, Stdio};

/// 编译项目
///
/// # Arguments
/// * `project_file_path` - 项目文件路径
/// * `msbuild_path` - MSBuild编译路径
/// * `is_rebuild` - 是否重新编译
///
/// # Returns
/// * `Ok(())` 成功
/// * `Err(String)` 失败，返回 MSBuild 错误输出
pub fn build_project(
    project_file_path: &str,
    msbuild_path: &str,
    is_rebuild: bool,
    build_mode: &str,
) -> Result<(), String> {
    let mut command = Command::new(msbuild_path);

    // 编译目标：Rebuild 或 Build
    if is_rebuild {
        command.arg("/t:Rebuild");
    } else {
        command.arg("/t:Build");
    }

    let configuration = format!("/p:Configuration={}", build_mode);

    let output = command
        .arg(project_file_path)
        .arg("/restore")
        .arg(&configuration)
        .arg("/m")
        .arg("/v:quiet")
        .arg("/clp:ErrorsOnly")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output()
        .map_err(|e| format!("启动 MSBuild 进程失败: {}", e))?;

    if output.status.success() {
        println!("编译 【{}】 成功.", project_file_path);
        Ok(())
    } else {
        // 过滤输出，只保留包含错误/警告的行，去掉 MSBuild 版本横幅等无关信息
        let all_output = String::from_utf8_lossy(&output.stdout).to_string();
        let fallback_output = String::from_utf8_lossy(&output.stderr).to_string();

        let final_msg = all_output
            .lines()
            .chain(fallback_output.lines())
            .filter(|line| line.contains(": error"))
            .map(|line| line.trim())
            .collect::<Vec<_>>()
            .join("\n");

        let final_msg = if !final_msg.is_empty() {
            final_msg
        } else {
            "编译失败，但未捕获到错误输出。请检查 MSBuild 路径或项目配置。".to_string()
        };

        eprintln!("编译 【{}】 失败: {}", project_file_path, final_msg);
        Err(final_msg)
    }
}

use std::io::{self, ErrorKind};
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
/// * `OK` 成功
/// * `Err` 失败
pub fn build_project(
    project_file_path: &str,
    msbuild_path: &str,
    is_rebuild: bool,
) -> Result<(), io::Error> {
    let mut command = Command::new(msbuild_path);

    if is_rebuild {
        command.arg("/t:Rebuild");
    }

    let output = command
        .arg(project_file_path)
        .arg("-p:Configuration=Release")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output()?;

    if output.status.success() {
        println!("编译 【{}】 成功.", project_file_path);
        Ok(())
    } else {
        eprintln!(
            "编译 【{}】 失败: {}",
            project_file_path,
            String::from_utf8_lossy(&output.stderr)
        );
        Err(io::Error::new(ErrorKind::Other, "Build failed"))
    }
}

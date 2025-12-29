use encoding_rs::GBK;
use quick_xml::events::Event;
use quick_xml::Reader;
use regex::Regex;
use std::fs;
use std::path::Path;

/// 解析.sln文件，获取模块的生成路径
///
/// # Arguments
/// * `module_name` - 模块名称
/// * `sln_file_path` - .sln文件路径
/// * `is_new_version` - 是否 10.2+ 版本
///
/// # Returns
/// * `Result<String, String>` - 执行结果和错误信息
#[tauri::command]
pub async fn parse_sln_project(module_name: &str, sln_file_path: &str, is_new_version: bool) -> Result<String, String> {
    // sln文件目录
    let sln_dir_path = Path::new(sln_file_path).parent().unwrap().to_str().unwrap();

    // 读取sln文件内容
    let sln_content = fs::read(sln_file_path).expect("无法读取.sln文件"); // read_to_string
    let (out_content, _, _) = GBK.decode(&sln_content);

    // 查找项目路径
    let project_paths = find_project_paths(&out_content.to_string()).await;
    let mut module_generate_path = "".to_string();
    for project_path in project_paths {
        if project_path.ends_with(module_name) {
            let cspj_file = format!("{}/{}", sln_dir_path, project_path);
            let cspj_dir = Path::new(&cspj_file).parent().unwrap().to_str().unwrap();

            if module_name.eq("WpfClient.csproj") && !is_new_version {
                module_generate_path = format!("{}/bin/Release", cspj_dir);
                break;
            }

            let framework_version = find_target_framework(&cspj_file).await.unwrap();
            module_generate_path = format!("{}/bin/Release/{}", cspj_dir, framework_version);
            break;
        }
    }

    if module_generate_path.is_empty() {
        return Err(format!("未找到模块 {} 的生成路径.", module_name));
    }
    Ok(module_generate_path)
}

// 查找 .sln 项目路径
pub async fn find_project_paths(sln_content: &str) -> Vec<String> {
    let mut project_paths = Vec::new();
    let re = Regex::new(r#"Project\(".*?"\) = ".*?", "([^"]+)", ".*?""#).unwrap();

    for cap in re.captures_iter(sln_content) {
        if let Some(path) = cap.get(1) {
            project_paths.push(path.as_str().replace("\\", "/"));
        }
    }

    project_paths
}

// 查找 .csproj 目标框架版本
pub async fn find_target_framework(project_path: &str) -> Option<String> {
    let file_content = fs::read_to_string(project_path).ok()?;
    let mut reader = Reader::from_str(&file_content);
    reader.trim_text(true);

    let mut buf = Vec::new();
    let mut target_framework = None;

    while let Ok(event) = reader.read_event(&mut buf) {
        match event {
            Event::Start(ref e) if e.name() == b"TargetFramework" => {
                if let Ok(Event::Text(e)) = reader.read_event(&mut buf) {
                    target_framework = Some(e.unescape_and_decode(&reader).unwrap());
                }
            }
            Event::Eof => break,
            _ => {}
        }
        buf.clear();
    }

    target_framework
}

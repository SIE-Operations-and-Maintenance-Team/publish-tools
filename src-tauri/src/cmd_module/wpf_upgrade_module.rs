use quick_xml::events::Event;
use quick_xml::Reader;
use quick_xml::Writer;
use std::io::Cursor;

/// 升级模块版本
///
/// # Arguments
/// * `file_path` - Manifest.xml文件路径
/// * `module_name` - 模块名称
///
/// # Returns
/// * `Result<String, String>` - 成功时返回累加后的新版本号，失败返回错误描述
#[tauri::command]
pub async fn upgrade_module_version(file_path: &str, module_name: &str) -> Result<String, String> {
    let content = match std::fs::read_to_string(file_path) {
        Ok(content) => content,
        Err(err) => return Err(format!("读取 Manifest.xml 文件失败: {}", err)),
    };

    let mut reader = Reader::from_str(&content);
    reader.trim_text(false);

    // 使用缩进格式化输出，方便在服务器上 cat 预览
    let mut writer = Writer::new_with_indent(Cursor::new(Vec::new()), b' ', 2);

    let mut buf = Vec::new();
    let mut in_module = false;
    let mut in_name = false;
    let mut in_version = false;
    let mut should_modify = false;
    let mut module_found = false;
    let mut current_module_name = String::new();
    let mut has_xml_decl = false;
    let mut new_version_result = String::new();

    loop {
        match reader.read_event(&mut buf) {
            Ok(Event::Decl(e)) => {
                has_xml_decl = true;
                writer.write_event(Event::Decl(e)).unwrap();
            }
            Ok(Event::Start(e)) => {
                let name_bytes: &[u8] = e.name();
                if name_bytes == b"Module" {
                    in_module = true;
                    current_module_name.clear();
                    should_modify = false;
                } else if in_module && name_bytes == b"Name" {
                    in_name = true;
                } else if in_module && name_bytes == b"Version" && should_modify {
                    in_version = true;
                }
                writer.write_event(Event::Start(e)).unwrap();
            }
            Ok(Event::End(e)) => {
                let name_bytes: &[u8] = e.name();
                if name_bytes == b"Module" {
                    in_module = false;
                    should_modify = false;
                } else if name_bytes == b"Name" && in_name {
                    if current_module_name == module_name {
                        module_found = true;
                        should_modify = true;
                    }
                    in_name = false;
                } else if name_bytes == b"Version" && in_version {
                    in_version = false;
                    should_modify = false;
                }
                writer.write_event(Event::End(e)).unwrap();
            }
            Ok(Event::Text(e)) => {
                if in_name {
                    current_module_name = std::str::from_utf8(&e)
                        .unwrap_or("")
                        .to_string();
                    writer.write_event(Event::Text(e)).unwrap();
                } else if in_version && should_modify {
                    let version_str =
                        std::str::from_utf8(&e).unwrap_or("").to_string();
                    if version_str.is_empty() {
                        writer.write_event(Event::Text(e)).unwrap();
                    } else {
                        let new_version = increment_version(&version_str)?;
                        new_version_result = new_version.clone();
                        let new_text_event =
                            Event::Text(quick_xml::events::BytesText::from_plain_str(&new_version));
                        writer.write_event(&new_text_event).unwrap();
                    }
                } else {
                    writer.write_event(Event::Text(e)).unwrap();
                }
            }
            Ok(Event::Eof) => break,
            Ok(e) => {
                writer.write_event(&e).unwrap();
            }
            Err(e) => return Err(format!("解析 XML 出错: {}", e)),
        }
        buf.clear();
    }

    if !module_found {
        return Err(format!("未找到模块 {}", module_name));
    }

    if new_version_result.is_empty() {
        return Err(format!(
            "模块 {} 未找到 Version 节点或 Version 内容为空",
            module_name
        ));
    }

    // 如果原文件没有 XML 声明头，则手动补上
    let output = writer.into_inner().into_inner();
    let final_buf = if has_xml_decl {
        output
    } else {
        let mut result = b"<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n".to_vec();
        result.extend(output);
        result
    };

    match std::fs::write(file_path, &final_buf) {
        Ok(_) => Ok(new_version_result),
        Err(err) => Err(format!("写入 Manifest.xml 文件失败: {}", err)),
    }
}

/// 版本号累加
///
/// 输入版本号支持 `x`、`x.x`、`x.x.x`、`x.x.x.x` 四种段数；
/// 仅对输入的最后一段执行 +1，不进行补齐，输出保持与输入一致的段数。
///
/// # Arguments
/// * `version` - 版本号字符串
///
/// # Returns
/// * `Result<String, String>` - 累加后的版本号，或错误描述
fn increment_version(version: &str) -> Result<String, String> {
    let raw = version.trim();
    if raw.is_empty() {
        return Err("版本号为空".to_string());
    }
    let segments: Vec<&str> = raw.split('.').collect();
    if segments.is_empty() || segments.len() > 4 {
        return Err(format!(
            "版本号格式错误：期望 1~4 段（x / x.x / x.x.x / x.x.x.x），实际为 \"{}\"",
            raw
        ));
    }
    let mut parts: Vec<u32> = Vec::with_capacity(segments.len());
    for seg in &segments {
        match seg.trim().parse::<u32>() {
            Ok(n) => parts.push(n),
            Err(_) => {
                return Err(format!(
                    "无效的版本号格式：\"{}\" 不是有效的数字",
                    seg.trim()
                ))
            }
        }
    }
    // 仅对最后一段执行 +1，保持原有段数
    let last = parts.len() - 1;
    parts[last] += 1;
    Ok(parts
        .iter()
        .map(|p| p.to_string())
        .collect::<Vec<String>>()
        .join("."))
}

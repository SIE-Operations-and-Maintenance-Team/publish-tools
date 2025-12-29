use xml_doc::Document;

/// 升级模块版本
///
/// # Arguments
/// * `file_path` - Manifest.xml文件路径
/// * `module_name` - 模块名称
///
/// # Returns
/// * `Result<bool, String>` - 执行结果和错误信息
#[tauri::command]
pub async fn upgrade_module_version(file_path: &str, module_name: &str) -> Result<bool, String> {
    // 读取 Manifest.xml 文件
    let content = match std::fs::read_to_string(file_path) {
        Ok(content) => content,
        Err(err) => return Err(format!("读取 Manifest.xml 文件失败: {}", err)),
    };

    // 获取根节点
    let mut doc = match Document::parse_str(&content) {
        Ok(doc) => doc,
        Err(err) => return Err(format!("解析 Manifest.xml 失败: {:?}", err)),
    };
    let root_node = match doc.root_element() {
        Some(node) => node,
        None => return Err("无法获取根节点".to_string()),
    };

    // 获取全部模块节点
    let module_nodes = root_node.child_elements(&doc);
    let mut found_module = false;
    for module in module_nodes {
        // 得到模块名称
        let name_node = match module.find(&doc, "Name") {
            Some(node) => node,
            None => continue,
        };
        let name_value = name_node.text_content(&doc);
        if name_value != module_name {
            continue;
        }

        // 更改模块版本号
        let version_node = match module.find(&doc, "Version") {
            Some(node) => node,
            None => continue,
        };
        let version_text = version_node.text_content(&doc);
        let version_value = version_text.as_str();
        version_node.set_text_content(&mut doc, &increment_version(version_value));
        found_module = true;
        break;
    }

    if !found_module {
        return Err(format!("未找到模块 {}", module_name));
    }

    let new_xml = match doc.write_str() {
        Ok(xml) => xml,
        Err(err) => return Err(format!("写入 Manifest.xml 失败: {:?}", err)),
    };
    match std::fs::write(file_path, new_xml.as_bytes()) {
        Ok(_) => Ok(true),
        Err(err) => Err(format!("写入 Manifest.xml 文件失败: {}", err)),
    }
}

/// 版本号累加
///
/// # Arguments
/// * `version` - 版本号
///
/// # Returns
/// * `String` - 累加后的版本号
fn increment_version(version: &str) -> String {
    let mut parts: Vec<u32> = version
        .split('.')
        .map(|part| part.parse().unwrap())
        .collect();
    parts[3] += 1;
    parts
        .iter()
        .map(|part| part.to_string())
        .collect::<Vec<String>>()
        .join(".")
}

use std::path::Path;

/// Docker 挂载点映射，对应 `docker inspect` 的 `Mounts` 元素
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Mount {
    pub source: String,
    pub destination: String,
}

/// 大小写不敏感的前缀匹配
///
/// 若 `prefixes` 中任一项是 `name` 的前缀（忽略大小写），返回 true。
pub fn matches_prefix(name: &str, prefixes: &[String]) -> bool {
    let lower = name.to_lowercase();
    prefixes.iter().any(|p| lower.starts_with(&p.to_lowercase()))
}

/// 清洗 Windows 服务 PathName，提取真实可发布目录
///
/// 逻辑复刻 Qt 遗留实现（spec §6.3）：
/// 1) 去引号
/// 2) 截断 `-instance` 及其后参数
/// 3) 若含 `dotnet.exe`（大小写不敏感），取其后的可执行路径
/// 4) 取 parent 目录
///
/// 返回的分隔符保持系统原生（Windows 下为 `\`），以满足现有单测的 verbatim 断言；
/// 若需前端统一展示为 `/`，由调用方自行 `replace('\\', "/")`。
pub fn extract_real_path(path_name: &str) -> String {
    if path_name.trim().is_empty() {
        return "".into();
    }
    // 1) 去引号
    let mut s = path_name.replace('"', "");
    // 2) 找 -instance 前截断
    if let Some(idx) = s.find("-instance") {
        s = s[..idx].trim().to_string();
    }
    // 3) 若含 dotnet.exe，取其后
    let keyword = "dotnet.exe";
    let exe_path = if let Some(pos) = s.to_lowercase().find(keyword) {
        s[pos + keyword.len()..].trim().to_string()
    } else {
        s.trim().to_string()
    };
    if exe_path.is_empty() {
        return "".into();
    }
    // 4) 取 parent 目录，返回原生分隔符（Windows 为 \）
    let p = Path::new(&exe_path);
    p.parent()
        .map(|d| d.to_string_lossy().to_string())
        .unwrap_or_default()
}

/// 解析 `docker inspect` 的 `.Mounts` JSON 数组字符串
///
/// `inspect_json` 为 JSON 数组字符串，例如：
/// `[{"Source":"/data/sie/webapi","Destination":"/app","Type":"bind"}]`
/// 非法 JSON 或非数组时返回空 Vec；跳过 Source 为空的条目。
pub fn parse_docker_inspect_mounts(inspect_json: &str) -> Vec<Mount> {
    let v: serde_json::Value =
        serde_json::from_str(inspect_json).unwrap_or(serde_json::Value::Null);
    let arr = match v.as_array() {
        Some(a) => a,
        None => return vec![],
    };
    arr.iter()
        .filter_map(|o| {
            let src = o.get("Source")?.as_str()?.to_string();
            let dst = o.get("Destination")?.as_str().unwrap_or("").to_string();
            if src.is_empty() {
                None
            } else {
                Some(Mount {
                    source: src,
                    destination: dst,
                })
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn extract_dotnet_with_instance() {
        let s = r#""C:\Program Files\dotnet\dotnet.exe" C:\SIE\WebApiHost\WebApiHost.dll -instance SIE.WebApiHost"#;
        assert_eq!(extract_real_path(s), r"C:\SIE\WebApiHost");
    }
    #[test]
    fn extract_no_dotnet_with_instance() {
        let s = r#"C:\SIE\ScheduleServer\ScheduleServer.exe -instance SIE.ScheduleServer"#;
        assert_eq!(extract_real_path(s), r"C:\SIE\ScheduleServer");
    }
    #[test]
    fn extract_no_instance_keeps_original_parent() {
        let s = r#"C:\SIE\WebApiHost\WebApiHost.exe"#;
        assert!(extract_real_path(s).contains("SIE"));
    }
    #[test]
    fn extract_empty() {
        assert_eq!(extract_real_path(""), "");
    }
    #[test]
    fn parse_mounts() {
        let j = r#"[{"Source":"/data/sie/webapi","Destination":"/app","Type":"bind"}]"#;
        let m = parse_docker_inspect_mounts(j);
        assert_eq!(m[0].source, "/data/sie/webapi");
    }
    #[test]
    fn matches_prefix_case_insensitive() {
        assert!(matches_prefix("SIE.WebApiHost", &["sie.".into()]));
        assert!(!matches_prefix("OtherSvc", &["SIE.".into()]));
    }
}

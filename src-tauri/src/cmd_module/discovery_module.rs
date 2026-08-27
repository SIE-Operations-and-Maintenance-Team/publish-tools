/// Docker 挂载点映射，对应 `docker inspect` 的 `Mounts` 元素
///
/// 前端 TS 类型为 `DiscoveryMount { Source, Destination }`，此处通过
/// `serde(rename)` 使序列化产出大写键，同时保持 Rust 字段的 snake_case
/// 访问（`mount.source`）以兼容既有单测。
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Mount {
    #[serde(rename = "Source")]
    pub source: String,
    #[serde(rename = "Destination")]
    pub destination: String,
}

/// 发现结果项，对应 TS `DiscoveryItem`
///
/// 序列化采用 `camelCase` 以与 `src/types/discovery.d.ts` 保持一致：
/// `serviceName / displayName / rawPath / suggestedPublishPath` 等。
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryItem {
    pub service_name: String,
    pub display_name: String,
    pub raw_path: String,
    pub suggested_publish_path: String,
    pub source: String,
    pub container_id: Option<String>,
    pub mounts: Option<Vec<Mount>>,
    pub image: Option<String>,
}

/// 大小写不敏感的前缀匹配
///
/// 若 `prefixes` 中任一项是 `name` 的前缀（忽略大小写），返回 true。
pub fn matches_prefix(name: &str, prefixes: &[String]) -> bool {
    let lower = name.to_lowercase();
    prefixes
        .iter()
        .any(|p| lower.starts_with(&p.to_lowercase()))
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
    // 4) 取 parent 目录 — 分隔符无关（同时处理 / 与 \），避免 Linux 宿主上 Path::parent 对 Windows 路径失效
    if let Some(idx) = exe_path.rfind(['/', '\\']) {
        return exe_path[..idx].to_string();
    }
    "".into()
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

// ---------------------------------------------------------------------------
// 本机 Windows 服务发现（Win32 API，spawn_blocking）
// ---------------------------------------------------------------------------

#[cfg(windows)]
fn discover_local_services_blocking(prefixes: &[String]) -> Result<Vec<DiscoveryItem>, String> {
    use windows::core::PCWSTR;
    use windows::Win32::System::Services::{
        CloseServiceHandle, EnumServicesStatusExW, OpenSCManagerW, OpenServiceW,
        QueryServiceConfigW, ENUM_SERVICE_STATUS_PROCESSW, QUERY_SERVICE_CONFIGW,
        SC_ENUM_PROCESS_INFO, SC_HANDLE, SC_MANAGER_ENUMERATE_SERVICE, SERVICE_QUERY_CONFIG,
        SERVICE_STATE_ALL, SERVICE_WIN32,
    };

    unsafe {
        let scm: SC_HANDLE =
            OpenSCManagerW(None, None, SC_MANAGER_ENUMERATE_SERVICE).map_err(|e| {
                let msg = e.message();
                if msg.contains("5") || format!("{e:?}").contains("Access") {
                    return "本机扫描需要管理员权限，请以管理员身份重开应用后重试".to_string();
                }
                format!("打开服务管理器失败: {e:?} - {msg}")
            })?;

        // 确保句柄在所有路径下关闭
        struct ScmGuard(SC_HANDLE);
        impl Drop for ScmGuard {
            fn drop(&mut self) {
                unsafe {
                    let _ = CloseServiceHandle(self.0);
                }
            }
        }
        let _scm_guard = ScmGuard(scm);

        // 第一次调用获取所需字节数（预期返回 ERROR_MORE_DATA）
        let mut bytes_needed: u32 = 0;
        let mut services_returned: u32 = 0;
        let mut resume_handle: u32 = 0;
        let _ = EnumServicesStatusExW(
            scm,
            SC_ENUM_PROCESS_INFO,
            SERVICE_WIN32,
            SERVICE_STATE_ALL,
            None,
            &mut bytes_needed,
            &mut services_returned,
            Some(&mut resume_handle as *mut u32),
            None,
        );
        if bytes_needed == 0 {
            return Ok(vec![]);
        }

        let mut buffer = vec![0u8; bytes_needed as usize];
        // 重置 resume_handle 后重新枚举
        resume_handle = 0;
        EnumServicesStatusExW(
            scm,
            SC_ENUM_PROCESS_INFO,
            SERVICE_WIN32,
            SERVICE_STATE_ALL,
            Some(buffer.as_mut_slice()),
            &mut bytes_needed,
            &mut services_returned,
            Some(&mut resume_handle as *mut u32),
            None,
        )
        .map_err(|e| format!("枚举服务失败: {e:?} - {}", e.message()))?;
        if services_returned == 0 {
            return Ok(vec![]);
        }

        let services = std::slice::from_raw_parts(
            buffer.as_ptr() as *const ENUM_SERVICE_STATUS_PROCESSW,
            services_returned as usize,
        );

        let mut items = Vec::new();
        for svc in services {
            let name = svc.lpServiceName.to_string().unwrap_or_default();
            let display = svc.lpDisplayName.to_string().unwrap_or_default();
            if !matches_prefix(&name, prefixes) {
                continue;
            }

            // 查询 PathName
            let mut path_name = String::new();
            // 将 service name 转为 PCWSTR
            let wide: Vec<u16> = name.encode_utf16().chain(std::iter::once(0)).collect();
            if let Ok(handle) = OpenServiceW(scm, PCWSTR(wide.as_ptr()), SERVICE_QUERY_CONFIG) {
                // 先获取所需字节
                let mut needed: u32 = 0;
                let _ = QueryServiceConfigW(handle, None, 0, &mut needed);
                if needed > 0 {
                    let mut cfg_buf = vec![0u8; needed as usize];
                    let cfg_ptr = cfg_buf.as_mut_ptr() as *mut QUERY_SERVICE_CONFIGW;
                    if QueryServiceConfigW(handle, Some(cfg_ptr), needed, &mut needed).is_ok() {
                        let cfg = &*cfg_ptr;
                        if !cfg.lpBinaryPathName.is_null() {
                            path_name = cfg.lpBinaryPathName.to_string().unwrap_or_default();
                        }
                    }
                }
                let _ = CloseServiceHandle(handle);
            }

            let raw_path = path_name.clone();
            let suggested = extract_real_path(&path_name);

            items.push(DiscoveryItem {
                service_name: name.clone(),
                display_name: if display.is_empty() {
                    name.clone()
                } else {
                    display
                },
                raw_path,
                suggested_publish_path: suggested,
                source: "win32".to_string(),
                container_id: None,
                mounts: None,
                image: None,
            });
        }

        Ok(items)
    }
}

/// 本机 Windows 服务发现（Tauri 命令）
///
/// Windows 下走 Win32 API（`spawn_blocking` 避免阻塞 Tokio），非 Windows 返回 Err。
#[tauri::command]
pub async fn discover_local_services(prefixes: Vec<String>) -> Result<Vec<DiscoveryItem>, String> {
    #[cfg(not(windows))]
    {
        let _ = prefixes;
        return Err("仅 Windows 支持本机扫描".into());
    }
    #[cfg(windows)]
    {
        let items =
            tokio::task::spawn_blocking(move || discover_local_services_blocking(&prefixes))
                .await
                .map_err(|e| e.to_string())??;
        Ok(items)
    }
}

// ---------------------------------------------------------------------------
// 远端 Windows 服务发现（SSH + PowerShell）
// ---------------------------------------------------------------------------

#[derive(Debug, serde::Deserialize)]
struct RemoteWinServiceRaw {
    #[serde(rename = "Name")]
    name: String,
    #[serde(rename = "PathName")]
    path_name: Option<String>,
}

/// 远端 Windows 服务发现（Tauri 命令）
///
/// 通过 `file_module::execute_remote_command`（含重试与 GBK/UTF-8 解码）执行
/// PowerShell `Get-CimInstance Win32_Service`，解析后过滤前缀并清洗路径。
#[tauri::command]
pub async fn discover_remote_windows_services(
    username: String,
    password: String,
    server: String,
    prefixes: Vec<String>,
) -> Result<Vec<DiscoveryItem>, String> {
    let cmd = r#"powershell -NoProfile -Command "Get-CimInstance Win32_Service | Select-Object Name,PathName | ConvertTo-Json -Compress""#;
    let out = crate::cmd_module::file_module::execute_remote_command(
        &username, &password, &server, cmd, None, None,
    )
    .await
    .map_err(|e| format!("远端 Windows 服务查询失败: {e}"))?;

    let trimmed = out.trim();
    if trimmed.is_empty() || trimmed == "null" {
        return Ok(vec![]);
    }

    let value: serde_json::Value =
        serde_json::from_str(trimmed).map_err(|e| format!("解析远端服务 JSON 失败: {e}"))?;

    // PowerShell 单对象时返回 object，多对象时返回 array，统一为 vec
    let arr: Vec<RemoteWinServiceRaw> = if value.is_array() {
        serde_json::from_value(value).map_err(|e| format!("解析远端服务 JSON 失败: {e}"))?
    } else if value.is_object() {
        let one: RemoteWinServiceRaw =
            serde_json::from_value(value).map_err(|e| format!("解析远端服务 JSON 失败: {e}"))?;
        vec![one]
    } else {
        return Err("远端返回的服务 JSON 格式异常".to_string());
    };

    let mut items = Vec::new();
    for svc in arr {
        if !matches_prefix(&svc.name, &prefixes) {
            continue;
        }
        let raw = svc.path_name.unwrap_or_default();
        let suggested = extract_real_path(&raw);
        items.push(DiscoveryItem {
            service_name: svc.name.clone(),
            display_name: svc.name.clone(),
            raw_path: raw,
            suggested_publish_path: suggested,
            source: "win32".to_string(),
            container_id: None,
            mounts: None,
            image: None,
        });
    }

    Ok(items)
}

// ---------------------------------------------------------------------------
// 远端 Docker 容器发现（SSH + docker ps/inspect）
// ---------------------------------------------------------------------------

/// 远端 Docker 容器发现（Tauri 命令）
///
/// 1) `docker ps` 列容器，过滤 Names/Image 命中前缀者
/// 2) 对命中者逐个 `docker inspect --format '{{json .Mounts}}|{{.Config.WorkingDir}}' <id>`
///    解析 Mounts[].Source 作为建议目录；无 Source 时置空，前端展示 WorkingDir 并提示手动填写。
#[tauri::command]
pub async fn discover_remote_docker_containers(
    username: String,
    password: String,
    server: String,
    prefixes: Vec<String>,
) -> Result<Vec<DiscoveryItem>, String> {
    let ps_cmd = "docker ps --format '{{.ID}}|{{.Names}}|{{.Image}}'";
    let ps_out = crate::cmd_module::file_module::execute_remote_command(
        &username, &password, &server, ps_cmd, None, None,
    )
    .await
    .map_err(|e| format!("docker ps 失败（可能未安装 Docker）：{e}"))?;

    let mut candidates: Vec<(String, String, String)> = Vec::new();
    for line in ps_out.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() < 3 {
            continue;
        }
        let id = parts[0].trim().to_string();
        let names = parts[1].trim().to_string();
        let image = parts[2].trim().to_string();
        if id.is_empty() {
            continue;
        }
        if matches_prefix(&names, &prefixes) || matches_prefix(&image, &prefixes) {
            candidates.push((id, names, image));
        }
    }

    if candidates.is_empty() {
        return Ok(vec![]);
    }

    let mut items = Vec::new();
    for (id, names, image) in candidates {
        // 单个容器 inspect，避免批量命令在远端因引号转义出错
        let inspect_cmd = format!(
            "docker inspect --format '{{{{json .Mounts}}}}|{{{{.Config.WorkingDir}}}}' {}",
            id
        );
        let inspect_out = crate::cmd_module::file_module::execute_remote_command(
            &username,
            &password,
            &server,
            &inspect_cmd,
            None,
            None,
        )
        .await
        .unwrap_or_default();

        let trimmed = inspect_out.trim();
        // 形如 '[{"Source":"/data/...","Destination":"/app"}]|/app'
        let (mounts_json, working_dir) = if let Some(idx) = trimmed.rfind('|') {
            (&trimmed[..idx], trimmed[idx + 1..].trim().to_string())
        } else {
            (trimmed, String::new())
        };

        let mounts = parse_docker_inspect_mounts(mounts_json);
        // 处理空 Source 已在 parse 中过滤，此处首个 Source 即为建议目录
        let suggested = mounts.first().map(|m| m.source.clone()).unwrap_or_default();
        // 无挂载时前端需展示 WorkingDir，此处将原始 mounts_json 与 working_dir 拼到 raw_path 供前端备用
        let raw_path = if mounts_json.trim().is_empty() || mounts_json.trim() == "null" {
            working_dir.clone()
        } else {
            mounts_json.to_string()
        };

        items.push(DiscoveryItem {
            service_name: names.clone(),
            display_name: names.clone(),
            raw_path,
            suggested_publish_path: suggested,
            source: "docker".to_string(),
            container_id: Some(id),
            mounts: Some(mounts),
            image: Some(image),
        });
    }

    Ok(items)
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
    #[test]
    fn remote_win_parse_mock() {
        let json = r#"[{"Name":"SIE.WebApiHost","PathName":"\"C:\\SIE\\WebApiHost\\WebApiHost.exe\" -instance SIE.WebApiHost"}]"#;
        let v: Vec<RemoteWinServiceRaw> = serde_json::from_str(json).unwrap();
        assert_eq!(v.len(), 1);
        assert!(matches_prefix(&v[0].name, &["SIE.".into()]));
        let raw = v[0].path_name.clone().unwrap();
        let suggested = extract_real_path(&raw);
        assert!(suggested.contains("SIE"));
        assert!(suggested.contains("WebApiHost"));
    }
    #[test]
    fn parse_mounts_empty_source_filtered() {
        let j =
            r#"[{"Source":"","Destination":"/app"},{"Source":"/data/ok","Destination":"/app2"}]"#;
        let m = parse_docker_inspect_mounts(j);
        assert_eq!(m.len(), 1);
        assert_eq!(m[0].source, "/data/ok");
    }
    #[test]
    fn discovery_item_serde_camel_case() {
        let item = DiscoveryItem {
            service_name: "SIE.WebApiHost".into(),
            display_name: "SIE.WebApiHost".into(),
            raw_path: r"C:\SIE\WebApiHost\WebApiHost.exe".into(),
            suggested_publish_path: r"C:\SIE\WebApiHost".into(),
            source: "win32".into(),
            container_id: None,
            mounts: None,
            image: None,
        };
        let j = serde_json::to_string(&item).unwrap();
        assert!(j.contains("serviceName"));
        assert!(j.contains("suggestedPublishPath"));
        assert!(!j.contains("service_name"));
    }
    #[test]
    fn mount_serde_capital_keys() {
        let m = Mount {
            source: "/data/sie/webapi".into(),
            destination: "/app".into(),
        };
        let j = serde_json::to_string(&m).unwrap();
        assert!(j.contains("\"Source\""));
        assert!(j.contains("\"Destination\""));
    }
    #[test]
    fn extract_windows_path_on_linux_host() {
        // Windows 路径在 Linux 宿主上亦能正确提取 parent（M-02 分隔符无关回归）
        let s = r"C:\SIE\WebApiHost\WebApiHost.exe";
        assert_eq!(extract_real_path(s), r"C:\SIE\WebApiHost");
        let s2 = "C:/SIE/WebApiHost/WebApiHost.exe";
        assert_eq!(extract_real_path(s2), "C:/SIE/WebApiHost");
    }
}

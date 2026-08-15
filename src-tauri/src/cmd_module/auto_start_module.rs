use std::io;
use winreg::enums::*;
use winreg::RegKey;

/// 开机自启注册表值名称（HKCU\Software\Microsoft\Windows\CurrentVersion\Run 下）
const RUN_KEY_NAME: &str = "SmomPublish";
/// 自启命令行参数：用于区分"开机自启"与"手动启动"，实现静默驻留托盘
const AUTOSTART_ARG: &str = "--autostart";

/// 打开（不存在则创建）当前用户的开机启动注册表键
fn run_key() -> io::Result<RegKey> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (key, _) = hkcu.create_subkey(r"Software\Microsoft\Windows\CurrentVersion\Run")?;
    Ok(key)
}

/// 查询是否已开启开机自启（以注册表为唯一状态源）
#[tauri::command]
pub fn get_auto_start() -> Result<bool, String> {
    let key = run_key().map_err(|e| format!("读取注册表失败: {e}"))?;
    Ok(key.get_value::<String, _>(RUN_KEY_NAME).is_ok())
}

/// 设置开机自启
/// * `enabled` - true: 写入注册表（值携带 --autostart 参数）；false: 删除注册表值
#[tauri::command]
pub fn set_auto_start(enabled: bool) -> Result<bool, String> {
    let key = run_key().map_err(|e| format!("读取注册表失败: {e}"))?;
    if enabled {
        let exe_path = std::env::current_exe().map_err(|e| format!("获取程序路径失败: {e}"))?;
        let value = format!("\"{}\" {}", exe_path.display(), AUTOSTART_ARG);
        key.set_value(RUN_KEY_NAME, &value)
            .map_err(|e| format!("写入注册表失败: {e}"))?;
    } else {
        match key.delete_value(RUN_KEY_NAME) {
            Ok(()) => {}
            // 值不存在视为已关闭，不报错
            Err(e) if e.kind() == io::ErrorKind::NotFound => {}
            Err(e) => return Err(format!("删除注册表失败: {e}")),
        }
    }
    Ok(true)
}

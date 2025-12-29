use native_dialog::MessageDialog;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIcon, TrayIconBuilder},
    AppHandle, Manager,
};

/**
 * 系统托盘
 * @param app Tauri 应用句柄
 */
pub fn smom_menu(app: &AppHandle) -> tauri::Result<TrayIcon> {
    let show = MenuItem::with_id(app, "show", "SMOM", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出平台", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;
    let tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => {
                let result = MessageDialog::new()
                    .set_title("提示")
                    .set_text("您确定要退出吗？")
                    .set_type(native_dialog::MessageType::Info)
                    .show_confirm();
                match result {
                    Ok(true) => {
                        std::process::exit(0);
                    }
                    Ok(false) => {
                        println!("用户选择了【否】");
                    }
                    Err(_) => {
                        eprintln!("出现错误");
                    }
                }
            }
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    // 如果窗口最小化了，先恢复
                    let _ = window.unminimize();
                    // 显示window窗口
                    let _ = window.show();
                    // 然后将窗口激活、置顶
                    let _ = window.set_focus();
                }
            }
            _ => {
                println!("菜单项 {:?} 未处理", event.id);
            }
        })
        .build(app)?;
    Ok(tray)
}

// 防止在发布时在 Windows 上添加额外的控制台窗口，请勿删除！！
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process;
use tauri::Manager;
use SmomPublish::cmd_module::file_module;
use SmomPublish::cmd_module::parse_sln_module;
use SmomPublish::cmd_module::sqlite_module;
use SmomPublish::cmd_module::wpf_upgrade_module;

// 了解更多关于 Tauri 命令的信息，请访问：https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("你好, {}! 欢迎来到 Rust!", name)
}

// 退出应用程序
#[tauri::command]
fn exit_app(code: i32) -> String {
    process::exit(code);
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:smom.db", sqlite_module::db_migration())
                .build(),
        )
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            if let Some(window) = app.get_webview_window("main") {
                // 如果窗口最小化了，先恢复
                let _ = window.unminimize();
                // 显示window窗口
                let _ = window.show();
                // 然后将窗口激活、置顶
                let _ = window.set_focus();
            }
            println!("应用程序已启动，参数: {:?}, 工作目录: {:?}", args, cwd);
        }))
        .setup(|app| {
            // 初始化托盘菜单
            SmomPublish::tray::smom_menu(app.handle()).expect("初始化托盘失败，请检查！");
            Ok(())
        })
        // 注册[前端调用]命令
        .invoke_handler(tauri::generate_handler![
            greet,
            exit_app,
            file_module::exists,
            file_module::create_dir,
            file_module::open_dir,
            file_module::copy_dll_files,
            file_module::copy_dll_files_by_time,
            file_module::copy_path,
            file_module::compress_zip,
            file_module::read_files,
            file_module::delete_paths,
            file_module::move_file,
            file_module::copy_path_by_time,
            file_module::is_dir_empty,
            file_module::build_project_release,
            file_module::upload_server_files,
            file_module::download_server_files,
            file_module::execute_remote_command,
            file_module::execute_local_command,
            file_module::exec_local_command_spawn,
            file_module::execute_local_command_with_working_dir,
            file_module::server_connection,
            file_module::un_zip,
            file_module::read_all_dlls,
            file_module::read_dlls_in_date_range,
            file_module::save_content_to_file,
            file_module::read_content_to_file,
            file_module::zip_dir,
            file_module::get_encryption_key,
            file_module::delete_files_with_prefix,
            file_module::copy_sie_dlls,
            file_module::copy_non_sie_dlls,
            file_module::copy_dll_files_by_name,
            wpf_upgrade_module::upgrade_module_version,
            parse_sln_module::parse_sln_project,
            parse_sln_module::find_assembly_name,
        ])
        // 保持前端在后台运行
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                if let Err(e) = window.hide() {
                    eprintln!("隐藏窗口失败: {:?}", e);
                }
                api.prevent_close();
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("运行Tauri应用程序出错，请检查！");
}
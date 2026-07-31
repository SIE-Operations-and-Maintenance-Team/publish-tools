// 防止在发布时在 Windows 上添加额外的控制台窗口，请勿删除！！
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process;
use tauri::Emitter;
use tauri::Manager;
use SmomPublish::cmd_module::file_module;
use SmomPublish::cmd_module::parse_sln_module;
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

/// 获取 MCP 配置
#[tauri::command]
fn get_mcp_config(app_handle: tauri::AppHandle) -> Result<SmomPublish::config::McpConfig, String> {
    let cfg = SmomPublish::config::load(&app_handle);
    Ok(cfg.mcp)
}

/// 更新 MCP 配置
#[tauri::command]
fn update_mcp_config(
    app_handle: tauri::AppHandle,
    mcp_enabled: Option<bool>,
    mcp_port: Option<u16>,
) -> Result<SmomPublish::config::McpConfig, String> {
    SmomPublish::config::update_mcp_config(&app_handle, mcp_enabled, mcp_port)
        .map(|cfg| cfg.mcp)
}

/// 获取 MCP 运行状态（持久化，不依赖事件时序）
#[tauri::command]
fn get_mcp_status() -> String {
    SmomPublish::config::get_mcp_status()
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

            // 启动 MCP Server（在 async 上下文中直接 await，不 block_on）
            let cfg = SmomPublish::config::load(app.handle());
            if cfg.mcp.mcp_enabled {
                let handle = app.handle().clone();
                let port = cfg.mcp.mcp_port;
                tauri::async_runtime::spawn(async move {
                    match SmomPublish::mcp::serve(handle.clone(), port).await {
                        Err(e) => {
                            eprintln!("[mcp] {e}；MCP 不可用，主界面继续运行");
                            SmomPublish::config::set_mcp_status("error");
                            let _ = handle.emit("mcp-status", serde_json::json!({
                                "status": "error",
                                "message": e
                            }));
                        }
                        Ok(()) => {
                            println!("[mcp] MCP Server 已正常退出");
                            SmomPublish::config::set_mcp_status("stopped");
                            let _ = handle.emit("mcp-status", serde_json::json!({
                                "status": "stopped"
                            }));
                        }
                    }
                });
            } else {
                println!("[mcp] MCP 已禁用（mcp_enabled=false），跳过启动");
                SmomPublish::config::set_mcp_status("disabled");
                let _ = app.handle().emit("mcp-status", serde_json::json!({
                    "status": "disabled"
                }));
            }

            Ok(())
        })
        // 注册[前端调用]命令
        .invoke_handler(tauri::generate_handler![
            greet,
            exit_app,
            get_mcp_config,
            update_mcp_config,
            get_mcp_status,
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
            file_module::invalidate_ssh_session,
            wpf_upgrade_module::upgrade_module_version,
            parse_sln_module::parse_sln_project,
            parse_sln_module::find_assembly_name,
        ])
        // 保持前端在后台运行
        .on_window_event(|window, event| if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            if let Err(e) = window.hide() {
                eprintln!("隐藏窗口失败: {:?}", e);
            }
            api.prevent_close();
        })
        .run(tauri::generate_context!())
        .expect("运行Tauri应用程序出错，请检查！");
}
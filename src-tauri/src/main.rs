// 防止在发布时在 Windows 上添加额外的控制台窗口，请勿删除！！
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process;
use tauri::Manager;
use SmomPublish::cmd_module::auto_start_module;
use SmomPublish::cmd_module::discovery_module;
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

/// 更新 MCP 配置（保存后立即生效：启动/停止 MCP 服务）
#[tauri::command]
fn update_mcp_config(
    app_handle: tauri::AppHandle,
    mcp_enabled: Option<bool>,
    mcp_port: Option<u16>,
) -> Result<SmomPublish::config::McpConfig, String> {
    let cfg = SmomPublish::config::update_mcp_config(&app_handle, mcp_enabled, mcp_port)?;
    SmomPublish::mcp::manager::apply(&app_handle);
    Ok(cfg.mcp)
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
        .plugin(tauri_plugin_sql::Builder::default().build())
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
            // 窗口标题动态带版本：标题文本取自 tauri.conf.json，版本取自 Cargo.toml（均派生自 package.json 单一事实源）
            // 注意：webview 内 document.title 不会同步到原生窗口标题，必须在 Rust 侧设置
            if let Some(window) = app.get_webview_window("main") {
                let base = window
                    .title()
                    .unwrap_or_else(|_| "SMOM平台发布工具".to_string());
                let _ = window.set_title(&format!("{} v{}", base, app.package_info().version));
            }

            // 初始化托盘菜单
            SmomPublish::tray::smom_menu(app.handle()).expect("初始化托盘失败，请检查！");

            // 初始化 MCP Server 管理（按配置启动；后续配置变更通过 update_mcp_config 动态启停）
            SmomPublish::mcp::manager::init(app.handle());

            // 开机自启（--autostart）场景：静默驻留系统托盘，不显示主窗口
            if std::env::args().any(|arg| arg == "--autostart") {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }

            Ok(())
        })
        // 注册[前端调用]命令
        .invoke_handler(tauri::generate_handler![
            greet,
            exit_app,
            auto_start_module::get_auto_start,
            auto_start_module::set_auto_start,
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
            file_module::read_dlls_by_name,
            file_module::invalidate_ssh_session,
            discovery_module::discover_local_services,
            discovery_module::discover_remote_windows_services,
            discovery_module::discover_remote_docker_containers,
            wpf_upgrade_module::upgrade_module_version,
            parse_sln_module::parse_sln_project,
            parse_sln_module::find_assembly_name,
        ])
        // 保持前端在后台运行
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if let Err(e) = window.hide() {
                    eprintln!("隐藏窗口失败: {:?}", e);
                }
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("运行Tauri应用程序出错，请检查！");

    // 应用退出时停止 MCP 服务（清理管理循环）
    SmomPublish::mcp::manager::stop_after_run();
}

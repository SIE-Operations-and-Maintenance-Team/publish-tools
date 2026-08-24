use crate::config::AppState;
use std::sync::Arc;
use std::sync::Mutex;

/// 全局共享状态，在整个应用生命周期中持有
pub struct GlobalState {
    pub app_state: Arc<Mutex<AppState>>,
}

impl GlobalState {
    pub fn new(app_handle: &tauri::AppHandle) -> Self {
        Self {
            app_state: Arc::new(Mutex::new(AppState::new(app_handle))),
        }
    }
}

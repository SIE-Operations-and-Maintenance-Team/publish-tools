// SSH 会话连接池
//
// 设计目标：避免 `execute_remote_command` / `upload_server_files` 等函数
// 每次调用都重新进行 TCP + SSH 握手 + 用户名/密码认证，
// 在批量发布场景下显著降低单次操作耗时与远端登录日志量。
//
// 复用策略：
// - 以 "username@server" 为 key 缓存 ssh2::Session；
// - 每次取用前用 keepalive_send + authenticated 双重探活；
// - 空闲超过 IDLE_TIMEOUT 视为失效，丢弃后重建；
// - 调用方在出现通道/IO 错误时主动 invalidate，下一次取用时重新登录。
//
// 注意：libssh2 同一 Session 不支持并发使用，必须通过 Mutex 串行化。

use ssh2::{MethodType, Session};
use std::collections::HashMap;
use std::net::TcpStream;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

/// 池中条目：会话 + 最近一次使用时间
pub struct PooledSession {
    pub session: Session,
    pub last_used: Instant,
}

pub type SharedSession = Arc<Mutex<PooledSession>>;

/// 空闲超时：超过该时间未使用则丢弃重建（避免长时间挂起的死连接）
const IDLE_TIMEOUT: Duration = Duration::from_secs(300);
/// keepalive 心跳间隔（秒）
const KEEPALIVE_INTERVAL: u32 = 30;

static POOL: OnceLock<Mutex<HashMap<String, SharedSession>>> = OnceLock::new();

fn pool() -> &'static Mutex<HashMap<String, SharedSession>> {
    POOL.get_or_init(|| Mutex::new(HashMap::new()))
}

fn pool_key(username: &str, server: &str) -> String {
    format!("{}@{}", username, server)
}

/// 获取一个已认证的 SSH 会话，优先复用池中现有连接，过期或不可用时重建。
///
/// 返回 `Arc<Mutex<PooledSession>>`：
/// - 调用方使用前先 `lock()` 取得独占访问；
/// - 任何后续 channel / sftp 操作必须在锁内完成；
/// - 操作完成后建议更新 `last_used`。
pub fn get_session(
    username: &str,
    password: &str,
    server: &str,
) -> Result<SharedSession, String> {
    let key = pool_key(username, server);

    // 1. 先尝试取池中已有条目
    let existing = {
        let map = pool().lock().map_err(|_| "SSH 连接池锁中毒".to_string())?;
        map.get(&key).cloned()
    };
    if let Some(shared) = existing {
        let healthy = {
            let mut entry = shared
                .lock()
                .map_err(|_| "SSH 会话锁中毒".to_string())?;
            if entry.last_used.elapsed() < IDLE_TIMEOUT
                && entry.session.authenticated()
                && entry.session.keepalive_send().is_ok()
            {
                entry.last_used = Instant::now();
                true
            } else {
                false
            }
        };
        if healthy {
            return Ok(shared);
        }
        // 不健康：从池中剔除（注意只在仍然指向同一个 Arc 时移除，避免误伤并发新建）
        let mut map = pool().lock().map_err(|_| "SSH 连接池锁中毒".to_string())?;
        if let Some(cur) = map.get(&key) {
            if Arc::ptr_eq(cur, &shared) {
                map.remove(&key);
            }
        }
    }

    // 2. 创建新会话
    let tcp = TcpStream::connect(server).map_err(|e| format!("无法连接到服务器: {}", e))?;
    let mut sess = Session::new().map_err(|e| format!("无法创建 SSH 会话: {}", e))?;
    sess.set_blocking(true);
    sess.set_tcp_stream(tcp);

    // 诊断：收集 libssh2 客户端可供协商的算法
    let client_kex = sess
        .supported_algs(MethodType::Kex)
        .map(|v| v.join(","))
        .unwrap_or_else(|_| "获取失败".to_string());
    let client_hk = sess
        .supported_algs(MethodType::HostKey)
        .map(|v| v.join(","))
        .unwrap_or_else(|_| "获取失败".to_string());
    let client_crypt = sess
        .supported_algs(MethodType::CryptCs)
        .map(|v| v.join(","))
        .unwrap_or_else(|_| "获取失败".to_string());
    let client_mac = sess
        .supported_algs(MethodType::MacCs)
        .map(|v| v.join(","))
        .unwrap_or_else(|_| "获取失败".to_string());

    sess.handshake().map_err(|e| {
        format!(
            "SSH 握手失败: {}\n\
             ── [libssh2 客户端算法] ──\n\
             Kex: {}\nHostKey: {}\nCipher: {}\nMAC: {}",
            e, client_kex, client_hk, client_crypt, client_mac
        )
    })?;
    sess.set_blocking(false);
    sess.userauth_password(username, password)
        .map_err(|e| format!("身份验证失败: {}", e))?;
    if !sess.authenticated() {
        return Err("身份验证失败".to_string());
    }
    sess.set_keepalive(true, KEEPALIVE_INTERVAL);

    let pooled = PooledSession {
        session: sess,
        last_used: Instant::now(),
    };
    let shared = Arc::new(Mutex::new(pooled));
    {
        let mut map = pool().lock().map_err(|_| "SSH 连接池锁中毒".to_string())?;
        map.insert(key, shared.clone());
    }

    Ok(shared)
}

/// 主动使某个会话失效（例：切换项目后密码可能不同、或调用方检测到通道级错误）。
pub fn invalidate(username: &str, server: &str) {
    let key = pool_key(username, server);
    if let Ok(mut map) = pool().lock() {
        map.remove(&key);
    }
}

/// 清空连接池（例：应用配置整体刷新时）
pub fn clear() {
    if let Ok(mut map) = pool().lock() {
        map.clear();
    }
}

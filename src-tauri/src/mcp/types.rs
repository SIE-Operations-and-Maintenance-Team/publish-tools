use rmcp::schemars;
use serde::Deserialize;

// ── 发布动作参数 ──

/// 发布动作的定位参数：都为空时使用界面上当前选中的项目与配置
#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct PublishActionParam {
    /// 应用配置 ID（优先级最高）
    #[serde(default)]
    pub appconfig_id: Option<i64>,
    /// 项目 ID（与 environment 一起定位应用配置）
    #[serde(default)]
    pub project_id: Option<i64>,
    /// 环境：1=Dev、2=Uat、3=Pro、4=Other，默认 Dev
    #[serde(default)]
    pub environment: Option<i64>,
}

// ── 还原备份参数 ──

/// 还原备份记录的定位参数：backup_id 优先；否则用 project_id + environment 取最新一条备份
#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct RestoreBackupParam {
    /// 备份记录 ID（优先级最高）
    #[serde(default)]
    pub backup_id: Option<i64>,
    /// 项目 ID（与 environment 一起定位该项目环境下最新一条备份）
    #[serde(default)]
    pub project_id: Option<i64>,
    /// 环境：1=Dev、2=Uat、3=Pro、4=Other，默认 Dev
    #[serde(default)]
    pub environment: Option<i64>,
}

// ── 定时发布参数 ──

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct ScheduleListParam {
    #[serde(default)]
    pub project_id: Option<i64>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct ScheduleIdParam {
    pub id: i64,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct ScheduleCreateParam {
    pub project_id: i64,
    pub project_name: String,
    pub environment: i64,
    pub appconfig_id: i64,
    pub publish_type: String,
    pub scheduled_time: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct ScheduleUpdateTimeParam {
    pub id: i64,
    pub scheduled_time: String,
}

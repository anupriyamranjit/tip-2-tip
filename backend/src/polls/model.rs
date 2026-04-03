use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Database row types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Poll {
    pub id: Uuid,
    pub trip_id: Uuid,
    pub question: String,
    pub created_by: Uuid,
    pub is_closed: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct PollOption {
    pub id: Uuid,
    pub poll_id: Uuid,
    pub label: String,
    pub sort_order: i32,
}

// ---------------------------------------------------------------------------
// Composite response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct PollWithResults {
    #[serde(flatten)]
    pub poll: Poll,
    pub options: Vec<OptionWithVotes>,
}

#[derive(Debug, Serialize)]
pub struct OptionWithVotes {
    #[serde(flatten)]
    pub option: PollOption,
    pub score: i64,
    pub user_voted: Option<i16>,
}

// ---------------------------------------------------------------------------
// Request payloads
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct CreatePoll {
    pub question: String,
    pub options: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct CastVote {
    pub option_id: Uuid,
    pub value: i16,
}

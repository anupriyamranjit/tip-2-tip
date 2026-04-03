use chrono::{DateTime, NaiveDate, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Database row types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct ItineraryItem {
    pub id: Uuid,
    pub trip_id: Uuid,
    pub day_date: NaiveDate,
    pub start_time: NaiveTime,
    pub end_time: Option<NaiveTime>,
    pub title: String,
    pub location: String,
    pub category: String,
    pub status: String,
    pub notes: Option<String>,
    pub created_by: Uuid,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Conflict detection
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct ConflictWarning {
    pub item_id: Uuid,
    pub title: String,
    pub overlap_minutes: i64,
}

// ---------------------------------------------------------------------------
// Request payloads
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct CreateItem {
    pub day_date: NaiveDate,
    pub start_time: NaiveTime,
    pub end_time: Option<NaiveTime>,
    pub title: String,
    pub location: Option<String>,
    pub category: String,
    pub status: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateItem {
    pub day_date: Option<NaiveDate>,
    pub start_time: Option<NaiveTime>,
    pub end_time: Option<NaiveTime>,
    pub title: Option<String>,
    pub location: Option<String>,
    pub category: Option<String>,
    pub status: Option<String>,
    pub notes: Option<String>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct StatusUpdate {
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct ReorderEntry {
    pub id: Uuid,
    pub sort_order: i32,
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct ItemWithConflicts {
    #[serde(flatten)]
    pub item: ItineraryItem,
    pub conflicts: Vec<ConflictWarning>,
}

#[derive(Debug, Serialize)]
pub struct DayGroup {
    pub day_date: NaiveDate,
    pub items: Vec<ItineraryItem>,
}

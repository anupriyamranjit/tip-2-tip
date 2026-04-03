use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Document {
    pub id: Uuid,
    pub trip_id: Uuid,
    pub uploaded_by: Uuid,
    pub file_name: String,
    pub file_type: String,
    pub file_size: i64,
    pub storage_path: String,
    pub created_at: DateTime<Utc>,
}

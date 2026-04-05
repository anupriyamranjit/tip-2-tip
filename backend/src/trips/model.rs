use serde::{Deserialize, Serialize};
use validator::Validate;

#[derive(Debug, Deserialize, Validate)]
pub struct CreateTripRequest {
    #[validate(length(min = 1, max = 255, message = "Trip name is required"))]
    pub name: String,
    pub description: Option<String>,
    pub destination: Option<String>,
    pub start_date: Option<chrono::NaiveDate>,
    pub end_date: Option<chrono::NaiveDate>,
    pub cover_image_url: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
pub struct TripRow {
    pub id: uuid::Uuid,
    pub name: String,
    pub description: Option<String>,
    pub destination: Option<String>,
    pub start_date: Option<chrono::NaiveDate>,
    pub end_date: Option<chrono::NaiveDate>,
    pub status: String,
    pub cover_image_url: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, sqlx::FromRow)]
pub struct TripWithMemberInfo {
    pub id: uuid::Uuid,
    pub name: String,
    pub description: Option<String>,
    pub destination: Option<String>,
    pub start_date: Option<chrono::NaiveDate>,
    pub end_date: Option<chrono::NaiveDate>,
    pub status: String,
    pub cover_image_url: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub role: String,
    pub member_count: i64,
}

#[derive(Debug, Serialize)]
pub struct TripResponse {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub destination: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub status: String,
    pub cover_image_url: Option<String>,
    pub role: String,
    pub member_count: i64,
    pub created_at: String,
}

impl TripResponse {
    pub fn from_row(row: TripWithMemberInfo) -> Self {
        Self {
            id: row.id.to_string(),
            name: row.name,
            description: row.description,
            destination: row.destination,
            start_date: row.start_date.map(|d| d.to_string()),
            end_date: row.end_date.map(|d| d.to_string()),
            status: row.status,
            cover_image_url: row.cover_image_url,
            role: row.role,
            member_count: row.member_count,
            created_at: row.created_at.to_rfc3339(),
        }
    }
}

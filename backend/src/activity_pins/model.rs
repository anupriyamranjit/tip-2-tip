use serde::{Deserialize, Serialize};
use validator::Validate;

#[derive(Debug, Deserialize, Validate)]
pub struct CreatePinRequest {
    #[validate(length(min = 1, max = 255, message = "Pin title is required"))]
    pub title: String,
    pub description: Option<String>,
    #[validate(range(min = -90.0, max = 90.0, message = "Latitude must be between -90 and 90"))]
    pub latitude: f64,
    #[validate(range(min = -180.0, max = 180.0, message = "Longitude must be between -180 and 180"))]
    pub longitude: f64,
    pub category: Option<String>,
    pub image_url: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdatePinRequest {
    #[validate(length(min = 1, max = 255, message = "Pin title cannot be empty"))]
    pub title: Option<String>,
    pub description: Option<String>,
    #[validate(range(min = -90.0, max = 90.0, message = "Latitude must be between -90 and 90"))]
    pub latitude: Option<f64>,
    #[validate(range(min = -180.0, max = 180.0, message = "Longitude must be between -180 and 180"))]
    pub longitude: Option<f64>,
    pub category: Option<String>,
    pub status: Option<String>,
    pub image_url: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
pub struct ActivityPinRow {
    pub id: uuid::Uuid,
    pub trip_id: uuid::Uuid,
    pub user_id: uuid::Uuid,
    pub title: String,
    pub description: Option<String>,
    pub latitude: f64,
    pub longitude: f64,
    pub category: String,
    pub status: String,
    pub image_url: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub username: String,
}

#[derive(Debug, Serialize)]
pub struct ActivityPinResponse {
    pub id: String,
    pub trip_id: String,
    pub user_id: String,
    pub title: String,
    pub description: Option<String>,
    pub latitude: f64,
    pub longitude: f64,
    pub category: String,
    pub status: String,
    pub image_url: Option<String>,
    pub created_by: String,
    pub created_at: String,
}

impl ActivityPinResponse {
    pub fn from_row(row: ActivityPinRow) -> Self {
        Self {
            id: row.id.to_string(),
            trip_id: row.trip_id.to_string(),
            user_id: row.user_id.to_string(),
            title: row.title,
            description: row.description,
            latitude: row.latitude,
            longitude: row.longitude,
            category: row.category,
            status: row.status,
            image_url: row.image_url,
            created_by: row.username,
            created_at: row.created_at.to_rfc3339(),
        }
    }
}

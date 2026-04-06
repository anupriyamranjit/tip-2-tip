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
    pub scheduled_at: Option<String>,
    pub price_cents: Option<i32>,
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
    pub scheduled_at: Option<String>,
    pub price_cents: Option<i32>,
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
    pub scheduled_at: Option<chrono::DateTime<chrono::Utc>>,
    pub price_cents: Option<i32>,
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
    pub scheduled_at: Option<String>,
    pub price_cents: Option<i32>,
    pub documents: Vec<PinDocumentResponse>,
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
            scheduled_at: row.scheduled_at.map(|dt| dt.to_rfc3339()),
            price_cents: row.price_cents,
            documents: vec![],
            created_by: row.username,
            created_at: row.created_at.to_rfc3339(),
        }
    }

    pub fn from_row_with_docs(row: ActivityPinRow, documents: Vec<PinDocumentResponse>) -> Self {
        let mut resp = Self::from_row(row);
        resp.documents = documents;
        resp
    }
}

#[derive(Debug, sqlx::FromRow)]
pub struct PinDocumentRow {
    pub id: uuid::Uuid,
    pub pin_id: uuid::Uuid,
    pub uploaded_by: uuid::Uuid,
    pub original_filename: String,
    pub stored_filename: String,
    pub mime_type: String,
    pub file_size_bytes: i64,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Clone)]
pub struct PinDocumentResponse {
    pub id: String,
    pub original_filename: String,
    pub mime_type: String,
    pub file_size_bytes: i64,
    pub download_url: String,
    pub created_at: String,
}

impl PinDocumentResponse {
    pub fn from_row(row: PinDocumentRow, trip_id: &str, pin_id: &str) -> Self {
        Self {
            id: row.id.to_string(),
            original_filename: row.original_filename,
            mime_type: row.mime_type,
            file_size_bytes: row.file_size_bytes,
            download_url: format!(
                "/api/v1/trips/{}/pins/{}/documents/{}",
                trip_id, pin_id, row.id
            ),
            created_at: row.created_at.to_rfc3339(),
        }
    }
}

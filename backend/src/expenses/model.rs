use serde::{Deserialize, Serialize};
use validator::Validate;

#[derive(Debug, Deserialize, Validate)]
pub struct CreateExpenseRequest {
    #[validate(length(min = 1, max = 255, message = "Expense title is required"))]
    pub title: String,
    #[validate(range(min = 0, message = "Amount must be non-negative"))]
    pub amount_cents: i32,
    pub category: Option<String>,
    pub split_type: Option<String>,
    pub notes: Option<String>,
    pub activity_pin_id: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateExpenseRequest {
    #[validate(length(min = 1, max = 255, message = "Expense title cannot be empty"))]
    pub title: Option<String>,
    #[validate(range(min = 0, message = "Amount must be non-negative"))]
    pub amount_cents: Option<i32>,
    pub category: Option<String>,
    pub split_type: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
pub struct ExpenseRow {
    pub id: uuid::Uuid,
    pub trip_id: uuid::Uuid,
    pub user_id: uuid::Uuid,
    pub activity_pin_id: Option<uuid::Uuid>,
    pub title: String,
    pub amount_cents: i32,
    pub category: String,
    pub split_type: String,
    pub notes: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub username: String,
}

#[derive(Debug, Serialize)]
pub struct ExpenseResponse {
    pub id: String,
    pub trip_id: String,
    pub user_id: String,
    pub activity_pin_id: Option<String>,
    pub title: String,
    pub amount_cents: i32,
    pub category: String,
    pub split_type: String,
    pub notes: Option<String>,
    pub created_by: String,
    pub created_at: String,
}

impl ExpenseResponse {
    pub fn from_row(row: ExpenseRow) -> Self {
        Self {
            id: row.id.to_string(),
            trip_id: row.trip_id.to_string(),
            user_id: row.user_id.to_string(),
            activity_pin_id: row.activity_pin_id.map(|id| id.to_string()),
            title: row.title,
            amount_cents: row.amount_cents,
            category: row.category,
            split_type: row.split_type,
            notes: row.notes,
            created_by: row.username,
            created_at: row.created_at.to_rfc3339(),
        }
    }
}

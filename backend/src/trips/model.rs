use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

// ---------------------------------------------------------------------------
// Database row types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Trip {
    pub id: Uuid,
    pub name: String,
    pub destination: String,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub cover_emoji: String,
    pub total_budget: Decimal,
    pub currency: String,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct TripMemberInfo {
    pub user_id: Uuid,
    pub name: String,
    pub avatar: String,
    pub color: String,
    pub role: String,
    pub joined_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Composite response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct TripWithMembers {
    #[serde(flatten)]
    pub trip: Trip,
    pub members: Vec<TripMemberInfo>,
    pub total_spent: Decimal,
}

// ---------------------------------------------------------------------------
// Request payloads
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize, Validate)]
pub struct CreateTrip {
    #[validate(length(min = 1, max = 200, message = "name must be between 1 and 200 characters"))]
    pub name: String,
    #[validate(length(min = 1, max = 200, message = "destination is required"))]
    pub destination: String,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub cover_emoji: Option<String>,
    pub total_budget: Option<Decimal>,
    pub currency: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateTrip {
    #[validate(length(min = 1, max = 200, message = "name must be between 1 and 200 characters"))]
    pub name: Option<String>,
    #[validate(length(min = 1, max = 200, message = "destination is required"))]
    pub destination: Option<String>,
    pub start_date: Option<NaiveDate>,
    pub end_date: Option<NaiveDate>,
    pub cover_emoji: Option<String>,
    pub total_budget: Option<Decimal>,
    pub currency: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct InviteRequest {
    pub email: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePreferences {
    pub travel_styles: Option<Vec<String>>,
    pub accommodation_types: Option<Vec<String>>,
    pub dietary_restrictions: Option<String>,
}

// ---------------------------------------------------------------------------
// Helper row used internally
// ---------------------------------------------------------------------------

#[derive(Debug, FromRow)]
pub struct MemberRole {
    pub role: String,
}

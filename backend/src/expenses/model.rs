use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Expense {
    pub id: Uuid,
    pub trip_id: Uuid,
    pub description: String,
    pub amount: Decimal,
    pub currency: String,
    pub paid_by: Uuid,
    pub category: String,
    pub date: NaiveDate,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct ExpenseWithSplits {
    #[serde(flatten)]
    pub expense: Expense,
    pub splits: Vec<ExpenseSplit>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct ExpenseSplit {
    pub expense_id: Uuid,
    pub user_id: Uuid,
    pub share: Decimal,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateExpense {
    #[validate(length(min = 1, max = 255, message = "Description must be between 1 and 255 characters"))]
    pub description: String,
    pub amount: Decimal,
    #[validate(length(min = 1, max = 10, message = "Currency code is required"))]
    pub currency: String,
    /// If omitted, defaults to the authenticated user.
    pub paid_by: Option<Uuid>,
    #[validate(length(min = 1, message = "Category is required"))]
    pub category: String,
    pub date: NaiveDate,
    /// User IDs to split the expense between. Must contain at least one member.
    #[validate(length(min = 1, message = "Must split between at least one member"))]
    pub split_between: Vec<Uuid>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateExpense {
    #[validate(length(min = 1, max = 255))]
    pub description: Option<String>,
    pub amount: Option<Decimal>,
    pub currency: Option<String>,
    pub paid_by: Option<Uuid>,
    pub category: Option<String>,
    pub date: Option<NaiveDate>,
    pub split_between: Option<Vec<Uuid>>,
}

#[derive(Debug, Serialize)]
pub struct ExpenseSummary {
    pub total: Decimal,
    pub by_category: Vec<CategoryTotal>,
}

#[derive(Debug, Serialize)]
pub struct CategoryTotal {
    pub category: String,
    pub total: Decimal,
    pub percentage: f64,
}

#[derive(Debug, Serialize)]
pub struct SimplifiedDebt {
    pub from: Uuid,
    pub to: Uuid,
    pub amount: Decimal,
}

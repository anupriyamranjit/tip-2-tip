use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use rust_decimal::Decimal;
use serde::Deserialize;
use uuid::Uuid;
use validator::Validate;

use crate::auth::middleware::{AppState, AuthUser};
use crate::error::{AppError, AppResult};

use super::model::{
    CategoryTotal, CreateExpense, Expense, ExpenseSplit, ExpenseSummary, ExpenseWithSplits,
    UpdateExpense,
};
use super::simplify::{self, ExpenseRow, SplitRow};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Verify the authenticated user is a member of the trip. Returns an error
/// with `Forbidden` if not.
async fn verify_trip_membership(
    pool: &sqlx::PgPool,
    trip_id: Uuid,
    user_id: Uuid,
) -> AppResult<()> {
    let is_member: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2)",
    )
    .bind(trip_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    if !is_member {
        return Err(AppError::Forbidden(
            "You are not a member of this trip".into(),
        ));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Query params
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct ListExpensesQuery {
    pub category: Option<String>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// POST /trips/:trip_id/expenses
pub async fn create_expense(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(trip_id): Path<Uuid>,
    Json(input): Json<CreateExpense>,
) -> AppResult<(StatusCode, Json<ExpenseWithSplits>)> {
    input
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    if input.amount <= Decimal::ZERO {
        return Err(AppError::Validation("Amount must be positive".into()));
    }

    verify_trip_membership(&state.pool, trip_id, auth_user.user_id).await?;

    let paid_by = input.paid_by.unwrap_or(auth_user.user_id);

    // Insert the expense.
    let expense = sqlx::query_as::<_, Expense>(
        r#"
        INSERT INTO expenses (trip_id, description, amount, currency, paid_by, category, date)
        VALUES ($1, $2, $3, $4, $5, $6::expense_category, $7)
        RETURNING id, trip_id, description, amount, currency, paid_by,
                  category::text AS category, date, created_at
        "#,
    )
    .bind(trip_id)
    .bind(&input.description)
    .bind(input.amount)
    .bind(&input.currency)
    .bind(paid_by)
    .bind(&input.category)
    .bind(input.date)
    .fetch_one(&state.pool)
    .await?;

    // Compute equal split shares.
    let num_members = Decimal::from(input.split_between.len() as u32);
    let share = input.amount / num_members;

    // Insert splits.
    let mut splits: Vec<ExpenseSplit> = Vec::with_capacity(input.split_between.len());
    for user_id in &input.split_between {
        let split = sqlx::query_as::<_, ExpenseSplit>(
            r#"
            INSERT INTO expense_splits (expense_id, user_id, share)
            VALUES ($1, $2, $3)
            RETURNING expense_id, user_id, share
            "#,
        )
        .bind(expense.id)
        .bind(user_id)
        .bind(share)
        .fetch_one(&state.pool)
        .await?;
        splits.push(split);
    }

    Ok((
        StatusCode::CREATED,
        Json(ExpenseWithSplits { expense, splits }),
    ))
}

/// GET /trips/:trip_id/expenses
pub async fn list_expenses(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(trip_id): Path<Uuid>,
    Query(params): Query<ListExpensesQuery>,
) -> AppResult<Json<Vec<Expense>>> {
    verify_trip_membership(&state.pool, trip_id, auth_user.user_id).await?;

    let expenses = match params.category {
        Some(ref cat) => {
            sqlx::query_as::<_, Expense>(
                r#"
                SELECT id, trip_id, description, amount, currency, paid_by,
                       category::text AS category, date, created_at
                FROM expenses
                WHERE trip_id = $1 AND category = $2::expense_category
                ORDER BY date DESC, created_at DESC
                "#,
            )
            .bind(trip_id)
            .bind(cat)
            .fetch_all(&state.pool)
            .await?
        }
        None => {
            sqlx::query_as::<_, Expense>(
                r#"
                SELECT id, trip_id, description, amount, currency, paid_by,
                       category::text AS category, date, created_at
                FROM expenses
                WHERE trip_id = $1
                ORDER BY date DESC, created_at DESC
                "#,
            )
            .bind(trip_id)
            .fetch_all(&state.pool)
            .await?
        }
    };

    Ok(Json(expenses))
}

/// GET /trips/:trip_id/expenses/:expense_id
pub async fn get_expense(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path((trip_id, expense_id)): Path<(Uuid, Uuid)>,
) -> AppResult<Json<ExpenseWithSplits>> {
    verify_trip_membership(&state.pool, trip_id, auth_user.user_id).await?;

    let expense = sqlx::query_as::<_, Expense>(
        r#"
        SELECT id, trip_id, description, amount, currency, paid_by,
               category::text AS category, date, created_at
        FROM expenses
        WHERE id = $1 AND trip_id = $2
        "#,
    )
    .bind(expense_id)
    .bind(trip_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Expense not found".into()))?;

    let splits = sqlx::query_as::<_, ExpenseSplit>(
        "SELECT expense_id, user_id, share FROM expense_splits WHERE expense_id = $1",
    )
    .bind(expense_id)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(ExpenseWithSplits { expense, splits }))
}

/// PUT /trips/:trip_id/expenses/:expense_id
pub async fn update_expense(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path((trip_id, expense_id)): Path<(Uuid, Uuid)>,
    Json(input): Json<UpdateExpense>,
) -> AppResult<Json<ExpenseWithSplits>> {
    input
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    if let Some(ref amt) = input.amount {
        if *amt <= Decimal::ZERO {
            return Err(AppError::Validation("Amount must be positive".into()));
        }
    }

    verify_trip_membership(&state.pool, trip_id, auth_user.user_id).await?;

    // Fetch existing expense to ensure it exists and belongs to the trip.
    let existing = sqlx::query_as::<_, Expense>(
        r#"
        SELECT id, trip_id, description, amount, currency, paid_by,
               category::text AS category, date, created_at
        FROM expenses
        WHERE id = $1 AND trip_id = $2
        "#,
    )
    .bind(expense_id)
    .bind(trip_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Expense not found".into()))?;

    let description = input.description.as_deref().unwrap_or(&existing.description);
    let amount = input.amount.unwrap_or(existing.amount);
    let currency = input.currency.as_deref().unwrap_or(&existing.currency);
    let paid_by = input.paid_by.unwrap_or(existing.paid_by);
    let category = input.category.as_deref().unwrap_or(&existing.category);
    let date = input.date.unwrap_or(existing.date);

    let expense = sqlx::query_as::<_, Expense>(
        r#"
        UPDATE expenses
        SET description = $1, amount = $2, currency = $3, paid_by = $4,
            category = $5::expense_category, date = $6
        WHERE id = $7 AND trip_id = $8
        RETURNING id, trip_id, description, amount, currency, paid_by,
                  category::text AS category, date, created_at
        "#,
    )
    .bind(description)
    .bind(amount)
    .bind(currency)
    .bind(paid_by)
    .bind(category)
    .bind(date)
    .bind(expense_id)
    .bind(trip_id)
    .fetch_one(&state.pool)
    .await?;

    // If split_between was provided, recompute splits.
    let splits = if let Some(ref members) = input.split_between {
        sqlx::query("DELETE FROM expense_splits WHERE expense_id = $1")
            .bind(expense_id)
            .execute(&state.pool)
            .await?;

        let num_members = Decimal::from(members.len() as u32);
        let share = amount / num_members;

        let mut new_splits = Vec::with_capacity(members.len());
        for user_id in members {
            let split = sqlx::query_as::<_, ExpenseSplit>(
                r#"
                INSERT INTO expense_splits (expense_id, user_id, share)
                VALUES ($1, $2, $3)
                RETURNING expense_id, user_id, share
                "#,
            )
            .bind(expense_id)
            .bind(user_id)
            .bind(share)
            .fetch_one(&state.pool)
            .await?;
            new_splits.push(split);
        }
        new_splits
    } else {
        sqlx::query_as::<_, ExpenseSplit>(
            "SELECT expense_id, user_id, share FROM expense_splits WHERE expense_id = $1",
        )
        .bind(expense_id)
        .fetch_all(&state.pool)
        .await?
    };

    Ok(Json(ExpenseWithSplits { expense, splits }))
}

/// DELETE /trips/:trip_id/expenses/:expense_id
pub async fn delete_expense(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path((trip_id, expense_id)): Path<(Uuid, Uuid)>,
) -> AppResult<StatusCode> {
    verify_trip_membership(&state.pool, trip_id, auth_user.user_id).await?;

    let result = sqlx::query("DELETE FROM expenses WHERE id = $1 AND trip_id = $2")
        .bind(expense_id)
        .bind(trip_id)
        .execute(&state.pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Expense not found".into()));
    }

    Ok(StatusCode::NO_CONTENT)
}

/// GET /trips/:trip_id/expenses/summary
pub async fn get_summary(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(trip_id): Path<Uuid>,
) -> AppResult<Json<ExpenseSummary>> {
    verify_trip_membership(&state.pool, trip_id, auth_user.user_id).await?;

    #[derive(sqlx::FromRow)]
    struct CatRow {
        category: String,
        total: Decimal,
    }

    let rows = sqlx::query_as::<_, CatRow>(
        r#"
        SELECT category::text AS category, COALESCE(SUM(amount), 0) AS total
        FROM expenses
        WHERE trip_id = $1
        GROUP BY category
        ORDER BY total DESC
        "#,
    )
    .bind(trip_id)
    .fetch_all(&state.pool)
    .await?;

    let total: Decimal = rows.iter().map(|r| r.total).sum();

    let by_category: Vec<CategoryTotal> = rows
        .into_iter()
        .map(|r| {
            let percentage = if total > Decimal::ZERO {
                // Convert to f64 for percentage calculation.
                let pct = (r.total * Decimal::from(100)) / total;
                pct.to_string().parse::<f64>().unwrap_or(0.0)
            } else {
                0.0
            };
            CategoryTotal {
                category: r.category,
                total: r.total,
                percentage,
            }
        })
        .collect();

    Ok(Json(ExpenseSummary { total, by_category }))
}

/// GET /trips/:trip_id/expenses/debts
pub async fn get_debts(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(trip_id): Path<Uuid>,
) -> AppResult<Json<Vec<super::model::SimplifiedDebt>>> {
    verify_trip_membership(&state.pool, trip_id, auth_user.user_id).await?;

    #[derive(sqlx::FromRow)]
    struct RawExpense {
        id: Uuid,
        paid_by: Uuid,
        amount: Decimal,
    }

    #[derive(sqlx::FromRow)]
    struct RawSplit {
        expense_id: Uuid,
        user_id: Uuid,
        share: Decimal,
    }

    let raw_expenses = sqlx::query_as::<_, RawExpense>(
        "SELECT id, paid_by, amount FROM expenses WHERE trip_id = $1",
    )
    .bind(trip_id)
    .fetch_all(&state.pool)
    .await?;

    let expense_ids: Vec<Uuid> = raw_expenses.iter().map(|e| e.id).collect();

    let raw_splits = if expense_ids.is_empty() {
        vec![]
    } else {
        sqlx::query_as::<_, RawSplit>(
            "SELECT expense_id, user_id, share FROM expense_splits WHERE expense_id = ANY($1)",
        )
        .bind(&expense_ids)
        .fetch_all(&state.pool)
        .await?
    };

    // Map to simplify module types.
    let expenses: Vec<ExpenseRow> = raw_expenses
        .into_iter()
        .map(|e| ExpenseRow {
            id: e.id,
            paid_by: e.paid_by,
            amount: e.amount,
        })
        .collect();

    let splits: Vec<SplitRow> = raw_splits
        .into_iter()
        .map(|s| SplitRow {
            expense_id: s.expense_id,
            user_id: s.user_id,
            share: s.share,
        })
        .collect();

    let debts = simplify::simplify_debts(&expenses, &splits);

    Ok(Json(debts))
}

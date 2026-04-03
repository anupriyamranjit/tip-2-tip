use axum::extract::{Path, State};
use axum::Json;
use std::collections::BTreeMap;
use uuid::Uuid;

use crate::auth::middleware::{AppState, AuthUser};
use crate::error::{AppError, AppResult};

use super::conflicts::detect_conflicts;
use super::model::*;

/// POST /trips/:trip_id/itinerary
pub async fn create_item(
    State(state): State<AppState>,
    Path(trip_id): Path<Uuid>,
    auth_user: AuthUser,
    Json(input): Json<CreateItem>,
) -> AppResult<Json<ItemWithConflicts>> {
    let status = input.status.as_deref().unwrap_or("proposed");
    let location = input.location.as_deref().unwrap_or("");

    let item = sqlx::query_as::<_, ItineraryItem>(
        r#"
        INSERT INTO itinerary_items
            (trip_id, day_date, start_time, end_time, title, location, category, status, notes, created_by, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7::itinerary_category, $8::itinerary_status, $9, $10,
                COALESCE((SELECT MAX(sort_order) + 1 FROM itinerary_items WHERE trip_id = $1 AND day_date = $2), 0))
        RETURNING id, trip_id, day_date, start_time, end_time, title, location,
                  category::text, status::text, notes, created_by, sort_order, created_at
        "#,
    )
    .bind(trip_id)
    .bind(input.day_date)
    .bind(input.start_time)
    .bind(input.end_time)
    .bind(&input.title)
    .bind(location)
    .bind(&input.category)
    .bind(status)
    .bind(&input.notes)
    .bind(auth_user.user_id)
    .fetch_one(&state.pool)
    .await?;

    let conflicts = detect_conflicts(
        &state.pool,
        trip_id,
        item.day_date,
        item.start_time,
        item.end_time,
        Some(item.id),
    )
    .await;

    Ok(Json(ItemWithConflicts { item, conflicts }))
}

/// GET /trips/:trip_id/itinerary
pub async fn list_items(
    State(state): State<AppState>,
    Path(trip_id): Path<Uuid>,
    _auth_user: AuthUser,
) -> AppResult<Json<Vec<DayGroup>>> {
    let items = sqlx::query_as::<_, ItineraryItem>(
        r#"
        SELECT id, trip_id, day_date, start_time, end_time, title, location,
               category::text, status::text, notes, created_by, sort_order, created_at
        FROM itinerary_items
        WHERE trip_id = $1
        ORDER BY day_date, sort_order, start_time
        "#,
    )
    .bind(trip_id)
    .fetch_all(&state.pool)
    .await?;

    // Group by day_date using BTreeMap to maintain date ordering.
    let mut groups: BTreeMap<chrono::NaiveDate, Vec<ItineraryItem>> = BTreeMap::new();
    for item in items {
        groups.entry(item.day_date).or_default().push(item);
    }

    let result: Vec<DayGroup> = groups
        .into_iter()
        .map(|(day_date, items)| DayGroup { day_date, items })
        .collect();

    Ok(Json(result))
}

/// GET /trips/:trip_id/itinerary/:id
pub async fn get_item(
    State(state): State<AppState>,
    Path((_trip_id, id)): Path<(Uuid, Uuid)>,
    _auth_user: AuthUser,
) -> AppResult<Json<ItineraryItem>> {
    let item = sqlx::query_as::<_, ItineraryItem>(
        r#"
        SELECT id, trip_id, day_date, start_time, end_time, title, location,
               category::text, status::text, notes, created_by, sort_order, created_at
        FROM itinerary_items
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Itinerary item not found".into()))?;

    Ok(Json(item))
}

/// PUT /trips/:trip_id/itinerary/:id
pub async fn update_item(
    State(state): State<AppState>,
    Path((trip_id, id)): Path<(Uuid, Uuid)>,
    _auth_user: AuthUser,
    Json(input): Json<UpdateItem>,
) -> AppResult<Json<ItemWithConflicts>> {
    let item = sqlx::query_as::<_, ItineraryItem>(
        r#"
        UPDATE itinerary_items
        SET day_date    = COALESCE($2, day_date),
            start_time  = COALESCE($3, start_time),
            end_time    = COALESCE($4, end_time),
            title       = COALESCE($5, title),
            location    = COALESCE($6, location),
            category    = COALESCE($7::itinerary_category, category),
            status      = COALESCE($8::itinerary_status, status),
            notes       = COALESCE($9, notes),
            sort_order  = COALESCE($10, sort_order)
        WHERE id = $1 AND trip_id = $11
        RETURNING id, trip_id, day_date, start_time, end_time, title, location,
                  category::text, status::text, notes, created_by, sort_order, created_at
        "#,
    )
    .bind(id)
    .bind(input.day_date)
    .bind(input.start_time)
    .bind(input.end_time)
    .bind(&input.title)
    .bind(&input.location)
    .bind(&input.category)
    .bind(&input.status)
    .bind(&input.notes)
    .bind(input.sort_order)
    .bind(trip_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Itinerary item not found".into()))?;

    let conflicts = detect_conflicts(
        &state.pool,
        trip_id,
        item.day_date,
        item.start_time,
        item.end_time,
        Some(item.id),
    )
    .await;

    Ok(Json(ItemWithConflicts { item, conflicts }))
}

/// DELETE /trips/:trip_id/itinerary/:id
pub async fn delete_item(
    State(state): State<AppState>,
    Path((_trip_id, id)): Path<(Uuid, Uuid)>,
    _auth_user: AuthUser,
) -> AppResult<Json<serde_json::Value>> {
    let result = sqlx::query("DELETE FROM itinerary_items WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Itinerary item not found".into()));
    }

    Ok(Json(serde_json::json!({ "deleted": true })))
}

/// PATCH /trips/:trip_id/itinerary/:id/status
pub async fn update_status(
    State(state): State<AppState>,
    Path((_trip_id, id)): Path<(Uuid, Uuid)>,
    _auth_user: AuthUser,
    Json(input): Json<StatusUpdate>,
) -> AppResult<Json<ItineraryItem>> {
    let item = sqlx::query_as::<_, ItineraryItem>(
        r#"
        UPDATE itinerary_items
        SET status = $2::itinerary_status
        WHERE id = $1
        RETURNING id, trip_id, day_date, start_time, end_time, title, location,
                  category::text, status::text, notes, created_by, sort_order, created_at
        "#,
    )
    .bind(id)
    .bind(&input.status)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Itinerary item not found".into()))?;

    Ok(Json(item))
}

/// POST /trips/:trip_id/itinerary/reorder
pub async fn reorder(
    State(state): State<AppState>,
    Path(trip_id): Path<Uuid>,
    _auth_user: AuthUser,
    Json(entries): Json<Vec<ReorderEntry>>,
) -> AppResult<Json<serde_json::Value>> {
    let mut tx = state.pool.begin().await?;

    for entry in &entries {
        sqlx::query(
            "UPDATE itinerary_items SET sort_order = $1 WHERE id = $2 AND trip_id = $3",
        )
        .bind(entry.sort_order)
        .bind(entry.id)
        .bind(trip_id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(Json(serde_json::json!({ "updated": entries.len() })))
}

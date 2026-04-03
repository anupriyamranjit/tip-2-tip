use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use rust_decimal::Decimal;
use uuid::Uuid;
use validator::Validate;

use crate::auth::middleware::{AppState, AuthUser};
use crate::error::{AppError, AppResult};

use super::model::*;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Return the member's role in a trip, or `Err(Forbidden)` if they are not a member.
async fn require_membership(
    pool: &sqlx::PgPool,
    trip_id: Uuid,
    user_id: Uuid,
) -> AppResult<String> {
    let row: Option<MemberRole> = sqlx::query_as::<_, MemberRole>(
        "SELECT role::text AS role FROM trip_members WHERE trip_id = $1 AND user_id = $2",
    )
    .bind(trip_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    match row {
        Some(r) => Ok(r.role),
        None => Err(AppError::Forbidden(
            "You are not a member of this trip".into(),
        )),
    }
}

fn require_organizer(role: &str) -> AppResult<()> {
    if role != "organizer" {
        return Err(AppError::Forbidden(
            "Only the organizer can perform this action".into(),
        ));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// POST /  — create trip
// ---------------------------------------------------------------------------

pub async fn create_trip(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateTrip>,
) -> AppResult<(StatusCode, Json<Trip>)> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    if body.end_date < body.start_date {
        return Err(AppError::Validation(
            "end_date must be on or after start_date".into(),
        ));
    }

    let cover_emoji = body.cover_emoji.unwrap_or_default();
    let total_budget = body.total_budget.unwrap_or_else(|| Decimal::new(0, 0));
    let currency = body.currency.unwrap_or_else(|| "CAD".into());

    let trip = sqlx::query_as::<_, Trip>(
        r#"
        INSERT INTO trips (name, destination, start_date, end_date, cover_emoji, total_budget, currency, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        "#,
    )
    .bind(&body.name)
    .bind(&body.destination)
    .bind(body.start_date)
    .bind(body.end_date)
    .bind(&cover_emoji)
    .bind(total_budget)
    .bind(&currency)
    .bind(auth.user_id)
    .fetch_one(&state.pool)
    .await?;

    // Add creator as organizer
    sqlx::query(
        "INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1, $2, 'organizer')",
    )
    .bind(trip.id)
    .bind(auth.user_id)
    .execute(&state.pool)
    .await?;

    Ok((StatusCode::CREATED, Json(trip)))
}

// ---------------------------------------------------------------------------
// GET /  — list trips for current user
// ---------------------------------------------------------------------------

pub async fn list_trips(
    State(state): State<AppState>,
    auth: AuthUser,
) -> AppResult<Json<Vec<Trip>>> {
    let trips = sqlx::query_as::<_, Trip>(
        r#"
        SELECT t.*
        FROM trips t
        JOIN trip_members tm ON tm.trip_id = t.id
        WHERE tm.user_id = $1
        ORDER BY t.start_date DESC
        "#,
    )
    .bind(auth.user_id)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(trips))
}

// ---------------------------------------------------------------------------
// GET /:trip_id  — get trip with members + budget summary
// ---------------------------------------------------------------------------

pub async fn get_trip(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(trip_id): Path<Uuid>,
) -> AppResult<Json<TripWithMembers>> {
    require_membership(&state.pool, trip_id, auth.user_id).await?;

    let trip = sqlx::query_as::<_, Trip>("SELECT * FROM trips WHERE id = $1")
        .bind(trip_id)
        .fetch_optional(&state.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Trip not found".into()))?;

    let members = sqlx::query_as::<_, TripMemberInfo>(
        r#"
        SELECT u.id AS user_id, u.name, u.avatar, u.color,
               tm.role::text AS role, tm.joined_at
        FROM trip_members tm
        JOIN users u ON u.id = tm.user_id
        WHERE tm.trip_id = $1
        ORDER BY tm.joined_at
        "#,
    )
    .bind(trip_id)
    .fetch_all(&state.pool)
    .await?;

    #[derive(sqlx::FromRow)]
    struct Sum {
        total: Option<Decimal>,
    }

    let total_spent = sqlx::query_as::<_, Sum>(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE trip_id = $1",
    )
    .bind(trip_id)
    .fetch_one(&state.pool)
    .await?
    .total
    .unwrap_or_else(|| Decimal::new(0, 0));

    Ok(Json(TripWithMembers {
        trip,
        members,
        total_spent,
    }))
}

// ---------------------------------------------------------------------------
// PUT /:trip_id  — update trip (organizer only)
// ---------------------------------------------------------------------------

pub async fn update_trip(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(trip_id): Path<Uuid>,
    Json(body): Json<UpdateTrip>,
) -> AppResult<Json<Trip>> {
    body.validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    let role = require_membership(&state.pool, trip_id, auth.user_id).await?;
    require_organizer(&role)?;

    let trip = sqlx::query_as::<_, Trip>(
        r#"
        UPDATE trips
        SET name         = COALESCE($1, name),
            destination  = COALESCE($2, destination),
            start_date   = COALESCE($3, start_date),
            end_date     = COALESCE($4, end_date),
            cover_emoji  = COALESCE($5, cover_emoji),
            total_budget = COALESCE($6, total_budget),
            currency     = COALESCE($7, currency)
        WHERE id = $8
        RETURNING *
        "#,
    )
    .bind(&body.name)
    .bind(&body.destination)
    .bind(body.start_date)
    .bind(body.end_date)
    .bind(&body.cover_emoji)
    .bind(body.total_budget)
    .bind(body.currency.as_deref())
    .bind(trip_id)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(trip))
}

// ---------------------------------------------------------------------------
// DELETE /:trip_id  — delete trip (organizer only)
// ---------------------------------------------------------------------------

pub async fn delete_trip(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(trip_id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let role = require_membership(&state.pool, trip_id, auth.user_id).await?;
    require_organizer(&role)?;

    let result = sqlx::query("DELETE FROM trips WHERE id = $1")
        .bind(trip_id)
        .execute(&state.pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Trip not found".into()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// POST /:trip_id/invite  — invite member by email
// ---------------------------------------------------------------------------

pub async fn invite_member(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(trip_id): Path<Uuid>,
    Json(body): Json<InviteRequest>,
) -> AppResult<StatusCode> {
    require_membership(&state.pool, trip_id, auth.user_id).await?;

    sqlx::query(
        r#"
        INSERT INTO trip_invites (trip_id, email, invited_by)
        VALUES ($1, $2, $3)
        ON CONFLICT (trip_id, email) DO NOTHING
        "#,
    )
    .bind(trip_id)
    .bind(&body.email)
    .bind(auth.user_id)
    .execute(&state.pool)
    .await?;

    Ok(StatusCode::CREATED)
}

// ---------------------------------------------------------------------------
// GET /:trip_id/members
// ---------------------------------------------------------------------------

pub async fn list_members(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(trip_id): Path<Uuid>,
) -> AppResult<Json<Vec<TripMemberInfo>>> {
    require_membership(&state.pool, trip_id, auth.user_id).await?;

    let members = sqlx::query_as::<_, TripMemberInfo>(
        r#"
        SELECT u.id AS user_id, u.name, u.avatar, u.color,
               tm.role::text AS role, tm.joined_at
        FROM trip_members tm
        JOIN users u ON u.id = tm.user_id
        WHERE tm.trip_id = $1
        ORDER BY tm.joined_at
        "#,
    )
    .bind(trip_id)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(members))
}

// ---------------------------------------------------------------------------
// DELETE /:trip_id/members/:user_id  — remove member (organizer only)
// ---------------------------------------------------------------------------

pub async fn remove_member(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((trip_id, target_user_id)): Path<(Uuid, Uuid)>,
) -> AppResult<StatusCode> {
    let role = require_membership(&state.pool, trip_id, auth.user_id).await?;
    require_organizer(&role)?;

    if target_user_id == auth.user_id {
        return Err(AppError::Validation(
            "Organizer cannot remove themselves".into(),
        ));
    }

    let result =
        sqlx::query("DELETE FROM trip_members WHERE trip_id = $1 AND user_id = $2")
            .bind(trip_id)
            .bind(target_user_id)
            .execute(&state.pool)
            .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Member not found".into()));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// PUT /:trip_id/preferences  — upsert preferences for current user
// ---------------------------------------------------------------------------

pub async fn update_preferences(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(trip_id): Path<Uuid>,
    Json(body): Json<UpdatePreferences>,
) -> AppResult<StatusCode> {
    require_membership(&state.pool, trip_id, auth.user_id).await?;

    sqlx::query(
        r#"
        INSERT INTO trip_preferences (trip_id, user_id, travel_styles, accommodation_types, dietary_restrictions)
        VALUES ($1, $2,
                COALESCE($3, '{}'::text[]),
                COALESCE($4, '{}'::text[]),
                $5)
        ON CONFLICT (trip_id, user_id) DO UPDATE
        SET travel_styles        = COALESCE($3, trip_preferences.travel_styles),
            accommodation_types  = COALESCE($4, trip_preferences.accommodation_types),
            dietary_restrictions = COALESCE($5, trip_preferences.dietary_restrictions)
        "#,
    )
    .bind(trip_id)
    .bind(auth.user_id)
    .bind(&body.travel_styles)
    .bind(&body.accommodation_types)
    .bind(&body.dietary_restrictions)
    .execute(&state.pool)
    .await?;

    Ok(StatusCode::OK)
}

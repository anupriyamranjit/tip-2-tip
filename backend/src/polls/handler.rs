use axum::extract::{Path, State};
use axum::Json;
use uuid::Uuid;

use crate::auth::middleware::{AppState, AuthUser};
use crate::error::{AppError, AppResult};

use super::model::*;

/// POST /trips/:trip_id/polls
pub async fn create_poll(
    State(state): State<AppState>,
    Path(trip_id): Path<Uuid>,
    auth_user: AuthUser,
    Json(input): Json<CreatePoll>,
) -> AppResult<Json<PollWithResults>> {
    if input.options.len() < 2 {
        return Err(AppError::Validation(
            "A poll must have at least 2 options".into(),
        ));
    }

    let mut tx = state.pool.begin().await?;

    let poll = sqlx::query_as::<_, Poll>(
        r#"
        INSERT INTO polls (trip_id, question, created_by)
        VALUES ($1, $2, $3)
        RETURNING id, trip_id, question, created_by, is_closed, created_at
        "#,
    )
    .bind(trip_id)
    .bind(&input.question)
    .bind(auth_user.user_id)
    .fetch_one(&mut *tx)
    .await?;

    let mut options = Vec::with_capacity(input.options.len());
    for (i, label) in input.options.iter().enumerate() {
        let opt = sqlx::query_as::<_, PollOption>(
            r#"
            INSERT INTO poll_options (poll_id, label, sort_order)
            VALUES ($1, $2, $3)
            RETURNING id, poll_id, label, sort_order
            "#,
        )
        .bind(poll.id)
        .bind(label)
        .bind(i as i32)
        .fetch_one(&mut *tx)
        .await?;
        options.push(opt);
    }

    tx.commit().await?;

    let results = options
        .into_iter()
        .map(|option| OptionWithVotes {
            option,
            score: 0,
            user_voted: None,
        })
        .collect();

    Ok(Json(PollWithResults {
        poll,
        options: results,
    }))
}

/// GET /trips/:trip_id/polls
pub async fn list_polls(
    State(state): State<AppState>,
    Path(trip_id): Path<Uuid>,
    _auth_user: AuthUser,
) -> AppResult<Json<Vec<Poll>>> {
    let polls = sqlx::query_as::<_, Poll>(
        r#"
        SELECT id, trip_id, question, created_by, is_closed, created_at
        FROM polls
        WHERE trip_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(trip_id)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(polls))
}

/// GET /trips/:trip_id/polls/:id
pub async fn get_poll(
    State(state): State<AppState>,
    Path((_trip_id, id)): Path<(Uuid, Uuid)>,
    auth_user: AuthUser,
) -> AppResult<Json<PollWithResults>> {
    let poll = sqlx::query_as::<_, Poll>(
        r#"
        SELECT id, trip_id, question, created_by, is_closed, created_at
        FROM polls
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Poll not found".into()))?;

    // Fetch options with tallied scores and the current user's vote.
    let rows = sqlx::query_as::<_, (Uuid, Uuid, String, i32, i64, Option<i16>)>(
        r#"
        SELECT
            po.id,
            po.poll_id,
            po.label,
            po.sort_order,
            COALESCE(SUM(pv.value), 0) AS score,
            (SELECT pv2.value FROM poll_votes pv2 WHERE pv2.poll_option_id = po.id AND pv2.user_id = $2)
        FROM poll_options po
        LEFT JOIN poll_votes pv ON pv.poll_option_id = po.id
        WHERE po.poll_id = $1
        GROUP BY po.id, po.poll_id, po.label, po.sort_order
        ORDER BY po.sort_order
        "#,
    )
    .bind(id)
    .bind(auth_user.user_id)
    .fetch_all(&state.pool)
    .await?;

    let options = rows
        .into_iter()
        .map(|(opt_id, poll_id, label, sort_order, score, user_voted)| OptionWithVotes {
            option: PollOption {
                id: opt_id,
                poll_id,
                label,
                sort_order,
            },
            score,
            user_voted,
        })
        .collect();

    Ok(Json(PollWithResults { poll, options }))
}

/// POST /trips/:trip_id/polls/:id/vote
pub async fn cast_vote(
    State(state): State<AppState>,
    Path((_trip_id, id)): Path<(Uuid, Uuid)>,
    auth_user: AuthUser,
    Json(input): Json<CastVote>,
) -> AppResult<Json<serde_json::Value>> {
    if input.value != -1 && input.value != 1 {
        return Err(AppError::Validation(
            "Vote value must be -1 or 1".into(),
        ));
    }

    // Verify the poll is not closed.
    let poll = sqlx::query_as::<_, Poll>(
        r#"
        SELECT id, trip_id, question, created_by, is_closed, created_at
        FROM polls
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Poll not found".into()))?;

    if poll.is_closed {
        return Err(AppError::Validation("Poll is closed".into()));
    }

    // Verify the option belongs to this poll.
    let option_exists = sqlx::query_as::<_, (bool,)>(
        "SELECT EXISTS(SELECT 1 FROM poll_options WHERE id = $1 AND poll_id = $2)",
    )
    .bind(input.option_id)
    .bind(id)
    .fetch_one(&state.pool)
    .await?;

    if !option_exists.0 {
        return Err(AppError::Validation(
            "Option does not belong to this poll".into(),
        ));
    }

    // Upsert vote.
    sqlx::query(
        r#"
        INSERT INTO poll_votes (poll_option_id, user_id, value)
        VALUES ($1, $2, $3)
        ON CONFLICT (poll_option_id, user_id)
        DO UPDATE SET value = $3, voted_at = now()
        "#,
    )
    .bind(input.option_id)
    .bind(auth_user.user_id)
    .bind(input.value)
    .execute(&state.pool)
    .await?;

    Ok(Json(serde_json::json!({ "voted": true })))
}

/// PATCH /trips/:trip_id/polls/:id/close
pub async fn close_poll(
    State(state): State<AppState>,
    Path((_trip_id, id)): Path<(Uuid, Uuid)>,
    auth_user: AuthUser,
) -> AppResult<Json<Poll>> {
    // Only the poll creator can close it.
    let poll = sqlx::query_as::<_, Poll>(
        r#"
        SELECT id, trip_id, question, created_by, is_closed, created_at
        FROM polls
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Poll not found".into()))?;

    if poll.created_by != auth_user.user_id {
        return Err(AppError::Forbidden(
            "Only the poll creator can close it".into(),
        ));
    }

    let updated = sqlx::query_as::<_, Poll>(
        r#"
        UPDATE polls
        SET is_closed = true
        WHERE id = $1
        RETURNING id, trip_id, question, created_by, is_closed, created_at
        "#,
    )
    .bind(id)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(updated))
}

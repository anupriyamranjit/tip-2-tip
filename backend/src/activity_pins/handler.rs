use axum::{
    extract::{Multipart, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde_json::json;
use std::collections::HashMap;
use validator::Validate;

use crate::auth::{AppState, AuthUser};
use crate::common::PaginationParams;
use crate::realtime::TripEvent;
use super::model::*;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/{trip_id}/pins", post(create_pin).get(list_pins))
        .route("/{trip_id}/pins/{pin_id}", get(get_pin).put(update_pin).delete(delete_pin))
        .route("/{trip_id}/pins/{pin_id}/vote", post(vote_pin).delete(delete_vote))
        .route("/{trip_id}/pins/{pin_id}/documents", post(upload_document).get(list_documents))
        .route("/{trip_id}/pins/{pin_id}/documents/{doc_id}", get(download_document).delete(delete_document))
        .route("/{trip_id}/ws", get(super::ws::ws_handler))
}

use crate::common::{verify_trip_member, can_modify_resource};

/// Fetches documents for a list of pin IDs, grouped by pin_id.
async fn fetch_documents_for_pins(
    pool: &sqlx::PgPool,
    pin_ids: &[uuid::Uuid],
    trip_id: &str,
) -> Result<HashMap<uuid::Uuid, Vec<PinDocumentResponse>>, sqlx::Error> {
    if pin_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let docs = sqlx::query_as::<_, PinDocumentRow>(
        "SELECT * FROM pin_documents WHERE pin_id = ANY($1) ORDER BY created_at DESC",
    )
    .bind(pin_ids)
    .fetch_all(pool)
    .await?;

    let mut map: HashMap<uuid::Uuid, Vec<PinDocumentResponse>> = HashMap::new();
    for doc in docs {
        let pin_id_str = doc.pin_id.to_string();
        let pin_id = doc.pin_id;
        let resp = PinDocumentResponse::from_row(doc, trip_id, &pin_id_str);
        map.entry(pin_id).or_default().push(resp);
    }

    Ok(map)
}

/// Fetches vote summaries for a list of pins, including the current user's vote.
/// Uses a single query with conditional aggregation for efficiency.
async fn fetch_votes_for_pins(
    pool: &sqlx::PgPool,
    pin_ids: &[uuid::Uuid],
    current_user_id: uuid::Uuid,
) -> Result<HashMap<uuid::Uuid, PinVoteSummary>, sqlx::Error> {
    if pin_ids.is_empty() {
        return Ok(HashMap::new());
    }

    // Single query: aggregate votes and get current user's vote via conditional aggregation
    let rows = sqlx::query_as::<_, (uuid::Uuid, i64, i64, i16)>(
        "SELECT pin_id, \
         COALESCE(SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END), 0) as upvotes, \
         COALESCE(SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END), 0) as downvotes, \
         COALESCE(MAX(CASE WHEN user_id = $2 THEN vote ELSE NULL END), 0)::smallint as user_vote \
         FROM pin_votes WHERE pin_id = ANY($1) GROUP BY pin_id",
    )
    .bind(pin_ids)
    .bind(current_user_id)
    .fetch_all(pool)
    .await?;

    let mut map: HashMap<uuid::Uuid, PinVoteSummary> = HashMap::new();
    for (pin_id, upvotes, downvotes, user_vote) in rows {
        map.insert(pin_id, PinVoteSummary {
            upvotes,
            downvotes,
            score: upvotes - downvotes,
            user_vote,
        });
    }

    // Ensure all requested pins have a summary (even if 0 votes)
    for pid in pin_ids {
        map.entry(*pid).or_insert_with(|| PinVoteSummary::default());
    }

    Ok(map)
}

async fn create_pin(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(trip_id): Path<uuid::Uuid>,
    Json(body): Json<CreatePinRequest>,
) -> impl IntoResponse {
    if let Err(errors) = body.validate() {
        return crate::common::validation_error(errors);
    }

    if let Err(resp) = verify_trip_member(&state.pool, trip_id, auth_user.user_id).await {
        return resp;
    }

    let category = body.category.unwrap_or_else(|| "general".to_string());

    // Parse scheduled_at if provided
    let scheduled_at = match &body.scheduled_at {
        Some(s) => match chrono::DateTime::parse_from_rfc3339(s) {
            Ok(dt) => Some(dt.with_timezone(&chrono::Utc)),
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "Invalid scheduled_at format. Use RFC3339 (e.g. 2024-06-15T10:30:00Z)" })),
                );
            }
        },
        None => None,
    };

    let insert_result = sqlx::query_scalar::<_, uuid::Uuid>(
        "INSERT INTO activity_pins (trip_id, user_id, title, description, latitude, longitude, category, image_url, scheduled_at, price_cents) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) \
         RETURNING id",
    )
    .bind(trip_id)
    .bind(auth_user.user_id)
    .bind(&body.title)
    .bind(&body.description)
    .bind(body.latitude)
    .bind(body.longitude)
    .bind(&category)
    .bind(&body.image_url)
    .bind(scheduled_at)
    .bind(body.price_cents)
    .fetch_one(&state.pool)
    .await;

    match insert_result {
        Ok(pin_id) => {
            let row = sqlx::query_as::<_, ActivityPinRow>(
                "SELECT p.*, u.username FROM activity_pins p \
                 JOIN users u ON p.user_id = u.id \
                 WHERE p.id = $1",
            )
            .bind(pin_id)
            .fetch_one(&state.pool)
            .await;

            match row {
                Ok(r) => {
                    // Broadcast real-time event
                    state.broadcaster.broadcast(trip_id, TripEvent {
                        event_type: "pin_created".to_string(),
                        pin_id: r.id.to_string(),
                        triggered_by: r.username.clone(),
                    }).await;

                    (StatusCode::CREATED, Json(json!(ActivityPinResponse::from_row(r, PinVoteSummary::default()))))
                }
                Err(_) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": "Something went wrong" })),
                ),
            }
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Something went wrong" })),
        ),
    }
}

async fn list_pins(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(trip_id): Path<uuid::Uuid>,
    Query(pagination): Query<PaginationParams>,
) -> impl IntoResponse {
    if let Err(resp) = verify_trip_member(&state.pool, trip_id, auth_user.user_id).await {
        return resp;
    }

    let limit = pagination.limit();
    let offset = pagination.offset();

    let pins = sqlx::query_as::<_, ActivityPinRow>(
        "SELECT p.*, u.username FROM activity_pins p \
         JOIN users u ON p.user_id = u.id \
         WHERE p.trip_id = $1 \
         ORDER BY p.created_at DESC \
         LIMIT $2 OFFSET $3",
    )
    .bind(trip_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.pool)
    .await;

    match pins {
        Ok(rows) => {
            let pin_ids: Vec<uuid::Uuid> = rows.iter().map(|r| r.id).collect();
            let trip_id_str = trip_id.to_string();

            let (docs_result, votes_result) = tokio::join!(
                fetch_documents_for_pins(&state.pool, &pin_ids, &trip_id_str),
                fetch_votes_for_pins(&state.pool, &pin_ids, auth_user.user_id)
            );

            match (docs_result, votes_result) {
                (Ok(mut docs), Ok(mut votes)) => {
                    let pins: Vec<ActivityPinResponse> = rows
                        .into_iter()
                        .map(|row| {
                            let pin_docs = docs.remove(&row.id).unwrap_or_default();
                            let pin_votes = votes.remove(&row.id).unwrap_or_default();
                            ActivityPinResponse::from_row_with_docs(row, pin_docs, pin_votes)
                        })
                        .collect();
                    (StatusCode::OK, Json(json!({ "pins": pins })))
                }
                _ => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": "Something went wrong" })),
                ),
            }
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Something went wrong" })),
        ),
    }
}

async fn get_pin(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path((trip_id, pin_id)): Path<(uuid::Uuid, uuid::Uuid)>,
) -> impl IntoResponse {
    if let Err(resp) = verify_trip_member(&state.pool, trip_id, auth_user.user_id).await {
        return resp;
    }

    let pin = sqlx::query_as::<_, ActivityPinRow>(
        "SELECT p.*, u.username FROM activity_pins p \
         JOIN users u ON p.user_id = u.id \
         WHERE p.id = $1 AND p.trip_id = $2",
    )
    .bind(pin_id)
    .bind(trip_id)
    .fetch_optional(&state.pool)
    .await;

    match pin {
        Ok(Some(row)) => {
            let trip_id_str = trip_id.to_string();
            let pin_ids = [pin_id];
            let (docs, votes) = tokio::join!(
                fetch_documents_for_pins(&state.pool, &pin_ids, &trip_id_str),
                fetch_votes_for_pins(&state.pool, &pin_ids, auth_user.user_id)
            );
            match (docs, votes) {
                (Ok(mut doc_map), Ok(mut vote_map)) => {
                    let pin_docs = doc_map.remove(&pin_id).unwrap_or_default();
                    let pin_votes = vote_map.remove(&pin_id).unwrap_or_default();
                    (StatusCode::OK, Json(json!(ActivityPinResponse::from_row_with_docs(row, pin_docs, pin_votes))))
                }
                _ => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": "Something went wrong" })),
                ),
            }
        }
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Pin not found" })),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Something went wrong" })),
        ),
    }
}

async fn update_pin(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path((trip_id, pin_id)): Path<(uuid::Uuid, uuid::Uuid)>,
    Json(body): Json<UpdatePinRequest>,
) -> impl IntoResponse {
    if let Err(errors) = body.validate() {
        return crate::common::validation_error(errors);
    }

    if let Err(resp) = verify_trip_member(&state.pool, trip_id, auth_user.user_id).await {
        return resp;
    }

    // Fetch the pin to check ownership
    let existing = sqlx::query_scalar::<_, uuid::Uuid>(
        "SELECT user_id FROM activity_pins WHERE id = $1 AND trip_id = $2",
    )
    .bind(pin_id)
    .bind(trip_id)
    .fetch_optional(&state.pool)
    .await;

    let pin_owner_id = match existing {
        Ok(Some(uid)) => uid,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Pin not found" })),
            )
        }
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Something went wrong" })),
            )
        }
    };

    let can_modify = can_modify_resource(&state.pool, pin_owner_id, trip_id, auth_user.user_id).await;
    match can_modify {
        Ok(true) => {}
        Ok(false) => {
            return (
                StatusCode::FORBIDDEN,
                Json(json!({ "error": "Only the pin creator or trip owner can modify this pin" })),
            )
        }
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Something went wrong" })),
            )
        }
    }

    // Parse scheduled_at if provided
    let scheduled_at = match &body.scheduled_at {
        Some(s) => match chrono::DateTime::parse_from_rfc3339(s) {
            Ok(dt) => Some(Some(dt.with_timezone(&chrono::Utc))),
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "Invalid scheduled_at format. Use RFC3339 (e.g. 2024-06-15T10:30:00Z)" })),
                );
            }
        },
        None => None,
    };

    let result = sqlx::query_as::<_, ActivityPinRow>(
        "UPDATE activity_pins SET \
         title = COALESCE($1, title), \
         description = COALESCE($2, description), \
         latitude = COALESCE($3, latitude), \
         longitude = COALESCE($4, longitude), \
         category = COALESCE($5, category), \
         status = COALESCE($6, status), \
         image_url = COALESCE($7, image_url), \
         scheduled_at = CASE WHEN $8 THEN $9 ELSE scheduled_at END, \
         price_cents = COALESCE($10, price_cents), \
         updated_at = NOW() \
         WHERE id = $11 AND trip_id = $12 \
         RETURNING *, (SELECT username FROM users WHERE id = activity_pins.user_id) as username",
    )
    .bind(&body.title)
    .bind(&body.description)
    .bind(body.latitude)
    .bind(body.longitude)
    .bind(&body.category)
    .bind(&body.status)
    .bind(&body.image_url)
    .bind(scheduled_at.is_some()) // $8: whether to update scheduled_at
    .bind(scheduled_at.flatten()) // $9: new scheduled_at value (may be None)
    .bind(body.price_cents)
    .bind(pin_id)
    .bind(trip_id)
    .fetch_one(&state.pool)
    .await;

    match result {
        Ok(row) => {
            // Fetch current votes for this pin
            let votes = fetch_votes_for_pins(&state.pool, &[row.id], auth_user.user_id)
                .await
                .ok()
                .and_then(|mut m| m.remove(&pin_id))
                .unwrap_or_default();

            // Broadcast real-time event
            state.broadcaster.broadcast(trip_id, TripEvent {
                event_type: "pin_updated".to_string(),
                pin_id: row.id.to_string(),
                triggered_by: row.username.clone(),
            }).await;

            (StatusCode::OK, Json(json!(ActivityPinResponse::from_row(row, votes))))
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Something went wrong" })),
        ),
    }
}

/// Cast or change a vote on a pin. Upserting ensures one vote per user per pin.
async fn vote_pin(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path((trip_id, pin_id)): Path<(uuid::Uuid, uuid::Uuid)>,
    Json(body): Json<VoteRequest>,
) -> impl IntoResponse {
    if body.vote != 1 && body.vote != -1 {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "Vote must be 1 (upvote) or -1 (downvote)" })),
        );
    }

    if let Err(resp) = verify_trip_member(&state.pool, trip_id, auth_user.user_id).await {
        return resp;
    }

    // Verify pin exists in this trip
    let pin_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM activity_pins WHERE id = $1 AND trip_id = $2)",
    )
    .bind(pin_id)
    .bind(trip_id)
    .fetch_one(&state.pool)
    .await;

    match pin_exists {
        Ok(false) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Pin not found" })),
            );
        }
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Something went wrong" })),
            );
        }
        _ => {}
    }

    // Upsert: insert or update the vote
    let result = sqlx::query(
        "INSERT INTO pin_votes (pin_id, user_id, vote) \
         VALUES ($1, $2, $3) \
         ON CONFLICT (pin_id, user_id) DO UPDATE SET vote = $3",
    )
    .bind(pin_id)
    .bind(auth_user.user_id)
    .bind(body.vote)
    .execute(&state.pool)
    .await;

    match result {
        Ok(_) => {
            // Fetch updated vote summary
            let votes = fetch_votes_for_pins(&state.pool, &[pin_id], auth_user.user_id)
                .await
                .ok()
                .and_then(|mut m| m.remove(&pin_id))
                .unwrap_or_default();

            // Broadcast so other users see the vote change in real-time
            state.broadcaster.broadcast(trip_id, TripEvent {
                event_type: "pin_voted".to_string(),
                pin_id: pin_id.to_string(),
                triggered_by: String::new(),
            }).await;

            (StatusCode::OK, Json(json!(votes)))
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Something went wrong" })),
        ),
    }
}

/// Remove the current user's vote from a pin.
async fn delete_vote(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path((trip_id, pin_id)): Path<(uuid::Uuid, uuid::Uuid)>,
) -> impl IntoResponse {
    if let Err(resp) = verify_trip_member(&state.pool, trip_id, auth_user.user_id).await {
        return resp;
    }

    let result = sqlx::query(
        "DELETE FROM pin_votes WHERE pin_id = $1 AND user_id = $2",
    )
    .bind(pin_id)
    .bind(auth_user.user_id)
    .execute(&state.pool)
    .await;

    match result {
        Ok(_) => {
            let votes = fetch_votes_for_pins(&state.pool, &[pin_id], auth_user.user_id)
                .await
                .ok()
                .and_then(|mut m| m.remove(&pin_id))
                .unwrap_or_default();

            state.broadcaster.broadcast(trip_id, TripEvent {
                event_type: "pin_voted".to_string(),
                pin_id: pin_id.to_string(),
                triggered_by: String::new(),
            }).await;

            (StatusCode::OK, Json(json!(votes)))
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Something went wrong" })),
        ),
    }
}

async fn delete_pin(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path((trip_id, pin_id)): Path<(uuid::Uuid, uuid::Uuid)>,
) -> impl IntoResponse {
    if let Err(resp) = verify_trip_member(&state.pool, trip_id, auth_user.user_id).await {
        return resp;
    }

    let existing = sqlx::query_scalar::<_, uuid::Uuid>(
        "SELECT user_id FROM activity_pins WHERE id = $1 AND trip_id = $2",
    )
    .bind(pin_id)
    .bind(trip_id)
    .fetch_optional(&state.pool)
    .await;

    let pin_owner_id = match existing {
        Ok(Some(uid)) => uid,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Pin not found" })),
            )
        }
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Something went wrong" })),
            )
        }
    };

    let can_modify = can_modify_resource(&state.pool, pin_owner_id, trip_id, auth_user.user_id).await;
    match can_modify {
        Ok(true) => {}
        Ok(false) => {
            return (
                StatusCode::FORBIDDEN,
                Json(json!({ "error": "Only the pin creator or trip owner can delete this pin" })),
            )
        }
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Something went wrong" })),
            )
        }
    }

    // Delete associated files from disk (only fetch filenames needed for cleanup)
    let filenames = sqlx::query_scalar::<_, String>(
        "SELECT stored_filename FROM pin_documents WHERE pin_id = $1",
    )
    .bind(pin_id)
    .fetch_all(&state.pool)
    .await;

    if let Ok(filenames) = filenames {
        for filename in filenames {
            let path = std::path::Path::new(&state.upload_dir).join(&filename);
            let _ = tokio::fs::remove_file(path).await;
        }
    }

    let result = sqlx::query("DELETE FROM activity_pins WHERE id = $1 AND trip_id = $2")
        .bind(pin_id)
        .bind(trip_id)
        .execute(&state.pool)
        .await;

    match result {
        Ok(_) => {
            // Broadcast real-time event
            state.broadcaster.broadcast(trip_id, TripEvent {
                event_type: "pin_deleted".to_string(),
                pin_id: pin_id.to_string(),
                triggered_by: auth_user.username.clone(),
            }).await;

            (StatusCode::NO_CONTENT, Json(json!({})))
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Something went wrong" })),
        ),
    }
}

/// Upload a document to a pin (multipart form)
async fn upload_document(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path((trip_id, pin_id)): Path<(uuid::Uuid, uuid::Uuid)>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    if let Err(resp) = verify_trip_member(&state.pool, trip_id, auth_user.user_id).await {
        return resp;
    }

    // Verify pin exists and belongs to this trip
    let pin_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM activity_pins WHERE id = $1 AND trip_id = $2)",
    )
    .bind(pin_id)
    .bind(trip_id)
    .fetch_one(&state.pool)
    .await;

    match pin_exists {
        Ok(false) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Pin not found" })),
            );
        }
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Something went wrong" })),
            );
        }
        _ => {}
    }

    // Extract file from multipart
    let field = match multipart.next_field().await {
        Ok(Some(field)) => field,
        Ok(None) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "No file provided" })),
            );
        }
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Invalid multipart data" })),
            );
        }
    };

    let original_filename = field
        .file_name()
        .unwrap_or("unnamed")
        .to_string();
    let mime_type = field
        .content_type()
        .unwrap_or("application/octet-stream")
        .to_string();

    // Validate file type — allow common document and image types
    const ALLOWED_MIMES: &[&str] = &[
        "application/pdf",
        "image/jpeg", "image/png", "image/gif", "image/webp",
        "text/plain", "text/csv",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "application/octet-stream", // fallback for unknown types
    ];
    const BLOCKED_EXTENSIONS: &[&str] = &[
        "exe", "sh", "bat", "cmd", "ps1", "msi", "dll", "so", "dylib",
        "js", "vbs", "wsf", "jar", "py", "rb", "php", "html", "htm",
    ];

    let ext_lower = std::path::Path::new(&original_filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if BLOCKED_EXTENSIONS.contains(&ext_lower.as_str()) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "File type not allowed for security reasons" })),
        );
    }

    if !ALLOWED_MIMES.contains(&mime_type.as_str()) {
        tracing::warn!("Rejected upload with MIME type: {}", mime_type);
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "File type not allowed. Supported: PDF, images, text, Office documents." })),
        );
    }

    // Read file bytes (limit to 10MB)
    let data = match field.bytes().await {
        Ok(bytes) => {
            if bytes.len() > 10 * 1024 * 1024 {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "File too large. Maximum size is 10MB." })),
                );
            }
            bytes
        }
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "Failed to read file data" })),
            );
        }
    };

    let file_size_bytes = data.len() as i64;

    // Generate unique stored filename
    let extension = std::path::Path::new(&original_filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("bin");
    let stored_filename = format!("{}.{}", uuid::Uuid::new_v4(), extension);

    // Write to disk
    let file_path = std::path::Path::new(&state.upload_dir).join(&stored_filename);
    if let Err(_) = tokio::fs::write(&file_path, &data).await {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Failed to save file" })),
        );
    }

    // Insert into database
    let doc = sqlx::query_as::<_, PinDocumentRow>(
        "INSERT INTO pin_documents (pin_id, uploaded_by, original_filename, stored_filename, mime_type, file_size_bytes) \
         VALUES ($1, $2, $3, $4, $5, $6) \
         RETURNING *",
    )
    .bind(pin_id)
    .bind(auth_user.user_id)
    .bind(&original_filename)
    .bind(&stored_filename)
    .bind(&mime_type)
    .bind(file_size_bytes)
    .fetch_one(&state.pool)
    .await;

    match doc {
        Ok(row) => {
            let trip_id_str = trip_id.to_string();
            let pin_id_str = pin_id.to_string();

            // Broadcast real-time event
            state.broadcaster.broadcast(trip_id, TripEvent {
                event_type: "document_uploaded".to_string(),
                pin_id: pin_id_str.clone(),
                triggered_by: auth_user.username.clone(),
            }).await;

            (
                StatusCode::CREATED,
                Json(json!(PinDocumentResponse::from_row(row, &trip_id_str, &pin_id_str))),
            )
        }
        Err(_) => {
            // Clean up file on DB error
            let _ = tokio::fs::remove_file(&file_path).await;
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Something went wrong" })),
            )
        }
    }
}

/// List documents for a pin
async fn list_documents(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path((trip_id, pin_id)): Path<(uuid::Uuid, uuid::Uuid)>,
    Query(pagination): Query<PaginationParams>,
) -> impl IntoResponse {
    if let Err(resp) = verify_trip_member(&state.pool, trip_id, auth_user.user_id).await {
        return resp;
    }

    let limit = pagination.limit();
    let offset = pagination.offset();

    let docs = sqlx::query_as::<_, PinDocumentRow>(
        "SELECT * FROM pin_documents WHERE pin_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
    )
    .bind(pin_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.pool)
    .await;

    match docs {
        Ok(rows) => {
            let trip_id_str = trip_id.to_string();
            let pin_id_str = pin_id.to_string();
            let docs: Vec<PinDocumentResponse> = rows
                .into_iter()
                .map(|r| PinDocumentResponse::from_row(r, &trip_id_str, &pin_id_str))
                .collect();
            (StatusCode::OK, Json(json!({ "documents": docs })))
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Something went wrong" })),
        ),
    }
}

/// Download a document file
async fn download_document(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path((trip_id, _pin_id, doc_id)): Path<(uuid::Uuid, uuid::Uuid, uuid::Uuid)>,
) -> axum::response::Response {
    if let Err(resp) = verify_trip_member(&state.pool, trip_id, auth_user.user_id).await {
        return resp.into_response();
    }

    let doc = sqlx::query_as::<_, PinDocumentRow>(
        "SELECT * FROM pin_documents WHERE id = $1",
    )
    .bind(doc_id)
    .fetch_optional(&state.pool)
    .await;

    match doc {
        Ok(Some(row)) => {
            // Prevent path traversal by ensuring stored_filename has no directory separators
            if row.stored_filename.contains('/') || row.stored_filename.contains('\\') || row.stored_filename.contains("..") {
                tracing::warn!("Suspicious stored_filename detected: {}", row.stored_filename);
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": "Something went wrong" })),
                )
                    .into_response();
            }

            let file_path = std::path::Path::new(&state.upload_dir).join(&row.stored_filename);
            match tokio::fs::read(&file_path).await {
                Ok(data) => {
                    let content_disposition = format!(
                        "attachment; filename=\"{}\"",
                        row.original_filename.replace('"', "\\\"")
                    );
                    (
                        StatusCode::OK,
                        [
                            (axum::http::header::CONTENT_TYPE, row.mime_type),
                            (
                                axum::http::header::CONTENT_DISPOSITION,
                                content_disposition,
                            ),
                        ],
                        data,
                    )
                        .into_response()
                }
                Err(_) => (
                    StatusCode::NOT_FOUND,
                    Json(json!({ "error": "File not found on disk" })),
                )
                    .into_response(),
            }
        }
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Document not found" })),
        )
            .into_response(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Something went wrong" })),
        )
            .into_response(),
    }
}

/// Delete a document
async fn delete_document(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path((trip_id, pin_id, doc_id)): Path<(uuid::Uuid, uuid::Uuid, uuid::Uuid)>,
) -> impl IntoResponse {
    if let Err(resp) = verify_trip_member(&state.pool, trip_id, auth_user.user_id).await {
        return resp;
    }

    let doc = sqlx::query_as::<_, PinDocumentRow>(
        "SELECT * FROM pin_documents WHERE id = $1",
    )
    .bind(doc_id)
    .fetch_optional(&state.pool)
    .await;

    match doc {
        Ok(Some(row)) => {
            // Check if user uploaded it or is trip owner
            let can = can_modify_resource(&state.pool, row.uploaded_by, trip_id, auth_user.user_id).await;
            match can {
                Ok(true) => {}
                Ok(false) => {
                    return (
                        StatusCode::FORBIDDEN,
                        Json(json!({ "error": "Only the uploader or trip owner can delete this document" })),
                    );
                }
                Err(_) => {
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({ "error": "Something went wrong" })),
                    );
                }
            }

            // Delete from disk
            let file_path = std::path::Path::new(&state.upload_dir).join(&row.stored_filename);
            let _ = tokio::fs::remove_file(file_path).await;

            // Delete from database
            let result = sqlx::query("DELETE FROM pin_documents WHERE id = $1")
                .bind(doc_id)
                .execute(&state.pool)
                .await;

            match result {
                Ok(_) => {
                    // Broadcast real-time event
                    state.broadcaster.broadcast(trip_id, TripEvent {
                        event_type: "document_deleted".to_string(),
                        pin_id: pin_id.to_string(),
                        triggered_by: auth_user.username.clone(),
                    }).await;

                    (StatusCode::NO_CONTENT, Json(json!({})))
                }
                Err(_) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": "Something went wrong" })),
                ),
            }
        }
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Document not found" })),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Something went wrong" })),
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use tower::ServiceExt;

    fn test_app(pool: sqlx::PgPool) -> Router {
        let upload_dir = std::env::temp_dir()
            .join("tip2tip_test_uploads")
            .to_string_lossy()
            .to_string();
        // Create upload dir synchronously for tests
        std::fs::create_dir_all(&upload_dir).expect("Failed to create test upload dir");

        let state = AppState {
            pool,
            jwt_secret: "a]super-secret-key-that-is-at-least-32-chars!!".to_string(),
            upload_dir,
            broadcaster: crate::realtime::TripBroadcaster::new(),
            user_cache: crate::common::UserExistsCache::new(300),
        };
        Router::new()
            .nest("/api/v1/auth", crate::auth::router())
            .nest("/api/v1/trips", crate::trips::router())
            .nest("/api/v1/trips", router())
            .with_state(state)
    }

    async fn setup_db() -> sqlx::PgPool {
        dotenvy::dotenv().ok();
        let url = std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgres://tip2tip:tip2tip_dev@localhost:5432/tip2tip".to_string());
        let pool = sqlx::PgPool::connect(&url)
            .await
            .expect("Failed to connect to test database");
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("Failed to run migrations");
        pool
    }

    async fn cleanup_db(pool: &sqlx::PgPool) {
        sqlx::query("DELETE FROM pin_votes")
            .execute(pool)
            .await
            .expect("Failed to clean up pin_votes");
        sqlx::query("DELETE FROM pin_documents")
            .execute(pool)
            .await
            .expect("Failed to clean up pin_documents");
        sqlx::query("DELETE FROM activity_pins")
            .execute(pool)
            .await
            .expect("Failed to clean up activity_pins");
        sqlx::query("DELETE FROM trip_members")
            .execute(pool)
            .await
            .expect("Failed to clean up trip_members");
        sqlx::query("DELETE FROM trips")
            .execute(pool)
            .await
            .expect("Failed to clean up trips");
        sqlx::query("DELETE FROM users")
            .execute(pool)
            .await
            .expect("Failed to clean up users");
    }

    /// Signs up a user and returns the JWT token
    async fn signup_and_get_token(app: &Router, email: &str, username: &str) -> String {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/auth/signup")
                    .header("Content-Type", "application/json")
                    .body(Body::from(
                        serde_json::to_string(&json!({
                            "email": email,
                            "username": username,
                            "password": "password123"
                        }))
                        .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("Failed to read body");
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("Response should be valid JSON");
        json["token"]
            .as_str()
            .expect("Should have token")
            .to_string()
    }

    /// Creates a trip and returns its ID
    async fn create_trip_and_get_id(app: &Router, token: &str, name: &str) -> String {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/trips")
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(
                        serde_json::to_string(&json!({ "name": name }))
                            .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("Failed to read body");
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("Response should be valid JSON");
        json["id"]
            .as_str()
            .expect("Should have trip ID")
            .to_string()
    }

    /// Creates a pin and returns its ID
    async fn create_pin_and_get_id(app: &Router, token: &str, trip_id: &str, title: &str) -> String {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/trips/{}/pins", trip_id))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(
                        serde_json::to_string(&json!({
                            "title": title,
                            "latitude": 40.0,
                            "longitude": 14.0
                        }))
                        .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("Failed to read body");
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("Response should be valid JSON");
        json["id"]
            .as_str()
            .expect("Should have pin ID")
            .to_string()
    }

    #[tokio::test]
    async fn test_create_pin_returns_201_for_trip_member() {
        // Trip member should be able to add a pin with valid coordinates
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token = signup_and_get_token(&app, "pin@test.com", "pinuser").await;
        let trip_id = create_trip_and_get_id(&app, &token, "Pin Test Trip").await;

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/trips/{}/pins", trip_id))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(
                        serde_json::to_string(&json!({
                            "title": "Blue Grotto Tour",
                            "description": "Boat tour of the famous sea cave",
                            "latitude": 40.5616,
                            "longitude": 14.2029,
                            "category": "activity"
                        }))
                        .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::CREATED, "Create pin should return 201");

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("Failed to read body");
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("Response should be valid JSON");

        assert_eq!(json["title"], "Blue Grotto Tour");
        assert_eq!(json["category"], "activity");
        assert_eq!(json["status"], "proposed");
        assert_eq!(json["created_by"], "pinuser");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_create_pin_with_scheduled_at_and_price() {
        // Pin with optional scheduled_at and price_cents should store and return them
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token = signup_and_get_token(&app, "sched@test.com", "scheduser").await;
        let trip_id = create_trip_and_get_id(&app, &token, "Schedule Trip").await;

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/trips/{}/pins", trip_id))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(
                        serde_json::to_string(&json!({
                            "title": "Dinner Reservation",
                            "latitude": 41.9028,
                            "longitude": 12.4964,
                            "category": "restaurant",
                            "scheduled_at": "2026-06-15T19:30:00Z",
                            "price_cents": 5500
                        }))
                        .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::CREATED, "Create pin with schedule should return 201");

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("Failed to read body");
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("Response should be valid JSON");

        assert_eq!(json["title"], "Dinner Reservation");
        assert_eq!(json["price_cents"], 5500);
        assert!(json["scheduled_at"].as_str().expect("should have scheduled_at").contains("2026-06-15"));

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_create_pin_returns_400_with_invalid_scheduled_at() {
        // Invalid datetime format should fail with 400
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token = signup_and_get_token(&app, "baddate@test.com", "baddateuser").await;
        let trip_id = create_trip_and_get_id(&app, &token, "Bad Date Trip").await;

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/trips/{}/pins", trip_id))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(
                        serde_json::to_string(&json!({
                            "title": "Bad Date Pin",
                            "latitude": 40.0,
                            "longitude": 14.0,
                            "scheduled_at": "not-a-date"
                        }))
                        .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST, "Invalid date should return 400");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_create_pin_returns_404_for_non_member() {
        // Non-member should not be able to add a pin to someone else's trip
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token_owner = signup_and_get_token(&app, "owner@pin.com", "pinowner").await;
        let token_other = signup_and_get_token(&app, "other@pin.com", "pinother").await;
        let trip_id = create_trip_and_get_id(&app, &token_owner, "Private Trip").await;

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/trips/{}/pins", trip_id))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token_other))
                    .body(Body::from(
                        serde_json::to_string(&json!({
                            "title": "Sneaky Pin",
                            "latitude": 40.0,
                            "longitude": 14.0
                        }))
                        .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::NOT_FOUND, "Non-member should get 404");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_create_pin_returns_400_with_invalid_coordinates() {
        // Latitude > 90 should fail validation
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token = signup_and_get_token(&app, "coords@test.com", "coorduser").await;
        let trip_id = create_trip_and_get_id(&app, &token, "Coords Trip").await;

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/trips/{}/pins", trip_id))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(
                        serde_json::to_string(&json!({
                            "title": "Bad Pin",
                            "latitude": 999.0,
                            "longitude": 14.0
                        }))
                        .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST, "Invalid coords should return 400");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_list_pins_returns_all_pins_for_trip() {
        // Listing should return all pins for a trip
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token = signup_and_get_token(&app, "list@pin.com", "listuser").await;
        let trip_id = create_trip_and_get_id(&app, &token, "List Pin Trip").await;

        // Create two pins
        for (title, lat) in [("Pin A", 40.0), ("Pin B", 41.0)] {
            app.clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri(format!("/api/v1/trips/{}/pins", trip_id))
                        .header("Content-Type", "application/json")
                        .header("Authorization", format!("Bearer {}", token))
                        .body(Body::from(
                            serde_json::to_string(&json!({
                                "title": title,
                                "latitude": lat,
                                "longitude": 14.0
                            }))
                            .expect("Failed to serialize"),
                        ))
                        .expect("Failed to build request"),
                )
                .await
                .expect("Failed to send request");
        }

        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/api/v1/trips/{}/pins", trip_id))
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::empty())
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("Failed to read body");
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("Response should be valid JSON");

        let pins = json["pins"].as_array().expect("Should have pins array");
        assert_eq!(pins.len(), 2, "Should have 2 pins");
        // Each pin should have a documents array
        assert!(pins[0]["documents"].is_array(), "Pin should have documents array");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_list_pins_returns_empty_for_trip_with_no_pins() {
        // Trip with no pins should return empty array
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token = signup_and_get_token(&app, "empty@pin.com", "emptypin").await;
        let trip_id = create_trip_and_get_id(&app, &token, "Empty Pin Trip").await;

        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/api/v1/trips/{}/pins", trip_id))
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::empty())
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("Failed to read body");
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("Response should be valid JSON");

        let pins = json["pins"].as_array().expect("Should have pins array");
        assert_eq!(pins.len(), 0, "Should have 0 pins");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_delete_pin_returns_204_for_creator() {
        // Pin creator should be able to delete their own pin
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token = signup_and_get_token(&app, "del@pin.com", "deluser").await;
        let trip_id = create_trip_and_get_id(&app, &token, "Delete Pin Trip").await;
        let pin_id = create_pin_and_get_id(&app, &token, &trip_id, "To Delete").await;

        let response = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(format!("/api/v1/trips/{}/pins/{}", trip_id, pin_id))
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::empty())
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::NO_CONTENT, "Delete should return 204");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_delete_pin_returns_404_for_non_member() {
        // Non-member should not be able to delete a pin
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token_owner = signup_and_get_token(&app, "delown@pin.com", "delowner").await;
        let token_other = signup_and_get_token(&app, "deloth@pin.com", "delother").await;
        let trip_id = create_trip_and_get_id(&app, &token_owner, "Private Pin Trip").await;
        let pin_id = create_pin_and_get_id(&app, &token_owner, &trip_id, "Private Pin").await;

        // Other user tries to delete
        let response = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(format!("/api/v1/trips/{}/pins/{}", trip_id, pin_id))
                    .header("Authorization", format!("Bearer {}", token_other))
                    .body(Body::empty())
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::NOT_FOUND, "Non-member should get 404");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_create_pin_returns_401_without_token() {
        // Unauthenticated request should be rejected
        let pool = setup_db().await;
        let app = test_app(pool.clone());

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/trips/00000000-0000-0000-0000-000000000000/pins")
                    .header("Content-Type", "application/json")
                    .body(Body::from(
                        serde_json::to_string(&json!({
                            "title": "No Auth Pin",
                            "latitude": 40.0,
                            "longitude": 14.0
                        }))
                        .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED, "No token should return 401");
    }

    #[tokio::test]
    async fn test_upload_and_list_documents() {
        // Uploading a document to a pin should return 201 and appear in list
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token = signup_and_get_token(&app, "doc@test.com", "docuser").await;
        let trip_id = create_trip_and_get_id(&app, &token, "Doc Trip").await;
        let pin_id = create_pin_and_get_id(&app, &token, &trip_id, "Doc Pin").await;

        // Upload a document using multipart
        let boundary = "----TestBoundary123";
        let body = format!(
            "------TestBoundary123\r\n\
             Content-Disposition: form-data; name=\"file\"; filename=\"ticket.pdf\"\r\n\
             Content-Type: application/pdf\r\n\
             \r\n\
             fake pdf content\r\n\
             ------TestBoundary123--\r\n"
        );

        let upload_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/trips/{}/pins/{}/documents", trip_id, pin_id))
                    .header("Content-Type", format!("multipart/form-data; boundary={}", boundary))
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(body))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(upload_response.status(), StatusCode::CREATED, "Upload should return 201");

        let upload_body = axum::body::to_bytes(upload_response.into_body(), usize::MAX)
            .await
            .expect("Failed to read body");
        let upload_json: serde_json::Value =
            serde_json::from_slice(&upload_body).expect("Response should be valid JSON");

        assert_eq!(upload_json["original_filename"], "ticket.pdf");
        assert_eq!(upload_json["mime_type"], "application/pdf");

        // List documents
        let list_response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/api/v1/trips/{}/pins/{}/documents", trip_id, pin_id))
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::empty())
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(list_response.status(), StatusCode::OK);

        let list_body = axum::body::to_bytes(list_response.into_body(), usize::MAX)
            .await
            .expect("Failed to read body");
        let list_json: serde_json::Value =
            serde_json::from_slice(&list_body).expect("Response should be valid JSON");

        let docs = list_json["documents"].as_array().expect("Should have documents array");
        assert_eq!(docs.len(), 1, "Should have 1 document");
        assert_eq!(docs[0]["original_filename"], "ticket.pdf");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_delete_document_returns_204() {
        // Document uploader should be able to delete their document
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token = signup_and_get_token(&app, "deldoc@test.com", "deldocuser").await;
        let trip_id = create_trip_and_get_id(&app, &token, "Del Doc Trip").await;
        let pin_id = create_pin_and_get_id(&app, &token, &trip_id, "Del Doc Pin").await;

        // Upload a document
        let boundary = "----TestBoundary456";
        let body = format!(
            "------TestBoundary456\r\n\
             Content-Disposition: form-data; name=\"file\"; filename=\"receipt.jpg\"\r\n\
             Content-Type: image/jpeg\r\n\
             \r\n\
             fake image\r\n\
             ------TestBoundary456--\r\n"
        );

        let upload_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/trips/{}/pins/{}/documents", trip_id, pin_id))
                    .header("Content-Type", format!("multipart/form-data; boundary={}", boundary))
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(body))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        let upload_body = axum::body::to_bytes(upload_response.into_body(), usize::MAX)
            .await
            .expect("Failed to read body");
        let upload_json: serde_json::Value =
            serde_json::from_slice(&upload_body).expect("Response should be valid JSON");
        let doc_id = upload_json["id"].as_str().expect("Should have doc ID");

        // Delete the document
        let delete_response = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(format!("/api/v1/trips/{}/pins/{}/documents/{}", trip_id, pin_id, doc_id))
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::empty())
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(delete_response.status(), StatusCode::NO_CONTENT, "Delete document should return 204");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_vote_pin_upvote_returns_200_with_correct_counts() {
        // A trip member should be able to upvote a pin and see the vote reflected
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token = signup_and_get_token(&app, "voter@test.com", "voter").await;
        let trip_id = create_trip_and_get_id(&app, &token, "Vote Trip").await;
        let pin_id = create_pin_and_get_id(&app, &token, &trip_id, "Voteable Pin").await;

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/trips/{}/pins/{}/vote", trip_id, pin_id))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(
                        serde_json::to_string(&json!({ "vote": 1 }))
                            .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::OK, "Upvote should return 200");

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("Failed to read body");
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("Response should be valid JSON");

        assert_eq!(json["upvotes"], 1, "Should have 1 upvote");
        assert_eq!(json["downvotes"], 0, "Should have 0 downvotes");
        assert_eq!(json["score"], 1, "Score should be 1");
        assert_eq!(json["user_vote"], 1, "User's vote should be 1");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_vote_pin_downvote_returns_200() {
        // A trip member should be able to downvote a pin
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token = signup_and_get_token(&app, "downvoter@test.com", "downvoter").await;
        let trip_id = create_trip_and_get_id(&app, &token, "Downvote Trip").await;
        let pin_id = create_pin_and_get_id(&app, &token, &trip_id, "Bad Pin").await;

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/trips/{}/pins/{}/vote", trip_id, pin_id))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(
                        serde_json::to_string(&json!({ "vote": -1 }))
                            .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::OK, "Downvote should return 200");

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("Failed to read body");
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("Response should be valid JSON");

        assert_eq!(json["upvotes"], 0);
        assert_eq!(json["downvotes"], 1);
        assert_eq!(json["score"], -1);
        assert_eq!(json["user_vote"], -1);

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_vote_pin_invalid_value_returns_400() {
        // A vote value other than 1 or -1 should be rejected
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token = signup_and_get_token(&app, "badvote@test.com", "badvote").await;
        let trip_id = create_trip_and_get_id(&app, &token, "Invalid Vote Trip").await;
        let pin_id = create_pin_and_get_id(&app, &token, &trip_id, "Pin").await;

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/trips/{}/pins/{}/vote", trip_id, pin_id))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(
                        serde_json::to_string(&json!({ "vote": 5 }))
                            .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST, "Invalid vote value should return 400");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_vote_pin_change_vote_updates_correctly() {
        // Changing a vote from upvote to downvote should upsert correctly
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token = signup_and_get_token(&app, "changer@test.com", "changer").await;
        let trip_id = create_trip_and_get_id(&app, &token, "Change Vote Trip").await;
        let pin_id = create_pin_and_get_id(&app, &token, &trip_id, "Changeable Pin").await;

        // First upvote
        let _response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/trips/{}/pins/{}/vote", trip_id, pin_id))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(
                        serde_json::to_string(&json!({ "vote": 1 }))
                            .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        // Then change to downvote
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/trips/{}/pins/{}/vote", trip_id, pin_id))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(
                        serde_json::to_string(&json!({ "vote": -1 }))
                            .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::OK, "Change vote should return 200");

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("Failed to read body");
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("Response should be valid JSON");

        assert_eq!(json["upvotes"], 0, "Should have 0 upvotes after changing to downvote");
        assert_eq!(json["downvotes"], 1, "Should have 1 downvote");
        assert_eq!(json["user_vote"], -1, "User vote should be -1");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_delete_vote_removes_user_vote() {
        // Removing a vote should bring counts back to zero
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token = signup_and_get_token(&app, "unvote@test.com", "unvoter").await;
        let trip_id = create_trip_and_get_id(&app, &token, "Unvote Trip").await;
        let pin_id = create_pin_and_get_id(&app, &token, &trip_id, "Unvoteable Pin").await;

        // First upvote
        let _response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/trips/{}/pins/{}/vote", trip_id, pin_id))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(
                        serde_json::to_string(&json!({ "vote": 1 }))
                            .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        // Then remove vote
        let response = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(format!("/api/v1/trips/{}/pins/{}/vote", trip_id, pin_id))
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::empty())
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::OK, "Delete vote should return 200");

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("Failed to read body");
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("Response should be valid JSON");

        assert_eq!(json["upvotes"], 0, "Should have 0 upvotes after removing vote");
        assert_eq!(json["downvotes"], 0, "Should have 0 downvotes after removing vote");
        assert_eq!(json["user_vote"], 0, "User vote should be 0 after removing");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_pin_response_includes_vote_summary() {
        // The list pins endpoint should include vote data in each pin response
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token = signup_and_get_token(&app, "listvote@test.com", "listvote").await;
        let trip_id = create_trip_and_get_id(&app, &token, "List Vote Trip").await;
        let pin_id = create_pin_and_get_id(&app, &token, &trip_id, "Vote Summary Pin").await;

        // Upvote the pin
        let _response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/trips/{}/pins/{}/vote", trip_id, pin_id))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(
                        serde_json::to_string(&json!({ "vote": 1 }))
                            .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        // List pins and verify votes are included
        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/api/v1/trips/{}/pins", trip_id))
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::empty())
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("Failed to read body");
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("Response should be valid JSON");

        let pin = &json["pins"][0];
        assert_eq!(pin["votes"]["upvotes"], 1, "List should include vote counts");
        assert_eq!(pin["votes"]["user_vote"], 1, "List should include user's vote");
        assert_eq!(pin["votes"]["score"], 1, "List should include score");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_vote_pin_returns_404_for_non_member() {
        // Non-member should not be able to vote on a pin
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token_owner = signup_and_get_token(&app, "voteowner@test.com", "voteowner").await;
        let token_other = signup_and_get_token(&app, "voteother@test.com", "voteother").await;
        let trip_id = create_trip_and_get_id(&app, &token_owner, "Private Vote Trip").await;
        let pin_id = create_pin_and_get_id(&app, &token_owner, &trip_id, "Private Pin").await;

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/trips/{}/pins/{}/vote", trip_id, pin_id))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token_other))
                    .body(Body::from(
                        serde_json::to_string(&json!({ "vote": 1 }))
                            .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::NOT_FOUND, "Non-member vote should get 404");

        cleanup_db(&pool).await;
    }
}

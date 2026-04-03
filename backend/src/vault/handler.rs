use axum::body::Body;
use axum::extract::{Multipart, Path, State};
use axum::http::header;
use axum::response::Response;
use axum::Json;
use tokio::fs;
use uuid::Uuid;

use crate::auth::middleware::{AppState, AuthUser};
use crate::error::{AppError, AppResult};

use super::model::Document;
use super::storage;

/// POST /trips/:trip_id/vault
pub async fn upload(
    State(state): State<AppState>,
    Path(trip_id): Path<Uuid>,
    auth_user: AuthUser,
    mut multipart: Multipart,
) -> AppResult<Json<Document>> {
    let field = multipart
        .next_field()
        .await
        .map_err(|e| AppError::Validation(format!("Invalid multipart data: {}", e)))?
        .ok_or_else(|| AppError::Validation("No file field in upload".into()))?;

    let file_name = field
        .file_name()
        .unwrap_or("unnamed")
        .to_string();

    let content_type = field
        .content_type()
        .unwrap_or("application/octet-stream")
        .to_string();

    let data = field
        .bytes()
        .await
        .map_err(|e| AppError::Validation(format!("Failed to read upload: {}", e)))?;

    let file_size = data.len() as i64;
    let doc_id = Uuid::new_v4();

    let storage_path = storage::save_file(
        &state.config.upload_dir,
        trip_id,
        doc_id,
        &file_name,
        &data,
    )
    .await
    .map_err(|e| AppError::Internal(format!("Failed to save file: {}", e)))?;

    let doc = sqlx::query_as::<_, Document>(
        r#"
        INSERT INTO documents (id, trip_id, uploaded_by, file_name, file_type, file_size, storage_path)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, trip_id, uploaded_by, file_name, file_type, file_size, storage_path, created_at
        "#,
    )
    .bind(doc_id)
    .bind(trip_id)
    .bind(auth_user.user_id)
    .bind(&file_name)
    .bind(&content_type)
    .bind(file_size)
    .bind(&storage_path)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(doc))
}

/// GET /trips/:trip_id/vault
pub async fn list_documents(
    State(state): State<AppState>,
    Path(trip_id): Path<Uuid>,
    _auth_user: AuthUser,
) -> AppResult<Json<Vec<Document>>> {
    let docs = sqlx::query_as::<_, Document>(
        r#"
        SELECT id, trip_id, uploaded_by, file_name, file_type, file_size, storage_path, created_at
        FROM documents
        WHERE trip_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(trip_id)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(docs))
}

/// GET /trips/:trip_id/vault/:id/download
pub async fn download(
    State(state): State<AppState>,
    Path((_trip_id, id)): Path<(Uuid, Uuid)>,
    _auth_user: AuthUser,
) -> AppResult<Response> {
    let doc = sqlx::query_as::<_, Document>(
        r#"
        SELECT id, trip_id, uploaded_by, file_name, file_type, file_size, storage_path, created_at
        FROM documents
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Document not found".into()))?;

    let full_path = format!("{}/{}", state.config.upload_dir, doc.storage_path);
    let data = fs::read(&full_path)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to read file: {}", e)))?;

    let response = Response::builder()
        .header(header::CONTENT_TYPE, &doc.file_type)
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", doc.file_name),
        )
        .body(Body::from(data))
        .map_err(|e| AppError::Internal(format!("Failed to build response: {}", e)))?;

    Ok(response)
}

/// DELETE /trips/:trip_id/vault/:id
pub async fn delete_document(
    State(state): State<AppState>,
    Path((_trip_id, id)): Path<(Uuid, Uuid)>,
    _auth_user: AuthUser,
) -> AppResult<Json<serde_json::Value>> {
    let doc = sqlx::query_as::<_, Document>(
        r#"
        SELECT id, trip_id, uploaded_by, file_name, file_type, file_size, storage_path, created_at
        FROM documents
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("Document not found".into()))?;

    // Delete file from disk.
    storage::delete_file(&state.config.upload_dir, &doc.storage_path)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to delete file: {}", e)))?;

    // Delete metadata from database.
    sqlx::query("DELETE FROM documents WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await?;

    Ok(Json(serde_json::json!({ "deleted": true })))
}

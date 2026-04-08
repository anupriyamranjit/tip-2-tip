use axum::{http::StatusCode, Json};
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;

/// Shared pagination parameters used across all list endpoints.
#[derive(Debug, serde::Deserialize)]
pub struct PaginationParams {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

impl PaginationParams {
    pub fn limit(&self) -> i64 {
        self.limit.unwrap_or(50).min(100).max(1)
    }
    pub fn offset(&self) -> i64 {
        self.offset.unwrap_or(0).max(0)
    }
}

/// Standard JSON error response type used by all handlers.
pub type ApiError = (StatusCode, Json<serde_json::Value>);

/// Convert validator errors into a standard 400 response.
pub fn validation_error(errors: validator::ValidationErrors) -> ApiError {
    let messages: Vec<String> = errors
        .field_errors()
        .into_values()
        .flat_map(|errs| {
            errs.iter()
                .filter_map(|e| e.message.as_ref().map(|m| m.to_string()))
        })
        .collect();
    (
        StatusCode::BAD_REQUEST,
        Json(json!({ "error": messages.join(", ") })),
    )
}

/// Verifies the user is a member of the given trip. Returns 404 if not, 500 on DB error.
pub async fn verify_trip_member(
    pool: &sqlx::PgPool,
    trip_id: uuid::Uuid,
    user_id: uuid::Uuid,
) -> Result<(), ApiError> {
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2)",
    )
    .bind(trip_id)
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Something went wrong" })),
        )
    })?;

    if !exists {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Trip not found" })),
        ));
    }
    Ok(())
}

/// Checks if the user is the resource creator or the trip owner.
/// Used for both pins and expenses.
pub async fn can_modify_resource(
    pool: &sqlx::PgPool,
    resource_owner_id: uuid::Uuid,
    trip_id: uuid::Uuid,
    requesting_user_id: uuid::Uuid,
) -> Result<bool, ()> {
    if resource_owner_id == requesting_user_id {
        return Ok(true);
    }
    sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2 AND role = 'owner')",
    )
    .bind(trip_id)
    .bind(requesting_user_id)
    .fetch_one(pool)
    .await
    .map_err(|_| ())
}

/// Verifies ownership of a resource (expense, pin, etc) and trip membership in a single query.
/// Returns the resource owner's user_id if found, or appropriate error response.
/// Also checks if the requesting user is the resource owner or the trip owner.
pub async fn verify_resource_ownership(
    pool: &sqlx::PgPool,
    resource_table: &str,
    resource_id: uuid::Uuid,
    trip_id: uuid::Uuid,
    requesting_user_id: uuid::Uuid,
    resource_name: &str,
) -> Result<(), ApiError> {
    // Single query: get resource owner + check if requesting user is trip owner
    let query = format!(
        "SELECT r.user_id, \
         COALESCE((SELECT role FROM trip_members WHERE trip_id = $2 AND user_id = $3), '') as user_role \
         FROM {} r WHERE r.id = $1 AND r.trip_id = $2",
        resource_table
    );

    let row = sqlx::query_as::<_, (uuid::Uuid, String)>(&query)
        .bind(resource_id)
        .bind(trip_id)
        .bind(requesting_user_id)
        .fetch_optional(pool)
        .await
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Something went wrong" })),
            )
        })?;

    match row {
        Some((owner_id, user_role)) => {
            if owner_id == requesting_user_id || user_role == "owner" {
                Ok(())
            } else {
                Err((
                    StatusCode::FORBIDDEN,
                    Json(json!({ "error": format!("Only the {} creator or trip owner can modify this {}", resource_name, resource_name) })),
                ))
            }
        }
        None => Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": format!("{} not found", resource_name) })),
        )),
    }
}

/// TTL cache for user existence checks. Avoids hitting DB on every authenticated request.
#[derive(Clone)]
pub struct UserExistsCache {
    cache: Arc<RwLock<HashMap<uuid::Uuid, Instant>>>,
    ttl_secs: u64,
}

impl UserExistsCache {
    pub fn new(ttl_secs: u64) -> Self {
        Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
            ttl_secs,
        }
    }

    /// Check if user exists, using cache when possible.
    pub async fn user_exists(
        &self,
        pool: &sqlx::PgPool,
        user_id: uuid::Uuid,
    ) -> Result<bool, sqlx::Error> {
        // Check cache first (read lock)
        {
            let cache = self.cache.read().await;
            if let Some(cached_at) = cache.get(&user_id) {
                if cached_at.elapsed().as_secs() < self.ttl_secs {
                    return Ok(true);
                }
            }
        }

        // Cache miss — query DB
        let exists = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)",
        )
        .bind(user_id)
        .fetch_one(pool)
        .await?;

        if exists {
            // Cache the positive result (write lock)
            let mut cache = self.cache.write().await;
            cache.insert(user_id, Instant::now());
        } else {
            // Remove from cache if user no longer exists
            let mut cache = self.cache.write().await;
            cache.remove(&user_id);
        }

        Ok(exists)
    }
}

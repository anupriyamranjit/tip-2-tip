use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

use super::handler::AppState;
use super::jwt;

pub struct AuthUser {
    pub user_id: uuid::Uuid,
    pub email: String,
    pub username: String,
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = Response;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get("Authorization")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "));

        let token = auth_header.ok_or_else(|| {
            (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Missing authorization token"})),
            )
                .into_response()
        })?;

        let claims = jwt::verify_token(token, &state.jwt_secret).map_err(|_| {
            (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Invalid or expired token"})),
            )
                .into_response()
        })?;

        let user_id = uuid::Uuid::parse_str(&claims.sub).map_err(|_| {
            (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "Invalid token claims"})),
            )
                .into_response()
        })?;

        // Verify the user still exists, using a TTL cache to avoid hitting DB every request
        let user_exists = state
            .user_cache
            .user_exists(&state.pool, user_id)
            .await
            .map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": "Something went wrong"})),
                )
                    .into_response()
            })?;

        if !user_exists {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "User no longer exists"})),
            )
                .into_response());
        }

        Ok(AuthUser {
            user_id,
            email: claims.email,
            username: claims.username,
        })
    }
}

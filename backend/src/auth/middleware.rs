use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use sqlx::PgPool;
use uuid::Uuid;

use crate::config::Config;
use crate::error::AppError;

use super::jwt::decode_token;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Config,
}

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: Uuid,
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get("Authorization")
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| AppError::Unauthorized("Missing authorization header".into()))?;

        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or_else(|| AppError::Unauthorized("Invalid authorization header format".into()))?;

        let claims = decode_token(token, &state.config.jwt_secret)?;

        let user_id = Uuid::parse_str(&claims.sub)
            .map_err(|_| AppError::Unauthorized("Invalid token subject".into()))?;

        Ok(AuthUser { user_id })
    }
}

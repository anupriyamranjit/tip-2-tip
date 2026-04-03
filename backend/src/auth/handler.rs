use argon2::{
    password_hash::{rand_core::OsRng, SaltString},
    Argon2, PasswordHash, PasswordHasher, PasswordVerifier,
};
use axum::extract::State;
use axum::Json;
use validator::Validate;

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::error::{AppError, AppResult};

use super::jwt::encode_token;
use super::middleware::{AppState, AuthUser};
use super::model::{AuthResponse, CreateUser, LoginRequest, User};

/// Internal struct for login query that includes the password hash.
#[derive(sqlx::FromRow)]
struct UserWithPassword {
    id: Uuid,
    email: String,
    name: String,
    avatar: String,
    color: String,
    created_at: DateTime<Utc>,
    password_hash: String,
}

/// POST /auth/register
pub async fn register(
    State(state): State<AppState>,
    Json(input): Json<CreateUser>,
) -> AppResult<Json<AuthResponse>> {
    input
        .validate()
        .map_err(|e| AppError::Validation(e.to_string()))?;

    // Hash the password
    let salt = SaltString::generate(&mut OsRng);
    let password_hash = Argon2::default()
        .hash_password(input.password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(format!("Failed to hash password: {}", e)))?
        .to_string();

    // Insert user into the database
    let user = sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (email, name, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, email, name, avatar, color, created_at
        "#,
    )
    .bind(&input.email)
    .bind(&input.name)
    .bind(&password_hash)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(ref db_err) if db_err.is_unique_violation() => {
            AppError::Conflict("A user with this email already exists".into())
        }
        _ => AppError::Database(e),
    })?;

    let token = encode_token(&user.id, &state.config.jwt_secret)?;

    Ok(Json(AuthResponse { token, user }))
}

/// POST /auth/login
pub async fn login(
    State(state): State<AppState>,
    Json(input): Json<LoginRequest>,
) -> AppResult<Json<AuthResponse>> {
    // Fetch user with password hash
    let row = sqlx::query_as::<_, UserWithPassword>(
        r#"
        SELECT id, email, name, avatar, color, created_at, password_hash
        FROM users
        WHERE email = $1
        "#,
    )
    .bind(&input.email)
    .fetch_optional(&state.pool)
    .await?;

    let row = match row {
        Some(row) => row,
        None => return Err(AppError::Unauthorized("Invalid email or password".into())),
    };

    let stored_hash = row.password_hash.clone();
    let user = User {
        id: row.id,
        email: row.email,
        name: row.name,
        avatar: row.avatar,
        color: row.color,
        created_at: row.created_at,
    };

    // Verify password
    let parsed_hash = PasswordHash::new(&stored_hash)
        .map_err(|e| AppError::Internal(format!("Failed to parse password hash: {}", e)))?;

    Argon2::default()
        .verify_password(input.password.as_bytes(), &parsed_hash)
        .map_err(|_| AppError::Unauthorized("Invalid email or password".into()))?;

    let token = encode_token(&user.id, &state.config.jwt_secret)?;

    Ok(Json(AuthResponse { token, user }))
}

/// GET /auth/me
pub async fn me(
    State(state): State<AppState>,
    auth_user: AuthUser,
) -> AppResult<Json<User>> {
    let user = sqlx::query_as::<_, User>(
        r#"
        SELECT id, email, name, avatar, color, created_at
        FROM users
        WHERE id = $1
        "#,
    )
    .bind(auth_user.user_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    Ok(Json(user))
}

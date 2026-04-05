use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use serde_json::json;
use validator::Validate;

use super::jwt;
use super::model::*;

#[derive(Clone)]
pub struct AppState {
    pub pool: sqlx::PgPool,
    pub jwt_secret: String,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/signup", post(signup))
        .route("/login", post(login))
}

async fn signup(
    State(state): State<AppState>,
    Json(body): Json<SignupRequest>,
) -> impl IntoResponse {
    if let Err(errors) = body.validate() {
        let messages: Vec<String> = errors
            .field_errors()
            .into_values()
            .flat_map(|errs| {
                errs.iter().filter_map(|e| e.message.as_ref().map(|m| m.to_string()))
            })
            .collect();
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": messages.join(", ") })),
        );
    }

    // Check if email already exists
    let existing = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM users WHERE email = $1 OR username = $2",
    )
    .bind(&body.email)
    .bind(&body.username)
    .fetch_one(&state.pool)
    .await;

    match existing {
        Ok(count) if count > 0 => {
            return (
                StatusCode::CONFLICT,
                Json(json!({ "error": "Email or username already taken" })),
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

    // Hash password using spawn_blocking to avoid blocking the async executor
    let password = body.password.clone();
    let password_hash = match tokio::task::spawn_blocking(move || {
        use argon2::{
            password_hash::{rand_core::OsRng, SaltString},
            Argon2, PasswordHasher,
        };
        let salt = SaltString::generate(&mut OsRng);
        Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .map(|h| h.to_string())
    })
    .await
    {
        Ok(Ok(hash)) => hash,
        _ => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Something went wrong" })),
            );
        }
    };

    // Insert user
    let user = sqlx::query_as::<_, UserRow>(
        "INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING id, email, username, password_hash",
    )
    .bind(&body.email)
    .bind(&body.username)
    .bind(&password_hash)
    .fetch_one(&state.pool)
    .await;

    match user {
        Ok(user) => {
            let token = jwt::create_token(
                &user.id.to_string(),
                &user.email,
                &user.username,
                &state.jwt_secret,
            );

            match token {
                Ok(token) => (
                    StatusCode::CREATED,
                    Json(json!(AuthResponse {
                        token,
                        user: UserResponse {
                            id: user.id.to_string(),
                            email: user.email,
                            username: user.username,
                        },
                    })),
                ),
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

async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginRequest>,
) -> impl IntoResponse {
    if let Err(errors) = body.validate() {
        let messages: Vec<String> = errors
            .field_errors()
            .into_values()
            .flat_map(|errs| {
                errs.iter().filter_map(|e| e.message.as_ref().map(|m| m.to_string()))
            })
            .collect();
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": messages.join(", ") })),
        );
    }

    // Find user by email
    let user = sqlx::query_as::<_, UserRow>(
        "SELECT id, email, username, password_hash FROM users WHERE email = $1",
    )
    .bind(&body.email)
    .fetch_optional(&state.pool)
    .await;

    let user = match user {
        Ok(Some(u)) => u,
        Ok(None) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "Invalid email or password" })),
            );
        }
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Something went wrong" })),
            );
        }
    };

    // Verify password using spawn_blocking
    let stored_hash = user.password_hash.clone();
    let password = body.password.clone();
    let password_valid = tokio::task::spawn_blocking(move || {
        use argon2::{Argon2, PasswordHash, PasswordVerifier};
        let parsed_hash = PasswordHash::new(&stored_hash).ok()?;
        Argon2::default()
            .verify_password(password.as_bytes(), &parsed_hash)
            .ok()
    })
    .await;

    match password_valid {
        Ok(Some(())) => {}
        _ => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "Invalid email or password" })),
            );
        }
    }

    // Generate token
    let token = jwt::create_token(
        &user.id.to_string(),
        &user.email,
        &user.username,
        &state.jwt_secret,
    );

    match token {
        Ok(token) => (
            StatusCode::OK,
            Json(json!(AuthResponse {
                token,
                user: UserResponse {
                    id: user.id.to_string(),
                    email: user.email,
                    username: user.username,
                },
            })),
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
        let state = AppState {
            pool,
            jwt_secret: "a]super-secret-key-that-is-at-least-32-chars!!".to_string(),
        };
        Router::new()
            .nest("/api/v1/auth", router())
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
        sqlx::query("DELETE FROM users")
            .execute(pool)
            .await
            .expect("Failed to clean up users table");
    }

    #[tokio::test]
    async fn test_signup_returns_201_with_valid_data() {
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/auth/signup")
                    .header("Content-Type", "application/json")
                    .body(Body::from(
                        serde_json::to_string(&json!({
                            "email": "test@example.com",
                            "username": "testuser",
                            "password": "password123"
                        }))
                        .expect("Failed to serialize signup body"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::CREATED, "Signup should return 201");

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("Failed to read response body");
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("Response should be valid JSON");

        assert!(json["token"].is_string(), "Response should contain a token");
        assert_eq!(json["user"]["email"], "test@example.com");
        assert_eq!(json["user"]["username"], "testuser");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_signup_returns_409_when_email_taken() {
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        // First signup
        let body = serde_json::to_string(&json!({
            "email": "dup@example.com",
            "username": "user1",
            "password": "password123"
        }))
        .expect("Failed to serialize");

        let _ = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/auth/signup")
                    .header("Content-Type", "application/json")
                    .body(Body::from(body))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        // Duplicate signup
        let body2 = serde_json::to_string(&json!({
            "email": "dup@example.com",
            "username": "user2",
            "password": "password123"
        }))
        .expect("Failed to serialize");

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/auth/signup")
                    .header("Content-Type", "application/json")
                    .body(Body::from(body2))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::CONFLICT, "Duplicate email should return 409");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_signup_returns_400_with_invalid_email() {
        let pool = setup_db().await;
        let app = test_app(pool.clone());

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/auth/signup")
                    .header("Content-Type", "application/json")
                    .body(Body::from(
                        serde_json::to_string(&json!({
                            "email": "not-an-email",
                            "username": "testuser",
                            "password": "password123"
                        }))
                        .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST, "Invalid email should return 400");
    }

    #[tokio::test]
    async fn test_signup_returns_400_with_short_password() {
        let pool = setup_db().await;
        let app = test_app(pool.clone());

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/auth/signup")
                    .header("Content-Type", "application/json")
                    .body(Body::from(
                        serde_json::to_string(&json!({
                            "email": "test@example.com",
                            "username": "testuser",
                            "password": "short"
                        }))
                        .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST, "Short password should return 400");
    }

    #[tokio::test]
    async fn test_login_returns_200_with_valid_credentials() {
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        // Signup first
        let _ = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/auth/signup")
                    .header("Content-Type", "application/json")
                    .body(Body::from(
                        serde_json::to_string(&json!({
                            "email": "login@example.com",
                            "username": "loginuser",
                            "password": "password123"
                        }))
                        .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        // Login
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/auth/login")
                    .header("Content-Type", "application/json")
                    .body(Body::from(
                        serde_json::to_string(&json!({
                            "email": "login@example.com",
                            "password": "password123"
                        }))
                        .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::OK, "Login should return 200");

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("Failed to read body");
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("Response should be valid JSON");

        assert!(json["token"].is_string(), "Response should contain a token");
        assert_eq!(json["user"]["email"], "login@example.com");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_login_returns_401_with_wrong_password() {
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        // Signup first
        let _ = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/auth/signup")
                    .header("Content-Type", "application/json")
                    .body(Body::from(
                        serde_json::to_string(&json!({
                            "email": "wrong@example.com",
                            "username": "wronguser",
                            "password": "password123"
                        }))
                        .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        // Login with wrong password
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/auth/login")
                    .header("Content-Type", "application/json")
                    .body(Body::from(
                        serde_json::to_string(&json!({
                            "email": "wrong@example.com",
                            "password": "wrongpassword"
                        }))
                        .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED, "Wrong password should return 401");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_login_returns_401_with_nonexistent_email() {
        let pool = setup_db().await;
        let app = test_app(pool.clone());

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/auth/login")
                    .header("Content-Type", "application/json")
                    .body(Body::from(
                        serde_json::to_string(&json!({
                            "email": "nonexistent@example.com",
                            "password": "password123"
                        }))
                        .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED, "Nonexistent email should return 401");
    }
}

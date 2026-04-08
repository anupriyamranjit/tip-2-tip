use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde_json::json;
use validator::Validate;

use crate::auth::{AppState, AuthUser};
use crate::common::PaginationParams;
use super::model::*;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", post(create_trip).get(list_my_trips))
        .route("/{id}", get(get_trip))
}

async fn create_trip(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Json(body): Json<CreateTripRequest>,
) -> impl IntoResponse {
    if let Err(errors) = body.validate() {
        return crate::common::validation_error(errors);
    }

    let mut tx = match state.pool.begin().await {
        Ok(tx) => tx,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Something went wrong" })),
            );
        }
    };

    let trip = sqlx::query_as::<_, TripRow>(
        "INSERT INTO trips (name, description, destination, start_date, end_date, cover_image_url) \
         VALUES ($1, $2, $3, $4, $5, $6) \
         RETURNING id, name, description, destination, start_date, end_date, status, cover_image_url, created_at, updated_at",
    )
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.destination)
    .bind(&body.start_date)
    .bind(&body.end_date)
    .bind(&body.cover_image_url)
    .fetch_one(&mut *tx)
    .await;

    let trip = match trip {
        Ok(t) => t,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Something went wrong" })),
            );
        }
    };

    let member_insert = sqlx::query(
        "INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1, $2, 'owner')",
    )
    .bind(&trip.id)
    .bind(&auth_user.user_id)
    .execute(&mut *tx)
    .await;

    if member_insert.is_err() {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Something went wrong" })),
        );
    }

    if tx.commit().await.is_err() {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Something went wrong" })),
        );
    }

    let response = TripResponse {
        id: trip.id.to_string(),
        name: trip.name,
        description: trip.description,
        destination: trip.destination,
        start_date: trip.start_date.map(|d| d.to_string()),
        end_date: trip.end_date.map(|d| d.to_string()),
        status: trip.status,
        cover_image_url: trip.cover_image_url,
        role: "owner".to_string(),
        member_count: 1,
        created_at: trip.created_at.to_rfc3339(),
    };

    (StatusCode::CREATED, Json(json!(response)))
}

async fn list_my_trips(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Query(pagination): Query<PaginationParams>,
) -> impl IntoResponse {
    let limit = pagination.limit();
    let offset = pagination.offset();

    let trips = sqlx::query_as::<_, TripWithMemberInfo>(
        "SELECT t.id, t.name, t.description, t.destination, t.start_date, t.end_date, \
                t.status, t.cover_image_url, t.created_at, \
                tm.role, \
                (SELECT COUNT(*) FROM trip_members WHERE trip_id = t.id) as member_count \
         FROM trips t \
         JOIN trip_members tm ON t.id = tm.trip_id \
         WHERE tm.user_id = $1 \
         ORDER BY t.created_at DESC \
         LIMIT $2 OFFSET $3",
    )
    .bind(&auth_user.user_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.pool)
    .await;

    match trips {
        Ok(rows) => {
            let trips: Vec<TripResponse> = rows.into_iter().map(TripResponse::from_row).collect();
            (StatusCode::OK, Json(json!({ "trips": trips })))
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Something went wrong" })),
        ),
    }
}

async fn get_trip(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(id): Path<uuid::Uuid>,
) -> impl IntoResponse {
    let trip = sqlx::query_as::<_, TripWithMemberInfo>(
        "SELECT t.id, t.name, t.description, t.destination, t.start_date, t.end_date, \
                t.status, t.cover_image_url, t.created_at, \
                tm.role, \
                (SELECT COUNT(*) FROM trip_members WHERE trip_id = t.id) as member_count \
         FROM trips t \
         JOIN trip_members tm ON t.id = tm.trip_id \
         WHERE t.id = $1 AND tm.user_id = $2",
    )
    .bind(&id)
    .bind(&auth_user.user_id)
    .fetch_optional(&state.pool)
    .await;

    match trip {
        Ok(Some(row)) => (StatusCode::OK, Json(json!(TripResponse::from_row(row)))),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Trip not found" })),
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
            upload_dir: std::env::temp_dir().join("tip2tip_test_uploads").to_string_lossy().to_string(),
            broadcaster: crate::realtime::TripBroadcaster::new(),
            user_cache: crate::common::UserExistsCache::new(300),
        };
        Router::new()
            .nest("/api/v1/auth", crate::auth::router())
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

    #[tokio::test]
    async fn test_create_trip_returns_201_with_valid_data() {
        // Authenticated user can create a trip and is set as owner
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token = signup_and_get_token(&app, "trip@test.com", "tripuser").await;

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/trips")
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(
                        serde_json::to_string(&json!({
                            "name": "Swiss Alps Expedition",
                            "destination": "Switzerland",
                            "description": "A mountain adventure"
                        }))
                        .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::CREATED, "Create trip should return 201");

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("Failed to read body");
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("Response should be valid JSON");

        assert_eq!(json["name"], "Swiss Alps Expedition");
        assert_eq!(json["destination"], "Switzerland");
        assert_eq!(json["role"], "owner");
        assert_eq!(json["member_count"], 1);
        assert_eq!(json["status"], "proposed");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_create_trip_returns_401_without_token() {
        // Unauthenticated request should be rejected
        let pool = setup_db().await;
        let app = test_app(pool.clone());

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/trips")
                    .header("Content-Type", "application/json")
                    .body(Body::from(
                        serde_json::to_string(&json!({
                            "name": "Test Trip"
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
    async fn test_create_trip_returns_400_with_empty_name() {
        // Empty trip name should fail validation
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token = signup_and_get_token(&app, "empty@test.com", "emptyuser").await;

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/trips")
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(
                        serde_json::to_string(&json!({
                            "name": ""
                        }))
                        .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST, "Empty name should return 400");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_list_trips_returns_only_user_trips() {
        // User should only see trips they are a member of
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token_a = signup_and_get_token(&app, "usera@test.com", "usera").await;
        let token_b = signup_and_get_token(&app, "userb@test.com", "userb").await;

        // User A creates a trip
        let _ = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/trips")
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token_a))
                    .body(Body::from(
                        serde_json::to_string(&json!({"name": "User A Trip"}))
                            .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        // User B creates a trip
        let _ = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/trips")
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token_b))
                    .body(Body::from(
                        serde_json::to_string(&json!({"name": "User B Trip"}))
                            .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        // User A lists trips — should only see their own
        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/api/v1/trips")
                    .header("Authorization", format!("Bearer {}", token_a))
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

        let trips = json["trips"].as_array().expect("Should have trips array");
        assert_eq!(trips.len(), 1, "User A should only see 1 trip");
        assert_eq!(trips[0]["name"], "User A Trip");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_list_trips_returns_empty_for_new_user() {
        // New user with no trips should get an empty list
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token = signup_and_get_token(&app, "new@test.com", "newuser").await;

        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/api/v1/trips")
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

        let trips = json["trips"].as_array().expect("Should have trips array");
        assert_eq!(trips.len(), 0, "New user should have no trips");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_get_trip_returns_200_for_member() {
        // Trip member can fetch trip details
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token = signup_and_get_token(&app, "member@test.com", "memberuser").await;

        // Create a trip
        let create_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/trips")
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(
                        serde_json::to_string(&json!({"name": "My Trip", "destination": "Paris"}))
                            .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        let body = axum::body::to_bytes(create_response.into_body(), usize::MAX)
            .await
            .expect("Failed to read body");
        let created: serde_json::Value =
            serde_json::from_slice(&body).expect("Response should be valid JSON");
        let trip_id = created["id"].as_str().expect("Should have trip ID");

        // Get the trip
        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/api/v1/trips/{}", trip_id))
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::empty())
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::OK, "Member should get 200");

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("Failed to read body");
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("Response should be valid JSON");

        assert_eq!(json["name"], "My Trip");
        assert_eq!(json["destination"], "Paris");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_get_trip_returns_404_for_non_member() {
        // Non-member should get 404 (not 403, to avoid leaking trip existence)
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token_owner = signup_and_get_token(&app, "owner@test.com", "owneruser").await;
        let token_other = signup_and_get_token(&app, "other@test.com", "otheruser").await;

        // Owner creates a trip
        let create_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/trips")
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token_owner))
                    .body(Body::from(
                        serde_json::to_string(&json!({"name": "Private Trip"}))
                            .expect("Failed to serialize"),
                    ))
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        let body = axum::body::to_bytes(create_response.into_body(), usize::MAX)
            .await
            .expect("Failed to read body");
        let created: serde_json::Value =
            serde_json::from_slice(&body).expect("Response should be valid JSON");
        let trip_id = created["id"].as_str().expect("Should have trip ID");

        // Other user tries to get the trip
        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/api/v1/trips/{}", trip_id))
                    .header("Authorization", format!("Bearer {}", token_other))
                    .body(Body::empty())
                    .expect("Failed to build request"),
            )
            .await
            .expect("Failed to send request");

        assert_eq!(response.status(), StatusCode::NOT_FOUND, "Non-member should get 404");

        cleanup_db(&pool).await;
    }
}

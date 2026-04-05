use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde_json::json;
use validator::Validate;

use crate::auth::{AppState, AuthUser};
use super::model::*;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/{trip_id}/pins", post(create_pin).get(list_pins))
        .route("/{trip_id}/pins/{pin_id}", get(get_pin).put(update_pin).delete(delete_pin))
}

/// Verifies the user is a member of the given trip. Returns 404 if not.
async fn verify_trip_member(
    pool: &sqlx::PgPool,
    trip_id: uuid::Uuid,
    user_id: uuid::Uuid,
) -> Result<(), (StatusCode, Json<serde_json::Value>)> {
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

/// Checks if the user is the pin creator or the trip owner.
async fn can_modify_pin(
    pool: &sqlx::PgPool,
    pin_user_id: uuid::Uuid,
    trip_id: uuid::Uuid,
    requesting_user_id: uuid::Uuid,
) -> Result<bool, ()> {
    if pin_user_id == requesting_user_id {
        return Ok(true);
    }
    // Check if the requesting user is the trip owner
    let is_owner = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2 AND role = 'owner')",
    )
    .bind(trip_id)
    .bind(requesting_user_id)
    .fetch_one(pool)
    .await
    .map_err(|_| ())?;

    Ok(is_owner)
}

async fn create_pin(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(trip_id): Path<uuid::Uuid>,
    Json(body): Json<CreatePinRequest>,
) -> impl IntoResponse {
    if let Err(errors) = body.validate() {
        let messages: Vec<String> = errors
            .field_errors()
            .into_values()
            .flat_map(|errs| {
                errs.iter()
                    .filter_map(|e| e.message.as_ref().map(|m| m.to_string()))
            })
            .collect();
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": messages.join(", ") })),
        );
    }

    if let Err(resp) = verify_trip_member(&state.pool, trip_id, auth_user.user_id).await {
        return resp;
    }

    let category = body.category.unwrap_or_else(|| "general".to_string());

    let insert_result = sqlx::query_scalar::<_, uuid::Uuid>(
        "INSERT INTO activity_pins (trip_id, user_id, title, description, latitude, longitude, category, image_url) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
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
                Ok(r) => (StatusCode::CREATED, Json(json!(ActivityPinResponse::from_row(r)))),
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
) -> impl IntoResponse {
    if let Err(resp) = verify_trip_member(&state.pool, trip_id, auth_user.user_id).await {
        return resp;
    }

    let pins = sqlx::query_as::<_, ActivityPinRow>(
        "SELECT p.*, u.username FROM activity_pins p \
         JOIN users u ON p.user_id = u.id \
         WHERE p.trip_id = $1 \
         ORDER BY p.created_at DESC",
    )
    .bind(trip_id)
    .fetch_all(&state.pool)
    .await;

    match pins {
        Ok(rows) => {
            let pins: Vec<ActivityPinResponse> =
                rows.into_iter().map(ActivityPinResponse::from_row).collect();
            (StatusCode::OK, Json(json!({ "pins": pins })))
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
        Ok(Some(row)) => (StatusCode::OK, Json(json!(ActivityPinResponse::from_row(row)))),
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
        let messages: Vec<String> = errors
            .field_errors()
            .into_values()
            .flat_map(|errs| {
                errs.iter()
                    .filter_map(|e| e.message.as_ref().map(|m| m.to_string()))
            })
            .collect();
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": messages.join(", ") })),
        );
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

    let can_modify = can_modify_pin(&state.pool, pin_owner_id, trip_id, auth_user.user_id).await;
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

    // Build dynamic update
    let title = body.title;
    let description = body.description;
    let latitude = body.latitude;
    let longitude = body.longitude;
    let category = body.category;
    let status = body.status;
    let image_url = body.image_url;

    let result = sqlx::query_as::<_, ActivityPinRow>(
        "UPDATE activity_pins SET \
         title = COALESCE($1, title), \
         description = COALESCE($2, description), \
         latitude = COALESCE($3, latitude), \
         longitude = COALESCE($4, longitude), \
         category = COALESCE($5, category), \
         status = COALESCE($6, status), \
         image_url = COALESCE($7, image_url), \
         updated_at = NOW() \
         WHERE id = $8 AND trip_id = $9 \
         RETURNING *, (SELECT username FROM users WHERE id = activity_pins.user_id) as username",
    )
    .bind(&title)
    .bind(&description)
    .bind(latitude)
    .bind(longitude)
    .bind(&category)
    .bind(&status)
    .bind(&image_url)
    .bind(pin_id)
    .bind(trip_id)
    .fetch_one(&state.pool)
    .await;

    match result {
        Ok(row) => (StatusCode::OK, Json(json!(ActivityPinResponse::from_row(row)))),
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

    let can_modify = can_modify_pin(&state.pool, pin_owner_id, trip_id, auth_user.user_id).await;
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

    let result = sqlx::query("DELETE FROM activity_pins WHERE id = $1 AND trip_id = $2")
        .bind(pin_id)
        .bind(trip_id)
        .execute(&state.pool)
        .await;

    match result {
        Ok(_) => (StatusCode::NO_CONTENT, Json(json!({}))),
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

        // Create a pin
        let create_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/trips/{}/pins", trip_id))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(
                        serde_json::to_string(&json!({
                            "title": "To Delete",
                            "latitude": 40.0,
                            "longitude": 14.0
                        }))
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
        let pin_id = created["id"].as_str().expect("Should have pin ID");

        // Delete the pin
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

        // Owner creates a pin
        let create_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/trips/{}/pins", trip_id))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token_owner))
                    .body(Body::from(
                        serde_json::to_string(&json!({
                            "title": "Private Pin",
                            "latitude": 40.0,
                            "longitude": 14.0
                        }))
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
        let pin_id = created["id"].as_str().expect("Should have pin ID");

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
}

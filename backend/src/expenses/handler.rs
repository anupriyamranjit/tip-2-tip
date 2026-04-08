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
use crate::common::{PaginationParams, verify_trip_member, verify_resource_ownership};
use super::model::*;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/{trip_id}/expenses", post(create_expense).get(list_expenses))
        .route("/{trip_id}/expenses/sync", post(sync_confirmed_pins))
        .route(
            "/{trip_id}/expenses/{expense_id}",
            get(get_expense)
                .put(update_expense)
                .delete(delete_expense),
        )
}

async fn create_expense(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(trip_id): Path<uuid::Uuid>,
    Json(body): Json<CreateExpenseRequest>,
) -> impl IntoResponse {
    if let Err(errors) = body.validate() {
        return crate::common::validation_error(errors);
    }

    if let Err(resp) = verify_trip_member(&state.pool, trip_id, auth_user.user_id).await {
        return resp;
    }

    let split_type = body.split_type.as_deref().unwrap_or("shared");
    if split_type != "shared" && split_type != "personal" {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "split_type must be 'shared' or 'personal'" })),
        );
    }

    let category = body.category.as_deref().unwrap_or("other");

    let pin_id: Option<uuid::Uuid> = match &body.activity_pin_id {
        Some(id_str) => match uuid::Uuid::parse_str(id_str) {
            Ok(id) => Some(id),
            Err(_) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "Invalid activity_pin_id" })),
                );
            }
        },
        None => None,
    };

    let result = sqlx::query_as::<_, ExpenseRow>(
        "INSERT INTO expenses (trip_id, user_id, activity_pin_id, title, amount_cents, category, split_type, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
         RETURNING id, trip_id, user_id, activity_pin_id, title, amount_cents, category, split_type, notes, created_at, updated_at, \
         (SELECT username FROM users WHERE id = $2) as username",
    )
    .bind(trip_id)
    .bind(auth_user.user_id)
    .bind(pin_id)
    .bind(&body.title)
    .bind(body.amount_cents)
    .bind(category)
    .bind(split_type)
    .bind(&body.notes)
    .fetch_one(&state.pool)
    .await;

    match result {
        Ok(row) => (
            StatusCode::CREATED,
            Json(json!(ExpenseResponse::from_row(row))),
        ),
        Err(e) => {
            let err_str = e.to_string();
            if err_str.contains("idx_expenses_pin_unique") {
                return (
                    StatusCode::CONFLICT,
                    Json(json!({ "error": "An expense already exists for this activity pin" })),
                );
            }
            tracing::error!("Failed to create expense: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Something went wrong" })),
            )
        }
    }
}

async fn list_expenses(
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

    let rows = sqlx::query_as::<_, ExpenseRow>(
        "SELECT e.id, e.trip_id, e.user_id, e.activity_pin_id, e.title, e.amount_cents, \
                e.category, e.split_type, e.notes, e.created_at, e.updated_at, u.username \
         FROM expenses e \
         JOIN users u ON e.user_id = u.id \
         WHERE e.trip_id = $1 \
         ORDER BY e.created_at DESC \
         LIMIT $2 OFFSET $3",
    )
    .bind(trip_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.pool)
    .await;

    match rows {
        Ok(rows) => {
            let expenses: Vec<ExpenseResponse> =
                rows.into_iter().map(ExpenseResponse::from_row).collect();
            (StatusCode::OK, Json(json!({ "expenses": expenses })))
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Something went wrong" })),
        ),
    }
}

async fn get_expense(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path((trip_id, expense_id)): Path<(uuid::Uuid, uuid::Uuid)>,
) -> impl IntoResponse {
    if let Err(resp) = verify_trip_member(&state.pool, trip_id, auth_user.user_id).await {
        return resp;
    }

    let result = sqlx::query_as::<_, ExpenseRow>(
        "SELECT e.id, e.trip_id, e.user_id, e.activity_pin_id, e.title, e.amount_cents, \
                e.category, e.split_type, e.notes, e.created_at, e.updated_at, u.username \
         FROM expenses e \
         JOIN users u ON e.user_id = u.id \
         WHERE e.id = $1 AND e.trip_id = $2",
    )
    .bind(expense_id)
    .bind(trip_id)
    .fetch_optional(&state.pool)
    .await;

    match result {
        Ok(Some(row)) => (
            StatusCode::OK,
            Json(json!(ExpenseResponse::from_row(row))),
        ),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Expense not found" })),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Something went wrong" })),
        ),
    }
}

async fn update_expense(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path((trip_id, expense_id)): Path<(uuid::Uuid, uuid::Uuid)>,
    Json(body): Json<UpdateExpenseRequest>,
) -> impl IntoResponse {
    if let Err(errors) = body.validate() {
        return crate::common::validation_error(errors);
    }

    // Single query: verify trip membership + expense ownership + trip owner role
    if let Err(resp) = verify_resource_ownership(
        &state.pool, "expenses", expense_id, trip_id, auth_user.user_id, "expense",
    ).await {
        return resp;
    }

    if let Some(ref st) = body.split_type {
        if st != "shared" && st != "personal" {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "split_type must be 'shared' or 'personal'" })),
            );
        }
    }

    let result = sqlx::query_as::<_, ExpenseRow>(
        "UPDATE expenses SET \
            title = COALESCE($3, title), \
            amount_cents = COALESCE($4, amount_cents), \
            category = COALESCE($5, category), \
            split_type = COALESCE($6, split_type), \
            notes = COALESCE($7, notes), \
            updated_at = now() \
         WHERE id = $1 AND trip_id = $2 \
         RETURNING id, trip_id, user_id, activity_pin_id, title, amount_cents, category, split_type, notes, created_at, updated_at, \
         (SELECT username FROM users WHERE id = expenses.user_id) as username",
    )
    .bind(expense_id)
    .bind(trip_id)
    .bind(&body.title)
    .bind(body.amount_cents)
    .bind(&body.category)
    .bind(&body.split_type)
    .bind(&body.notes)
    .fetch_optional(&state.pool)
    .await;

    match result {
        Ok(Some(row)) => (
            StatusCode::OK,
            Json(json!(ExpenseResponse::from_row(row))),
        ),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Expense not found" })),
        ),
        Err(e) => {
            tracing::error!("Failed to update expense: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Something went wrong" })),
            )
        }
    }
}

async fn delete_expense(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path((trip_id, expense_id)): Path<(uuid::Uuid, uuid::Uuid)>,
) -> impl IntoResponse {
    // Single query: verify expense ownership + trip owner role
    if let Err(resp) = verify_resource_ownership(
        &state.pool, "expenses", expense_id, trip_id, auth_user.user_id, "expense",
    ).await {
        return resp;
    }

    let result = sqlx::query(
        "DELETE FROM expenses WHERE id = $1 AND trip_id = $2",
    )
    .bind(expense_id)
    .bind(trip_id)
    .execute(&state.pool)
    .await;

    match result {
        Ok(res) if res.rows_affected() > 0 => (
            StatusCode::OK,
            Json(json!({ "message": "Expense deleted" })),
        ),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Expense not found" })),
        ),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "Something went wrong" })),
        ),
    }
}

/// Sync confirmed activity pins into the expenses table.
/// Creates expense entries for confirmed pins that have a price and don't already have an expense.
async fn sync_confirmed_pins(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(trip_id): Path<uuid::Uuid>,
) -> impl IntoResponse {
    if let Err(resp) = verify_trip_member(&state.pool, trip_id, auth_user.user_id).await {
        return resp;
    }

    // Insert expenses for confirmed pins with prices that don't already have an expense entry
    let result = sqlx::query(
        "INSERT INTO expenses (trip_id, user_id, activity_pin_id, title, amount_cents, category, split_type) \
         SELECT ap.trip_id, ap.user_id, ap.id, ap.title, ap.price_cents, ap.category, 'shared' \
         FROM activity_pins ap \
         WHERE ap.trip_id = $1 \
           AND ap.status = 'confirmed' \
           AND ap.price_cents IS NOT NULL \
           AND ap.price_cents > 0 \
           AND NOT EXISTS (SELECT 1 FROM expenses e WHERE e.activity_pin_id = ap.id) \
         ON CONFLICT DO NOTHING",
    )
    .bind(trip_id)
    .execute(&state.pool)
    .await;

    match result {
        Ok(res) => {
            let synced = res.rows_affected();
            // Now return the full expense list
            let rows = sqlx::query_as::<_, ExpenseRow>(
                "SELECT e.id, e.trip_id, e.user_id, e.activity_pin_id, e.title, e.amount_cents, \
                        e.category, e.split_type, e.notes, e.created_at, e.updated_at, u.username \
                 FROM expenses e \
                 JOIN users u ON e.user_id = u.id \
                 WHERE e.trip_id = $1 \
                 ORDER BY e.created_at DESC",
            )
            .bind(trip_id)
            .fetch_all(&state.pool)
            .await;

            match rows {
                Ok(rows) => {
                    let expenses: Vec<ExpenseResponse> =
                        rows.into_iter().map(ExpenseResponse::from_row).collect();
                    (
                        StatusCode::OK,
                        Json(json!({ "expenses": expenses, "synced": synced })),
                    )
                }
                Err(_) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": "Something went wrong" })),
                ),
            }
        }
        Err(e) => {
            tracing::error!("Failed to sync confirmed pins: {:?}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "Something went wrong" })),
            )
        }
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
            upload_dir: std::env::temp_dir()
                .join("tip2tip_test_uploads")
                .to_string_lossy()
                .to_string(),
            broadcaster: crate::realtime::TripBroadcaster::new(),
            user_cache: crate::common::UserExistsCache::new(300),
        };
        Router::new()
            .nest("/api/v1/auth", crate::auth::router())
            .nest("/api/v1/trips", crate::trips::router())
            .nest("/api/v1/trips", crate::activity_pins::router())
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
        sqlx::query("DELETE FROM expenses").execute(pool).await.expect("cleanup expenses");
        sqlx::query("DELETE FROM pin_documents").execute(pool).await.expect("cleanup pin_documents");
        sqlx::query("DELETE FROM activity_pins").execute(pool).await.expect("cleanup activity_pins");
        sqlx::query("DELETE FROM trip_members").execute(pool).await.expect("cleanup trip_members");
        sqlx::query("DELETE FROM trips").execute(pool).await.expect("cleanup trips");
        sqlx::query("DELETE FROM users").execute(pool).await.expect("cleanup users");
    }

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
                        .expect("serialize"),
                    ))
                    .expect("build request"),
            )
            .await
            .expect("send request");

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let json: serde_json::Value = serde_json::from_slice(&body).expect("parse json");
        json["token"].as_str().expect("token").to_string()
    }

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
                        serde_json::to_string(&json!({ "name": name })).expect("serialize"),
                    ))
                    .expect("build request"),
            )
            .await
            .expect("send request");

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let json: serde_json::Value = serde_json::from_slice(&body).expect("parse json");
        json["id"].as_str().expect("trip id").to_string()
    }

    #[tokio::test]
    async fn test_create_expense_returns_201_with_valid_data() {
        // Authenticated trip member can create a manual expense
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token = signup_and_get_token(&app, "exp@test.com", "expuser").await;
        let trip_id = create_trip_and_get_id(&app, &token, "Budget Trip").await;

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/trips/{}/expenses", trip_id))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(
                        serde_json::to_string(&json!({
                            "title": "Flight to Paris",
                            "amount_cents": 45000,
                            "category": "transport",
                            "split_type": "shared"
                        }))
                        .expect("serialize"),
                    ))
                    .expect("build request"),
            )
            .await
            .expect("send request");

        assert_eq!(response.status(), StatusCode::CREATED, "Should return 201");

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let json: serde_json::Value = serde_json::from_slice(&body).expect("parse json");

        assert_eq!(json["title"], "Flight to Paris");
        assert_eq!(json["amount_cents"], 45000);
        assert_eq!(json["split_type"], "shared");
        assert_eq!(json["category"], "transport");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_create_expense_returns_400_with_invalid_split_type() {
        // Invalid split_type should be rejected
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token = signup_and_get_token(&app, "split@test.com", "splituser").await;
        let trip_id = create_trip_and_get_id(&app, &token, "Split Trip").await;

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/trips/{}/expenses", trip_id))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(
                        serde_json::to_string(&json!({
                            "title": "Bad Split",
                            "amount_cents": 1000,
                            "split_type": "invalid"
                        }))
                        .expect("serialize"),
                    ))
                    .expect("build request"),
            )
            .await
            .expect("send request");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST, "Invalid split_type should return 400");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_list_expenses_returns_trip_expenses() {
        // List should return all expenses for the trip
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token = signup_and_get_token(&app, "list@test.com", "listuser").await;
        let trip_id = create_trip_and_get_id(&app, &token, "List Trip").await;

        // Create two expenses
        for title in &["Hotel", "Dinner"] {
            let _ = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri(format!("/api/v1/trips/{}/expenses", trip_id))
                        .header("Content-Type", "application/json")
                        .header("Authorization", format!("Bearer {}", token))
                        .body(Body::from(
                            serde_json::to_string(&json!({
                                "title": title,
                                "amount_cents": 5000
                            }))
                            .expect("serialize"),
                        ))
                        .expect("build request"),
                )
                .await
                .expect("send request");
        }

        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/api/v1/trips/{}/expenses", trip_id))
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("send request");

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let json: serde_json::Value = serde_json::from_slice(&body).expect("parse json");

        let expenses = json["expenses"].as_array().expect("expenses array");
        assert_eq!(expenses.len(), 2, "Should have 2 expenses");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_update_expense_split_type() {
        // User can change an expense from shared to personal
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token = signup_and_get_token(&app, "update@test.com", "updateuser").await;
        let trip_id = create_trip_and_get_id(&app, &token, "Update Trip").await;

        let create_res = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/trips/{}/expenses", trip_id))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(
                        serde_json::to_string(&json!({
                            "title": "Museum tickets",
                            "amount_cents": 2500,
                            "split_type": "shared"
                        }))
                        .expect("serialize"),
                    ))
                    .expect("build request"),
            )
            .await
            .expect("send request");

        let body = axum::body::to_bytes(create_res.into_body(), usize::MAX)
            .await
            .expect("read body");
        let created: serde_json::Value = serde_json::from_slice(&body).expect("parse json");
        let expense_id = created["id"].as_str().expect("expense id");

        let response = app
            .oneshot(
                Request::builder()
                    .method("PUT")
                    .uri(format!("/api/v1/trips/{}/expenses/{}", trip_id, expense_id))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(
                        serde_json::to_string(&json!({
                            "split_type": "personal"
                        }))
                        .expect("serialize"),
                    ))
                    .expect("build request"),
            )
            .await
            .expect("send request");

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let json: serde_json::Value = serde_json::from_slice(&body).expect("parse json");
        assert_eq!(json["split_type"], "personal", "Split type should be updated to personal");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_delete_expense_returns_200() {
        // User can delete an expense
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token = signup_and_get_token(&app, "del@test.com", "deluser").await;
        let trip_id = create_trip_and_get_id(&app, &token, "Delete Trip").await;

        let create_res = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/trips/{}/expenses", trip_id))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(
                        serde_json::to_string(&json!({
                            "title": "To delete",
                            "amount_cents": 100
                        }))
                        .expect("serialize"),
                    ))
                    .expect("build request"),
            )
            .await
            .expect("send request");

        let body = axum::body::to_bytes(create_res.into_body(), usize::MAX)
            .await
            .expect("read body");
        let created: serde_json::Value = serde_json::from_slice(&body).expect("parse json");
        let expense_id = created["id"].as_str().expect("expense id");

        let response = app
            .oneshot(
                Request::builder()
                    .method("DELETE")
                    .uri(format!("/api/v1/trips/{}/expenses/{}", trip_id, expense_id))
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("send request");

        assert_eq!(response.status(), StatusCode::OK, "Delete should return 200");

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_sync_confirmed_pins_creates_expenses() {
        // Syncing should create expenses for confirmed pins with prices
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token = signup_and_get_token(&app, "sync@test.com", "syncuser").await;
        let trip_id = create_trip_and_get_id(&app, &token, "Sync Trip").await;

        // Create an activity pin with price
        let pin_res = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/trips/{}/pins", trip_id))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(
                        serde_json::to_string(&json!({
                            "title": "Eiffel Tower Visit",
                            "latitude": 48.8584,
                            "longitude": 2.2945,
                            "category": "sightseeing",
                            "price_cents": 3500
                        }))
                        .expect("serialize"),
                    ))
                    .expect("build request"),
            )
            .await
            .expect("send request");

        let body = axum::body::to_bytes(pin_res.into_body(), usize::MAX)
            .await
            .expect("read body");
        let pin: serde_json::Value = serde_json::from_slice(&body).expect("parse json");
        let pin_id = pin["id"].as_str().expect("pin id");

        // Confirm the pin
        let _ = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("PUT")
                    .uri(format!("/api/v1/trips/{}/pins/{}", trip_id, pin_id))
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(
                        serde_json::to_string(&json!({ "status": "confirmed" }))
                            .expect("serialize"),
                    ))
                    .expect("build request"),
            )
            .await
            .expect("send request");

        // Sync confirmed pins
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/trips/{}/expenses/sync", trip_id))
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("send request");

        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let json: serde_json::Value = serde_json::from_slice(&body).expect("parse json");

        assert_eq!(json["synced"], 1, "Should have synced 1 pin");
        let expenses = json["expenses"].as_array().expect("expenses array");
        assert_eq!(expenses.len(), 1, "Should have 1 expense");
        assert_eq!(expenses[0]["title"], "Eiffel Tower Visit");
        assert_eq!(expenses[0]["amount_cents"], 3500);

        cleanup_db(&pool).await;
    }

    #[tokio::test]
    async fn test_expense_returns_404_for_non_member() {
        // Non-trip-member should get 404
        let pool = setup_db().await;
        cleanup_db(&pool).await;
        let app = test_app(pool.clone());

        let token_owner = signup_and_get_token(&app, "owner@exp.com", "expowner").await;
        let token_other = signup_and_get_token(&app, "other@exp.com", "expother").await;
        let trip_id = create_trip_and_get_id(&app, &token_owner, "Private Trip").await;

        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/api/v1/trips/{}/expenses", trip_id))
                    .header("Authorization", format!("Bearer {}", token_other))
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("send request");

        assert_eq!(response.status(), StatusCode::NOT_FOUND, "Non-member should get 404");

        cleanup_db(&pool).await;
    }
}

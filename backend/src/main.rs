mod activity_pins;
mod auth;
pub mod realtime;
mod trips;

use auth::AppState;
use axum::extract::DefaultBodyLimit;
use tower_http::cors::{AllowHeaders, CorsLayer};
use tower_http::trace::TraceLayer;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "tip2tip_backend=debug,tower_http=debug".into()),
        )
        .init();

    dotenvy::dotenv().ok();

    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let jwt_secret =
        std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");

    assert!(
        jwt_secret.len() >= 32,
        "JWT_SECRET must be at least 32 characters"
    );

    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    tracing::info!("Database connected and migrations applied");

    let upload_dir = std::env::var("UPLOAD_DIR")
        .unwrap_or_else(|_| "/data/uploads".to_string());

    // Ensure upload directory exists
    tokio::fs::create_dir_all(&upload_dir)
        .await
        .expect("Failed to create upload directory");

    tracing::info!("Upload directory: {}", upload_dir);

    let broadcaster = realtime::TripBroadcaster::new();
    // Start background task to periodically clean up empty broadcast channels
    broadcaster.clone().start_cleanup_task();

    let state = AppState {
        pool,
        jwt_secret,
        upload_dir,
        broadcaster,
    };

    let cors_origin = std::env::var("CORS_ORIGIN")
        .unwrap_or_else(|_| "http://localhost:3000".to_string());
    let cors = CorsLayer::new()
        .allow_origin(
            cors_origin
                .parse::<axum::http::HeaderValue>()
                .expect("Invalid CORS_ORIGIN value"),
        )
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers(AllowHeaders::any());

    let app = axum::Router::new()
        .nest("/api/v1/auth", auth::router())
        .nest("/api/v1/trips", trips::router())
        .nest("/api/v1/trips", activity_pins::router())
        .layer(DefaultBodyLimit::max(10 * 1024 * 1024)) // 10MB max for multipart uploads
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = "0.0.0.0:8080";
    tracing::info!("Starting server on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind address");

    axum::serve(listener, app)
        .await
        .expect("Server error");
}

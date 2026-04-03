mod auth;
mod config;
mod db;
mod error;
mod expenses;
mod itinerary;
mod polls;
mod trips;
mod vault;

use auth::middleware::AppState;
use config::Config;
use tower_http::cors::{AllowHeaders, AllowMethods, CorsLayer};
use tower_http::trace::TraceLayer;

#[tokio::main]
async fn main() {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "tip2tip_backend=debug,tower_http=debug".into()),
        )
        .init();

    // Load config
    dotenvy::dotenv().ok();
    let config = Config::from_env();

    // Connect to database and run migrations
    let pool = db::create_pool(&config.database_url).await;
    db::run_migrations(&pool).await;

    // Create upload directory
    let upload_dir = config.upload_dir.clone();
    tokio::fs::create_dir_all(&upload_dir)
        .await
        .expect("Failed to create upload directory");

    // Shared state
    let state = AppState {
        pool,
        config: config.clone(),
    };

    // CORS
    let cors = CorsLayer::new()
        .allow_origin(
            config
                .cors_origin
                .parse::<axum::http::HeaderValue>()
                .expect("Invalid CORS_ORIGIN"),
        )
        .allow_methods(AllowMethods::any())
        .allow_headers(AllowHeaders::any());

    // Build router
    let app = axum::Router::new()
        .merge(auth::router())
        .merge(trips::router())
        .merge(expenses::router())
        .merge(itinerary::router())
        .merge(vault::router())
        .merge(polls::router())
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    // Start server
    let addr = format!("0.0.0.0:{}", config.port);
    tracing::info!("Starting server on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("Failed to bind address");

    axum::serve(listener, app)
        .await
        .expect("Server error");
}

pub mod handler;
pub mod jwt;
pub mod middleware;
pub mod model;

use axum::routing::{get, post};
use axum::Router;

use middleware::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/auth/register", post(handler::register))
        .route("/auth/login", post(handler::login))
        .route("/auth/me", get(handler::me))
}

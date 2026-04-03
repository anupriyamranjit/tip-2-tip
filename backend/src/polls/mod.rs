pub mod handler;
pub mod model;
pub mod routes;

use axum::Router;

use crate::auth::middleware::AppState;

pub fn router() -> Router<AppState> {
    routes::router()
}

pub mod handler;
pub mod model;
pub mod routes;
pub mod storage;

use axum::Router;

use crate::auth::middleware::AppState;

pub fn router() -> Router<AppState> {
    routes::router()
}

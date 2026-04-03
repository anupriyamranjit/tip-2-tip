use axum::routing::{get, patch, post};
use axum::Router;

use crate::auth::middleware::AppState;

use super::handler;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/trips/{trip_id}/polls", post(handler::create_poll))
        .route("/trips/{trip_id}/polls", get(handler::list_polls))
        .route("/trips/{trip_id}/polls/{id}", get(handler::get_poll))
        .route(
            "/trips/{trip_id}/polls/{id}/vote",
            post(handler::cast_vote),
        )
        .route(
            "/trips/{trip_id}/polls/{id}/close",
            patch(handler::close_poll),
        )
}

use axum::routing::{delete, get, post};
use axum::Router;

use crate::auth::middleware::AppState;

use super::handler;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/trips/{trip_id}/vault", post(handler::upload))
        .route("/trips/{trip_id}/vault", get(handler::list_documents))
        .route(
            "/trips/{trip_id}/vault/{id}/download",
            get(handler::download),
        )
        .route(
            "/trips/{trip_id}/vault/{id}",
            delete(handler::delete_document),
        )
}

use axum::routing::{delete, get, patch, post, put};
use axum::Router;

use crate::auth::middleware::AppState;

use super::handler;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/trips/{trip_id}/itinerary", post(handler::create_item))
        .route("/trips/{trip_id}/itinerary", get(handler::list_items))
        .route(
            "/trips/{trip_id}/itinerary/reorder",
            post(handler::reorder),
        )
        .route("/trips/{trip_id}/itinerary/{id}", get(handler::get_item))
        .route("/trips/{trip_id}/itinerary/{id}", put(handler::update_item))
        .route(
            "/trips/{trip_id}/itinerary/{id}",
            delete(handler::delete_item),
        )
        .route(
            "/trips/{trip_id}/itinerary/{id}/status",
            patch(handler::update_status),
        )
}

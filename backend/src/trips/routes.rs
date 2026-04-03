use axum::routing::{delete, get, post, put};
use axum::Router;

use crate::auth::middleware::AppState;

use super::handler;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", post(handler::create_trip).get(handler::list_trips))
        .route(
            "/{trip_id}",
            get(handler::get_trip)
                .put(handler::update_trip)
                .delete(handler::delete_trip),
        )
        .route("/{trip_id}/invite", post(handler::invite_member))
        .route("/{trip_id}/members", get(handler::list_members))
        .route(
            "/{trip_id}/members/{user_id}",
            delete(handler::remove_member),
        )
        .route("/{trip_id}/preferences", put(handler::update_preferences))
}

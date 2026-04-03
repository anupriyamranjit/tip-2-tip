use axum::routing::{get, post};
use axum::Router;

use crate::auth::middleware::AppState;

use super::handler;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/trips/{trip_id}/expenses",
            post(handler::create_expense).get(handler::list_expenses),
        )
        .route(
            "/trips/{trip_id}/expenses/summary",
            get(handler::get_summary),
        )
        .route(
            "/trips/{trip_id}/expenses/debts",
            get(handler::get_debts),
        )
        .route(
            "/trips/{trip_id}/expenses/{expense_id}",
            get(handler::get_expense)
                .put(handler::update_expense)
                .delete(handler::delete_expense),
        )
}

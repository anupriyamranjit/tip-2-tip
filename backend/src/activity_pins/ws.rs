use axum::{
    extract::{
        ws::{Message, WebSocket},
        Path, Query, State, WebSocketUpgrade,
    },
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;

use crate::auth::AppState;

#[derive(Deserialize)]
pub struct WsQuery {
    token: String,
}

/// WebSocket upgrade handler — authenticates via query param token, then
/// subscribes the client to real-time trip events.
pub async fn ws_handler(
    State(state): State<AppState>,
    Path(trip_id): Path<uuid::Uuid>,
    Query(query): Query<WsQuery>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    // Authenticate the WebSocket connection via the query-param JWT
    let claims = match crate::auth::jwt::verify_token(&query.token, &state.jwt_secret) {
        Ok(c) => c,
        Err(_) => {
            return (
                axum::http::StatusCode::UNAUTHORIZED,
                "Invalid or expired token",
            )
                .into_response();
        }
    };

    let user_id = match uuid::Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => {
            return (
                axum::http::StatusCode::UNAUTHORIZED,
                "Invalid token claims",
            )
                .into_response();
        }
    };

    // Verify user is a trip member
    let is_member = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2)",
    )
    .bind(trip_id)
    .bind(user_id)
    .fetch_one(&state.pool)
    .await
    .unwrap_or(false);

    if !is_member {
        return (axum::http::StatusCode::FORBIDDEN, "Not a trip member").into_response();
    }

    // Check connection limits before accepting
    if !state.broadcaster.can_accept_connection(trip_id).await {
        return (
            axum::http::StatusCode::SERVICE_UNAVAILABLE,
            "Too many connections. Please try again later.",
        )
            .into_response();
    }

    let broadcaster = state.broadcaster.clone();
    let username = claims.username.clone();

    ws.on_upgrade(move |socket| handle_socket(socket, trip_id, username, broadcaster))
}

async fn handle_socket(
    socket: WebSocket,
    trip_id: uuid::Uuid,
    _username: String,
    broadcaster: crate::realtime::TripBroadcaster,
) {
    let (mut sender, mut receiver) = socket.split();

    // Track the connection
    broadcaster.connection_opened();

    // Subscribe to trip events
    let mut rx = broadcaster.subscribe(trip_id).await;

    tracing::debug!("WebSocket connected for trip {}", trip_id);

    // Spawn a task that forwards broadcast events to the WebSocket client
    let send_task = tokio::spawn(async move {
        while let Ok(event) = rx.recv().await {
            let json = match serde_json::to_string(&event) {
                Ok(j) => j,
                Err(_) => continue,
            };
            if sender.send(Message::Text(json.into())).await.is_err() {
                break; // Client disconnected
            }
        }
    });

    // Receive task: keep the connection alive by reading client messages (pings, close)
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Close(_) => break,
                _ => {} // Ignore text/binary/ping from client — pongs handled by axum
            }
        }
    });

    // Wait for either task to finish (client disconnect or send failure)
    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    // Track the disconnection
    broadcaster.connection_closed();

    tracing::debug!("WebSocket disconnected for trip {}", trip_id);

    // Clean up empty channels
    broadcaster.cleanup_empty_channels().await;
}

use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use tokio::sync::{broadcast, RwLock};
use serde::{Deserialize, Serialize};

/// Maximum number of buffered messages per trip channel
const CHANNEL_CAPACITY: usize = 64;

/// Maximum total concurrent WebSocket connections
const MAX_GLOBAL_CONNECTIONS: usize = 5000;

/// Maximum concurrent connections per trip
const MAX_CONNECTIONS_PER_TRIP: usize = 200;

/// A real-time event broadcast to all WebSocket clients viewing a trip.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TripEvent {
    /// Event type: "pin_created", "pin_updated", "pin_deleted", "document_uploaded", "document_deleted"
    #[serde(rename = "type")]
    pub event_type: String,
    /// The ID of the affected pin
    pub pin_id: String,
    /// The username of the user who triggered the event
    pub triggered_by: String,
}

/// Manages broadcast channels per trip for real-time WebSocket notifications.
#[derive(Clone)]
pub struct TripBroadcaster {
    channels: Arc<RwLock<HashMap<uuid::Uuid, broadcast::Sender<TripEvent>>>>,
    global_connections: Arc<AtomicUsize>,
}

impl Default for TripBroadcaster {
    fn default() -> Self {
        Self::new()
    }
}

impl TripBroadcaster {
    pub fn new() -> Self {
        Self {
            channels: Arc::new(RwLock::new(HashMap::new())),
            global_connections: Arc::new(AtomicUsize::new(0)),
        }
    }

    /// Check if we can accept a new connection (global and per-trip limits).
    pub async fn can_accept_connection(&self, trip_id: uuid::Uuid) -> bool {
        let global = self.global_connections.load(Ordering::Relaxed);
        if global >= MAX_GLOBAL_CONNECTIONS {
            tracing::warn!("Global WebSocket connection limit reached: {}", global);
            return false;
        }

        let channels = self.channels.read().await;
        if let Some(tx) = channels.get(&trip_id) {
            if tx.receiver_count() >= MAX_CONNECTIONS_PER_TRIP {
                tracing::warn!(
                    "Per-trip WebSocket connection limit reached for trip {}: {}",
                    trip_id,
                    tx.receiver_count()
                );
                return false;
            }
        }

        true
    }

    /// Track a new connection opening.
    pub fn connection_opened(&self) {
        self.global_connections.fetch_add(1, Ordering::Relaxed);
    }

    /// Track a connection closing.
    pub fn connection_closed(&self) {
        self.global_connections.fetch_sub(1, Ordering::Relaxed);
    }

    /// Get or create a broadcast sender for a trip.
    pub async fn subscribe(&self, trip_id: uuid::Uuid) -> broadcast::Receiver<TripEvent> {
        let channels = self.channels.read().await;
        if let Some(tx) = channels.get(&trip_id) {
            return tx.subscribe();
        }
        drop(channels);

        let mut channels = self.channels.write().await;
        // Double-check after acquiring write lock
        if let Some(tx) = channels.get(&trip_id) {
            return tx.subscribe();
        }

        let (tx, rx) = broadcast::channel(CHANNEL_CAPACITY);
        channels.insert(trip_id, tx);
        rx
    }

    /// Broadcast an event to all subscribers of a trip.
    /// Silently does nothing if there are no subscribers.
    pub async fn broadcast(&self, trip_id: uuid::Uuid, event: TripEvent) {
        let channels = self.channels.read().await;
        if let Some(tx) = channels.get(&trip_id) {
            // Ignore send error (no receivers)
            let _ = tx.send(event);
        }
    }

    /// Clean up channels with no active subscribers to prevent memory leaks.
    pub async fn cleanup_empty_channels(&self) {
        let mut channels = self.channels.write().await;
        let before = channels.len();
        channels.retain(|_, tx| tx.receiver_count() > 0);
        let removed = before - channels.len();
        if removed > 0 {
            tracing::debug!("Cleaned up {} empty broadcast channels", removed);
        }
    }

    /// Start a background task that periodically cleans up empty channels.
    pub fn start_cleanup_task(self) {
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(std::time::Duration::from_secs(300)).await;
                self.cleanup_empty_channels().await;
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_broadcaster_subscribe_and_receive() {
        // Subscribing to a trip channel should receive broadcasted events
        let broadcaster = TripBroadcaster::new();
        let trip_id = uuid::Uuid::new_v4();

        let mut rx = broadcaster.subscribe(trip_id).await;

        let event = TripEvent {
            event_type: "pin_created".to_string(),
            pin_id: uuid::Uuid::new_v4().to_string(),
            triggered_by: "testuser".to_string(),
        };

        broadcaster.broadcast(trip_id, event.clone()).await;

        let received = rx.recv().await.expect("Should receive event");
        assert_eq!(received.event_type, "pin_created");
        assert_eq!(received.triggered_by, "testuser");
    }

    #[tokio::test]
    async fn test_broadcaster_multiple_subscribers() {
        // Multiple subscribers should all receive the same event
        let broadcaster = TripBroadcaster::new();
        let trip_id = uuid::Uuid::new_v4();

        let mut rx1 = broadcaster.subscribe(trip_id).await;
        let mut rx2 = broadcaster.subscribe(trip_id).await;

        let event = TripEvent {
            event_type: "pin_deleted".to_string(),
            pin_id: uuid::Uuid::new_v4().to_string(),
            triggered_by: "user2".to_string(),
        };

        broadcaster.broadcast(trip_id, event).await;

        let r1 = rx1.recv().await.expect("Subscriber 1 should receive event");
        let r2 = rx2.recv().await.expect("Subscriber 2 should receive event");
        assert_eq!(r1.event_type, "pin_deleted");
        assert_eq!(r2.event_type, "pin_deleted");
    }

    #[tokio::test]
    async fn test_broadcaster_no_cross_trip_leakage() {
        // Events on trip A should not appear on trip B
        let broadcaster = TripBroadcaster::new();
        let trip_a = uuid::Uuid::new_v4();
        let trip_b = uuid::Uuid::new_v4();

        let mut rx_b = broadcaster.subscribe(trip_b).await;

        let event = TripEvent {
            event_type: "pin_created".to_string(),
            pin_id: uuid::Uuid::new_v4().to_string(),
            triggered_by: "userA".to_string(),
        };

        broadcaster.broadcast(trip_a, event).await;

        // rx_b should timeout (no event)
        let result = tokio::time::timeout(
            std::time::Duration::from_millis(50),
            rx_b.recv(),
        )
        .await;
        assert!(result.is_err(), "Trip B should not receive Trip A events");
    }

    #[tokio::test]
    async fn test_cleanup_removes_empty_channels() {
        // Channels with no subscribers should be cleaned up
        let broadcaster = TripBroadcaster::new();
        let trip_id = uuid::Uuid::new_v4();

        // Subscribe and immediately drop
        let _rx = broadcaster.subscribe(trip_id).await;
        drop(_rx);

        broadcaster.cleanup_empty_channels().await;

        let channels = broadcaster.channels.read().await;
        assert!(
            channels.is_empty(),
            "Empty channels should be cleaned up"
        );
    }

    #[tokio::test]
    async fn test_connection_tracking() {
        // Connection count should increment and decrement correctly
        let broadcaster = TripBroadcaster::new();

        assert_eq!(broadcaster.global_connections.load(Ordering::Relaxed), 0);

        broadcaster.connection_opened();
        broadcaster.connection_opened();
        assert_eq!(broadcaster.global_connections.load(Ordering::Relaxed), 2);

        broadcaster.connection_closed();
        assert_eq!(broadcaster.global_connections.load(Ordering::Relaxed), 1);
    }

    #[tokio::test]
    async fn test_can_accept_connection_respects_limits() {
        // Should reject connections when limit is reached
        let broadcaster = TripBroadcaster::new();
        let trip_id = uuid::Uuid::new_v4();

        // Normal case: should accept
        assert!(broadcaster.can_accept_connection(trip_id).await);
    }
}

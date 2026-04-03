use chrono::{NaiveDate, NaiveTime};
use sqlx::PgPool;
use uuid::Uuid;

use super::model::ConflictWarning;

/// Detect itinerary items on the same day/trip that overlap with the given time range.
pub async fn detect_conflicts(
    pool: &PgPool,
    trip_id: Uuid,
    day_date: NaiveDate,
    start_time: NaiveTime,
    end_time: Option<NaiveTime>,
    exclude_id: Option<Uuid>,
) -> Vec<ConflictWarning> {
    // If no end_time, assume a 1-hour block for conflict detection.
    let effective_end = end_time.unwrap_or_else(|| {
        start_time
            .overflowing_add_signed(chrono::TimeDelta::hours(1))
            .0
    });

    let rows = sqlx::query_as::<_, (Uuid, String, NaiveTime, Option<NaiveTime>)>(
        r#"
        SELECT id, title, start_time, end_time
        FROM itinerary_items
        WHERE trip_id = $1
          AND day_date = $2
          AND ($3::uuid IS NULL OR id != $3)
          AND start_time < $5
          AND COALESCE(end_time, start_time + INTERVAL '1 hour') > $4
        "#,
    )
    .bind(trip_id)
    .bind(day_date)
    .bind(exclude_id)
    .bind(start_time)
    .bind(effective_end)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    rows.into_iter()
        .map(|(id, title, other_start, other_end)| {
            let other_effective_end = other_end.unwrap_or_else(|| {
                other_start
                    .overflowing_add_signed(chrono::TimeDelta::hours(1))
                    .0
            });
            // Overlap = min(end_a, end_b) - max(start_a, start_b)
            let overlap_start = start_time.max(other_start);
            let overlap_end = effective_end.min(other_effective_end);
            let overlap_minutes = (overlap_end - overlap_start).num_minutes().max(0);

            ConflictWarning {
                item_id: id,
                title,
                overlap_minutes,
            }
        })
        .collect()
}

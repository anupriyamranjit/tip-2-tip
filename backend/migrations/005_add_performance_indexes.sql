-- Composite index for frequent trip_members(trip_id, user_id) lookups
-- Used by verify_trip_member in every pin/document endpoint
CREATE INDEX IF NOT EXISTS idx_trip_members_trip_user ON trip_members(trip_id, user_id);

-- Index for document authorization checks by uploader
CREATE INDEX IF NOT EXISTS idx_pin_documents_uploaded_by ON pin_documents(uploaded_by);

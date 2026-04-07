-- Composite indexes for common query patterns (pagination + ordering)
CREATE INDEX IF NOT EXISTS idx_activity_pins_trip_created ON activity_pins(trip_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_trip_created ON expenses(trip_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pin_documents_pin_created ON pin_documents(pin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pin_votes_pin_id ON pin_votes(pin_id);
CREATE INDEX IF NOT EXISTS idx_activity_pins_trip_status ON activity_pins(trip_id, status);

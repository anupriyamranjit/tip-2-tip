-- Expenses table for trip budget tracking.
-- Supports both manual entries and auto-imported confirmed activity pins.
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    activity_pin_id UUID REFERENCES activity_pins(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
    category VARCHAR(50) NOT NULL DEFAULT 'other',
    split_type VARCHAR(20) NOT NULL DEFAULT 'shared' CHECK (split_type IN ('shared', 'personal')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_trip_id ON expenses(trip_id);
CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE UNIQUE INDEX idx_expenses_pin_unique ON expenses(activity_pin_id) WHERE activity_pin_id IS NOT NULL;

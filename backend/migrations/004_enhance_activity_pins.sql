-- Add scheduled time and price to activity_pins
ALTER TABLE activity_pins
    ADD COLUMN scheduled_at TIMESTAMPTZ,
    ADD COLUMN price_cents INTEGER;

CREATE INDEX idx_activity_pins_scheduled_at ON activity_pins(scheduled_at);

-- Document attachments (one pin -> many documents)
CREATE TABLE pin_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pin_id UUID NOT NULL REFERENCES activity_pins(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pin_documents_pin_id ON pin_documents(pin_id);

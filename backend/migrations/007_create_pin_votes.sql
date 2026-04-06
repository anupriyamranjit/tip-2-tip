-- Pin votes: each trip member can upvote (+1) or downvote (-1) each pin once
CREATE TABLE IF NOT EXISTS pin_votes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pin_id     UUID NOT NULL REFERENCES activity_pins(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote       SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (pin_id, user_id)
);

CREATE INDEX idx_pin_votes_pin_id ON pin_votes(pin_id);
CREATE INDEX idx_pin_votes_user_id ON pin_votes(user_id);

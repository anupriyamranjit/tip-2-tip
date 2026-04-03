-- Users
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    avatar        TEXT NOT NULL DEFAULT '',
    color         TEXT NOT NULL DEFAULT '#2563eb',
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trips
CREATE TABLE trips (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,
    destination  TEXT NOT NULL,
    start_date   DATE NOT NULL,
    end_date     DATE NOT NULL,
    cover_emoji  TEXT NOT NULL DEFAULT '',
    total_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency     TEXT NOT NULL DEFAULT 'CAD',
    created_by   UUID NOT NULL REFERENCES users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trip members
CREATE TYPE member_role AS ENUM ('organizer', 'editor', 'viewer');

CREATE TABLE trip_members (
    trip_id   UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role      member_role NOT NULL DEFAULT 'editor',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (trip_id, user_id)
);

-- Trip invites
CREATE TABLE trip_invites (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id    UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    email      TEXT NOT NULL,
    invited_by UUID NOT NULL REFERENCES users(id),
    status     TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (trip_id, email)
);

-- Trip preferences
CREATE TABLE trip_preferences (
    trip_id             UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    travel_styles       TEXT[] NOT NULL DEFAULT '{}',
    accommodation_types TEXT[] NOT NULL DEFAULT '{}',
    dietary_restrictions TEXT,
    PRIMARY KEY (trip_id, user_id)
);

-- Expenses
CREATE TYPE expense_category AS ENUM ('food', 'transport', 'lodging', 'activity', 'other');

CREATE TABLE expenses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id     UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount      NUMERIC(12,2) NOT NULL,
    currency    TEXT NOT NULL,
    paid_by     UUID NOT NULL REFERENCES users(id),
    category    expense_category NOT NULL DEFAULT 'other',
    date        DATE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE expense_splits (
    expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id),
    share      NUMERIC(12,2) NOT NULL,
    PRIMARY KEY (expense_id, user_id)
);

-- Itinerary
CREATE TYPE itinerary_category AS ENUM ('flight', 'hotel', 'food', 'activity', 'transport');
CREATE TYPE itinerary_status AS ENUM ('confirmed', 'proposed');

CREATE TABLE itinerary_items (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id    UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    day_date   DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time   TIME,
    title      TEXT NOT NULL,
    location   TEXT NOT NULL DEFAULT '',
    category   itinerary_category NOT NULL,
    status     itinerary_status NOT NULL DEFAULT 'proposed',
    notes      TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_itinerary_trip_day ON itinerary_items(trip_id, day_date);

-- Document vault
CREATE TABLE documents (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id      UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    uploaded_by  UUID NOT NULL REFERENCES users(id),
    file_name    TEXT NOT NULL,
    file_type    TEXT NOT NULL,
    file_size    BIGINT NOT NULL,
    storage_path TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Polls
CREATE TABLE polls (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id    UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    question   TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    is_closed  BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE poll_options (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id    UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    label      TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE poll_votes (
    poll_option_id UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
    user_id        UUID NOT NULL REFERENCES users(id),
    value          SMALLINT NOT NULL CHECK (value IN (-1, 1)),
    voted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (poll_option_id, user_id)
);

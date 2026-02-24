-- Migration: Create reports table (replaces MongoDB Report)

CREATE TABLE IF NOT EXISTS reports (
    id BIGSERIAL PRIMARY KEY,
    active_time BIGINT,
    user_description TEXT,
    createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Migration: Create notifications table (replaces MongoDB Notification)
-- Requires: users (019)

CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    avatar_url VARCHAR(255),
    type VARCHAR(50) NOT NULL CHECK (type IN ('info', 'alert', 'warning', 'news', 'updates')),
    posted_at TIMESTAMPTZ NOT NULL,
    is_unread BOOLEAN DEFAULT TRUE,
    url VARCHAR(255),
    createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_posted_at ON notifications(posted_at DESC);

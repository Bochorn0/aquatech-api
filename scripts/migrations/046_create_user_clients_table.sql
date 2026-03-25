-- Migration: add many-to-many relation users <-> clients
-- Keeps compatibility with legacy users.client_id by seeding from it.

CREATE TABLE IF NOT EXISTS user_clients (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_user_clients_user_id ON user_clients (user_id);
CREATE INDEX IF NOT EXISTS idx_user_clients_client_id ON user_clients (client_id);

INSERT INTO user_clients (user_id, client_id)
SELECT id, client_id
FROM users
WHERE client_id IS NOT NULL
ON CONFLICT (user_id, client_id) DO NOTHING;

COMMENT ON TABLE user_clients IS 'Many-to-many client access for users';


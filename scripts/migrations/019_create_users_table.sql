-- Migration: Create users table (PostgreSQL)
-- Replaces MongoDB User model for auth
-- Usage: bash scripts/migrations/run-migration.sh scripts/migrations/019_create_users_table.sql
-- Requires: roles (018), clients (007)

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role_id BIGINT NOT NULL REFERENCES roles(id),
    client_id BIGINT REFERENCES clients(id),
    postgres_client_id BIGINT REFERENCES clients(id),
    active_time INTEGER DEFAULT 0,
    protected BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'inactive')),
    verified BOOLEAN DEFAULT FALSE,
    avatar VARCHAR(500) DEFAULT '/assets/icons/navbar/ic-user.svg',
    nombre VARCHAR(255) DEFAULT '',
    puesto VARCHAR(255) DEFAULT '',
    user_description TEXT DEFAULT '',
    mqtt_zip_password VARCHAR(255) DEFAULT '',
    reset_token VARCHAR(255) DEFAULT NULL,
    reset_token_expiry TIMESTAMPTZ DEFAULT NULL,
    createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users (role_id);
CREATE INDEX IF NOT EXISTS idx_users_client_id ON users (client_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users (reset_token) WHERE reset_token IS NOT NULL;

COMMENT ON TABLE users IS 'Users for auth (replaces MongoDB User)';

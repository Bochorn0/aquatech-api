-- Migration: Create roles table (PostgreSQL)
-- Replaces MongoDB Role model for auth
-- Usage: bash scripts/migrations/run-migration.sh scripts/migrations/018_create_roles_table.sql

CREATE TABLE IF NOT EXISTS roles (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    protected BOOLEAN DEFAULT FALSE,
    permissions TEXT[] DEFAULT '{}',
    dashboard_version VARCHAR(20) DEFAULT 'v1' CHECK (dashboard_version IN ('v1', 'v2', 'both')),
    createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_roles_name ON roles (LOWER(name));

COMMENT ON TABLE roles IS 'User roles with permissions (replaces MongoDB Role)';

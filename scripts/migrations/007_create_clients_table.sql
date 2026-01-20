-- Migration: Create clients table (v2.0 - PostgreSQL)
-- This table stores client information
-- Run this migration after setting up PostgreSQL
-- Usage: psql -U tiwater_user -d tiwater_timeseries -f scripts/migrations/007_create_clients_table.sql

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
    id BIGSERIAL PRIMARY KEY,
    
    -- Client information
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50) DEFAULT NULL,
    protected BOOLEAN DEFAULT FALSE,
    
    -- Address (stored as JSONB for flexibility)
    address JSONB DEFAULT NULL,
    
    -- Timestamps
    createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients (name);
CREATE INDEX IF NOT EXISTS idx_clients_createdat ON clients (createdat DESC);

-- Create function to automatically update updatedat timestamp
CREATE OR REPLACE FUNCTION update_clients_updatedat_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedat = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updatedat
DROP TRIGGER IF EXISTS update_clients_updatedat ON clients;
CREATE TRIGGER update_clients_updatedat
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_clients_updatedat_column();

-- Add comments for documentation
COMMENT ON TABLE clients IS 'Client information (v2.0)';
COMMENT ON COLUMN clients.id IS 'Primary key, auto-incrementing';
COMMENT ON COLUMN clients.email IS 'Unique email address';
COMMENT ON COLUMN clients.address IS 'Address information stored as JSON';

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ clients table created successfully';
    RAISE NOTICE '✅ Indexes created for optimized queries';
    RAISE NOTICE '✅ Auto-update trigger for updatedat created';
END $$;

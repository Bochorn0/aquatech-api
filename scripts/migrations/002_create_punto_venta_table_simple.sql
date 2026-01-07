-- Migration: Create puntoventa table in PostgreSQL (Simple version without function)
-- This table stores punto de venta (store/sales point) information
-- Run this migration after setting up PostgreSQL + TimescaleDB
-- Usage: psql -U TIWater_user -d TIWater_timeseries -f scripts/migrations/002_create_punto_venta_table_simple.sql

-- Create puntoventa table
-- All fields except id and code are nullable with defaults as requested
CREATE TABLE IF NOT EXISTS puntoventa (
    id BIGSERIAL PRIMARY KEY,
    
    -- Basic information
    name VARCHAR(255) DEFAULT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,  -- codigo_tienda (e.g., MX-001) - must be unique
    codigo_tienda VARCHAR(100) UNIQUE,  -- Alias for code, for compatibility
    
    -- Timestamps
    createdAt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Relationships
    owner VARCHAR(255) DEFAULT NULL,
    clientId VARCHAR(255) DEFAULT NULL,
    
    -- Status and location
    status VARCHAR(50) DEFAULT NULL,
    lat DECIMAL(10, 8) DEFAULT NULL,  -- Latitude with 8 decimal precision
    long DECIMAL(11, 8) DEFAULT NULL, -- Longitude with 8 decimal precision
    address TEXT DEFAULT NULL,
    contactId VARCHAR(255) DEFAULT NULL,
    
    -- Metadata
    meta JSONB DEFAULT NULL
);

-- Create unique index on code (already has UNIQUE constraint, but index helps with lookups)
CREATE INDEX IF NOT EXISTS idx_punto_venta_code ON puntoventa (code);
CREATE INDEX IF NOT EXISTS idx_punto_venta_codigo_tienda ON puntoventa (codigo_tienda) WHERE codigo_tienda IS NOT NULL;

-- Create index on clientId for filtering
CREATE INDEX IF NOT EXISTS idx_punto_venta_client_id ON puntoventa (clientId) WHERE clientId IS NOT NULL;

-- Create index on status
CREATE INDEX IF NOT EXISTS idx_punto_venta_status ON puntoventa (status) WHERE status IS NOT NULL;

-- Create index on createdAt for time-based queries
CREATE INDEX IF NOT EXISTS idx_punto_venta_created_at ON puntoventa (createdAt DESC);

-- Create function to automatically update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_punto_venta_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedAt = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updatedAt
DROP TRIGGER IF EXISTS update_punto_venta_updated_at ON puntoventa;
CREATE TRIGGER update_punto_venta_updated_at
    BEFORE UPDATE ON puntoventa
    FOR EACH ROW
    EXECUTE FUNCTION update_punto_venta_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE puntoventa IS 'Stores punto de venta (store/sales point) information';
COMMENT ON COLUMN puntoventa.id IS 'Primary key, auto-incrementing';
COMMENT ON COLUMN puntoventa.code IS 'Unique code for punto de venta (e.g., MX-001)';
COMMENT ON COLUMN puntoventa.codigo_tienda IS 'Store code (alias for code, for compatibility)';
COMMENT ON COLUMN puntoventa.name IS 'Name of the punto de venta';
COMMENT ON COLUMN puntoventa.clientId IS 'Client ID who owns this punto de venta';
COMMENT ON COLUMN puntoventa.lat IS 'Latitude coordinate';
COMMENT ON COLUMN puntoventa.long IS 'Longitude coordinate';
COMMENT ON COLUMN puntoventa.address IS 'Physical address';
COMMENT ON COLUMN puntoventa.meta IS 'Additional metadata in JSON format';

-- Grant permissions (adjust user as needed)
GRANT ALL PRIVILEGES ON TABLE puntoventa TO TIWater_user;
GRANT USAGE, SELECT ON SEQUENCE puntoventa_id_seq TO TIWater_user;

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ puntoventa table created successfully';
    RAISE NOTICE '✅ Indexes created for optimized queries';
    RAISE NOTICE '✅ Auto-update trigger for updatedAt created';
END $$;


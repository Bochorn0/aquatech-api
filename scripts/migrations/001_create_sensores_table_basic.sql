-- Migration: Create sensores table (basic version without TimescaleDB)
-- Run this if TimescaleDB is not yet configured
-- Usage: psql -U tiwater_user -d tiwater_timeseries -f scripts/migrations/001_create_sensores_table_basic.sql

-- Create sensores table
-- All fields except id are nullable with defaults as requested
CREATE TABLE IF NOT EXISTS sensores (
    id BIGSERIAL PRIMARY KEY,
    
    -- Basic sensor information
    name VARCHAR(255) DEFAULT NULL,
    value DECIMAL(20, 6) DEFAULT NULL,  -- Supports large numbers with 6 decimal places
    type VARCHAR(100) DEFAULT NULL,
    
    -- Timestamps
    timestamp TIMESTAMPTZ DEFAULT NULL,
    createdAt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata and relationships
    meta JSONB DEFAULT NULL,
    resourceId VARCHAR(255) DEFAULT NULL,
    resourceType VARCHAR(100) DEFAULT NULL,
    ownerId VARCHAR(255) DEFAULT NULL,
    clientId VARCHAR(255) DEFAULT NULL,
    
    -- Status and location
    status VARCHAR(50) DEFAULT NULL,
    label VARCHAR(255) DEFAULT NULL,
    lat DECIMAL(10, 8) DEFAULT NULL,  -- Latitude with 8 decimal precision
    long DECIMAL(11, 8) DEFAULT NULL, -- Longitude with 8 decimal precision
    codigoTienda VARCHAR(100) DEFAULT NULL
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_sensores_timestamp ON sensores (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sensores_codigo_tienda ON sensores (codigoTienda);
CREATE INDEX IF NOT EXISTS idx_sensores_resource ON sensores (resourceId, resourceType);
CREATE INDEX IF NOT EXISTS idx_sensores_client ON sensores (clientId);
CREATE INDEX IF NOT EXISTS idx_sensores_type ON sensores (type);
CREATE INDEX IF NOT EXISTS idx_sensores_status ON sensores (status);
CREATE INDEX IF NOT EXISTS idx_sensores_created_at ON sensores (createdAt DESC);

-- Composite index for common queries (tienda + timestamp)
CREATE INDEX IF NOT EXISTS idx_sensores_tienda_timestamp ON sensores (codigoTienda, timestamp DESC);

-- Composite index for resource queries
CREATE INDEX IF NOT EXISTS idx_sensores_resource_timestamp ON sensores (resourceId, resourceType, timestamp DESC);

-- GIN index for JSONB meta field (for efficient JSON queries)
CREATE INDEX IF NOT EXISTS idx_sensores_meta_gin ON sensores USING GIN (meta);

-- Create function to automatically update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedAt = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updatedAt
DROP TRIGGER IF EXISTS update_sensores_updated_at ON sensores;
CREATE TRIGGER update_sensores_updated_at
    BEFORE UPDATE ON sensores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE sensores IS 'Time-series table for sensor readings from MQTT messages';
COMMENT ON COLUMN sensores.id IS 'Primary key, auto-incrementing';
COMMENT ON COLUMN sensores.name IS 'Sensor name/identifier';
COMMENT ON COLUMN sensores.value IS 'Sensor reading value';
COMMENT ON COLUMN sensores.type IS 'Type of sensor (e.g., water_level, flux, pressure, tds)';
COMMENT ON COLUMN sensores.timestamp IS 'Timestamp when the sensor reading was taken';
COMMENT ON COLUMN sensores.meta IS 'Additional metadata in JSON format';
COMMENT ON COLUMN sensores.resourceId IS 'ID of the resource (controller, product, etc.)';
COMMENT ON COLUMN sensores.resourceType IS 'Type of resource (controller, product, etc.)';
COMMENT ON COLUMN sensores.codigoTienda IS 'Store/sales point code';

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ sensores table created successfully';
    RAISE NOTICE '✅ Indexes created for optimized queries';
    RAISE NOTICE '✅ Auto-update trigger for updatedAt created';
    RAISE NOTICE '⚠️  Note: TimescaleDB hypertable not created. Run timescaledb_move.sh and restart PostgreSQL to enable.';
END $$;


-- Migration: Create puntoVenta table in PostgreSQL
-- This table stores punto de venta (store/sales point) information
-- Run this migration after setting up PostgreSQL + TimescaleDB
-- Usage: psql -U TIWater_user -d TIWater_timeseries -f scripts/migrations/002_create_punto_venta_table.sql

-- Create puntoVenta table
-- All fields except id are nullable with defaults as requested
CREATE TABLE IF NOT EXISTS puntoVenta (
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
CREATE INDEX IF NOT EXISTS idx_punto_venta_code ON puntoVenta (code);
CREATE INDEX IF NOT EXISTS idx_punto_venta_codigo_tienda ON puntoVenta (codigo_tienda) WHERE codigo_tienda IS NOT NULL;

-- Create index on clientId for filtering
CREATE INDEX IF NOT EXISTS idx_punto_venta_client_id ON puntoVenta (clientId) WHERE clientId IS NOT NULL;

-- Create index on status
CREATE INDEX IF NOT EXISTS idx_punto_venta_status ON puntoVenta (status) WHERE status IS NOT NULL;

-- Create index on createdAt for time-based queries
CREATE INDEX IF NOT EXISTS idx_punto_venta_created_at ON puntoVenta (createdAt DESC);

-- Create function to automatically update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_punto_venta_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedAt = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updatedAt
DROP TRIGGER IF EXISTS update_punto_venta_updated_at ON puntoVenta;
CREATE TRIGGER update_punto_venta_updated_at
    BEFORE UPDATE ON puntoVenta
    FOR EACH ROW
    EXECUTE FUNCTION update_punto_venta_updated_at_column();

-- Function to insert or get puntoVenta by code
CREATE OR REPLACE FUNCTION get_or_create_punto_venta(
    p_code VARCHAR(100),
    p_codigo_tienda VARCHAR(100) DEFAULT NULL,
    p_name VARCHAR(255) DEFAULT NULL,
    p_owner VARCHAR(255) DEFAULT NULL,
    p_client_id VARCHAR(255) DEFAULT NULL,
    p_status VARCHAR(50) DEFAULT NULL,
    p_lat DECIMAL(10, 8) DEFAULT NULL,
    p_long DECIMAL(11, 8) DEFAULT NULL,
    p_address TEXT DEFAULT NULL,
    p_contact_id VARCHAR(255) DEFAULT NULL,
    p_meta JSONB DEFAULT NULL
)
RETURNS TABLE (
    id BIGINT,
    name VARCHAR(255),
    code VARCHAR(100),
    codigo_tienda VARCHAR(100),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    owner VARCHAR(255),
    client_id VARCHAR(255),
    status VARCHAR(50),
    lat DECIMAL(10, 8),
    long DECIMAL(11, 8),
    address TEXT,
    contact_id VARCHAR(255),
    meta JSONB
) AS $$
DECLARE
    v_id BIGINT;
    v_code VARCHAR(100);
    v_codigo_tienda VARCHAR(100);
BEGIN
    -- Use code or codigo_tienda (code takes priority)
    v_code := COALESCE(p_code, p_codigo_tienda);
    v_codigo_tienda := COALESCE(p_codigo_tienda, p_code);
    
    -- Try to find existing puntoVenta by code or codigo_tienda
    SELECT puntoVenta.id INTO v_id
    FROM puntoVenta
    WHERE puntoVenta.code = v_code 
       OR puntoVenta.codigo_tienda = v_code
       OR puntoVenta.codigo_tienda = v_codigo_tienda
    LIMIT 1;
    
    -- If not found, insert new one with default values
    IF v_id IS NULL THEN
        INSERT INTO puntoVenta (
            name, code, codigo_tienda, owner, clientId, status, 
            lat, long, address, contactId, meta
        ) VALUES (
            COALESCE(p_name, NULL),
            v_code,
            v_codigo_tienda,
            COALESCE(p_owner, NULL),
            COALESCE(p_client_id, NULL),
            COALESCE(p_status, 'active'),
            COALESCE(p_lat, NULL),
            COALESCE(p_long, NULL),
            COALESCE(p_address, NULL),
            COALESCE(p_contact_id, NULL),
            COALESCE(p_meta, NULL)
        ) RETURNING puntoVenta.id INTO v_id;
    ELSE
        -- Update if new data provided (only update non-null values)
        UPDATE puntoVenta
        SET 
            name = COALESCE(p_name, puntoVenta.name),
            owner = COALESCE(p_owner, puntoVenta.owner),
            clientId = COALESCE(p_client_id, puntoVenta.clientId),
            status = COALESCE(p_status, puntoVenta.status),
            lat = COALESCE(p_lat, puntoVenta.lat),
            long = COALESCE(p_long, puntoVenta.long),
            address = COALESCE(p_address, puntoVenta.address),
            contactId = COALESCE(p_contact_id, puntoVenta.contactId),
            meta = COALESCE(p_meta, puntoVenta.meta),
            updatedAt = CURRENT_TIMESTAMP
        WHERE puntoVenta.id = v_id;
    END IF;
    
    -- Return the puntoVenta record
    RETURN QUERY
    SELECT 
        puntoVenta.id,
        puntoVenta.name,
        puntoVenta.code,
        puntoVenta.codigo_tienda,
        puntoVenta.createdAt,
        puntoVenta.updatedAt,
        puntoVenta.owner,
        puntoVenta.clientId,
        puntoVenta.status,
        puntoVenta.lat,
        puntoVenta.long,
        puntoVenta.address,
        puntoVenta.contactId,
        puntoVenta.meta
    FROM puntoVenta
    WHERE puntoVenta.id = v_id;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE puntoVenta IS 'Stores punto de venta (store/sales point) information';
COMMENT ON COLUMN puntoVenta.id IS 'Primary key, auto-incrementing';
COMMENT ON COLUMN puntoVenta.code IS 'Unique code for punto de venta (e.g., MX-001)';
COMMENT ON COLUMN puntoVenta.codigo_tienda IS 'Store code (alias for code, for compatibility)';
COMMENT ON COLUMN puntoVenta.name IS 'Name of the punto de venta';
COMMENT ON COLUMN puntoVenta.clientId IS 'Client ID who owns this punto de venta';
COMMENT ON COLUMN puntoVenta.lat IS 'Latitude coordinate';
COMMENT ON COLUMN puntoVenta.long IS 'Longitude coordinate';
COMMENT ON COLUMN puntoVenta.address IS 'Physical address';
COMMENT ON COLUMN puntoVenta.meta IS 'Additional metadata in JSON format';

-- Grant permissions (adjust user as needed)
-- GRANT ALL PRIVILEGES ON TABLE puntoVenta TO TIWater_user;
-- GRANT USAGE, SELECT ON SEQUENCE puntoVenta_id_seq TO TIWater_user;

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ puntoVenta table created successfully';
    RAISE NOTICE '✅ Indexes created for optimized queries';
    RAISE NOTICE '✅ Auto-update trigger for updatedAt created';
    RAISE NOTICE '✅ Function get_or_create_punto_venta created for automatic insertion';
END $$;


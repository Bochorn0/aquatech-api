-- Migration: Create puntoVenta table in PostgreSQL
-- This table stores punto de venta (store/sales point) information
-- Run this migration after setting up PostgreSQL + TimescaleDB
-- Usage: psql -U TIWater_user -d TIWater_timeseries -f scripts/migrations/002_create_punto_venta_table.sql

-- Create puntoventa table (PostgreSQL converts to lowercase)
-- All fields except id are nullable with defaults as requested
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
    
    -- Try to find existing puntoventa by code or codigo_tienda
    SELECT puntoventa.id INTO v_id
    FROM puntoventa
    WHERE puntoventa.code = v_code 
       OR puntoventa.codigo_tienda = v_code
       OR puntoventa.codigo_tienda = v_codigo_tienda
    LIMIT 1;
    
    -- If not found, insert new one with default values
    IF v_id IS NULL THEN
        INSERT INTO puntoventa (
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
        ) RETURNING puntoventa.id INTO v_id;
    ELSE
        -- Update if new data provided (only update non-null values)
        UPDATE puntoventa
        SET 
            name = COALESCE(p_name, puntoventa.name),
            owner = COALESCE(p_owner, puntoventa.owner),
            clientId = COALESCE(p_client_id, puntoventa.clientId),
            status = COALESCE(p_status, puntoventa.status),
            lat = COALESCE(p_lat, puntoventa.lat),
            long = COALESCE(p_long, puntoventa.long),
            address = COALESCE(p_address, puntoventa.address),
            contactId = COALESCE(p_contact_id, puntoventa.contactId),
            meta = COALESCE(p_meta, puntoventa.meta),
            updatedAt = CURRENT_TIMESTAMP
        WHERE puntoventa.id = v_id;
    END IF;
    
    -- Return the puntoventa record
    RETURN QUERY
    SELECT 
        puntoventa.id,
        puntoventa.name,
        puntoventa.code,
        puntoventa.codigo_tienda,
        puntoventa.createdAt,
        puntoventa.updatedAt,
        puntoventa.owner,
        puntoventa.clientId,
        puntoventa.status,
        puntoventa.lat,
        puntoventa.long,
        puntoventa.address,
        puntoventa.contactId,
        puntoventa.meta
    FROM puntoventa
    WHERE puntoventa.id = v_id;
END;
$$ LANGUAGE plpgsql;

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
-- GRANT ALL PRIVILEGES ON TABLE puntoventa TO TIWater_user;
-- GRANT USAGE, SELECT ON SEQUENCE puntoventa_id_seq TO TIWater_user;

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ puntoventa table created successfully';
    RAISE NOTICE '✅ Indexes created for optimized queries';
    RAISE NOTICE '✅ Auto-update trigger for updatedAt created';
    RAISE NOTICE '✅ Function get_or_create_punto_venta created for automatic insertion';
END $$;


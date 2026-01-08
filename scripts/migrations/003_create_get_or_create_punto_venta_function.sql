-- Migration: Create get_or_create_punto_venta function
-- This function allows atomic get-or-create operations for puntoVenta
-- Usage: psql -U TIWater_user -d TIWater_timeseries -f scripts/migrations/003_create_get_or_create_punto_venta_function.sql

-- Drop function if exists to avoid errors
DROP FUNCTION IF EXISTS get_or_create_punto_venta(VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, DECIMAL, DECIMAL, TEXT, VARCHAR, JSONB);

-- Create function to get or create puntoVenta
-- Note: PostgreSQL converts unquoted identifiers to lowercase, so clientId becomes clientid
CREATE OR REPLACE FUNCTION get_or_create_punto_venta(
    p_code VARCHAR(100),
    p_codigo_tienda VARCHAR(100),
    p_name VARCHAR(255),
    p_owner VARCHAR(255),
    p_clientId VARCHAR(255),
    p_status VARCHAR(50),
    p_lat DECIMAL(10, 8),
    p_long DECIMAL(11, 8),
    p_address TEXT,
    p_contactId VARCHAR(255),
    p_meta JSONB
)
RETURNS TABLE (
    id BIGINT,
    name VARCHAR(255),
    code VARCHAR(100),
    codigo_tienda VARCHAR(100),
    createdat TIMESTAMPTZ,
    updatedat TIMESTAMPTZ,
    owner VARCHAR(255),
    clientid VARCHAR(255),
    status VARCHAR(50),
    lat DECIMAL(10, 8),
    long DECIMAL(11, 8),
    address TEXT,
    contactid VARCHAR(255),
    meta JSONB
) AS $$
DECLARE
    v_code VARCHAR(100);
    v_result RECORD;
BEGIN
    -- Use code or codigo_tienda, prioritizing code
    v_code := COALESCE(p_code, p_codigo_tienda);
    
    -- Try to find existing record
    SELECT * INTO v_result
    FROM puntoventa p
    WHERE p.code = v_code OR p.codigo_tienda = v_code
    LIMIT 1;
    
    -- If found, return it
    IF v_result IS NOT NULL THEN
        RETURN QUERY SELECT 
            v_result.id,
            v_result.name,
            v_result.code,
            v_result.codigo_tienda,
            v_result.createdat,
            v_result.updatedat,
            v_result.owner,
            v_result.clientid,
            v_result.status,
            v_result.lat,
            v_result.long,
            v_result.address,
            v_result.contactid,
            v_result.meta;
        RETURN;
    END IF;
    
    -- If not found, create new record
    -- Handle race conditions where another process might create the record concurrently
    BEGIN
        INSERT INTO puntoventa (
            name, code, codigo_tienda, owner, clientid, status,
            lat, long, address, contactid, meta
        ) VALUES (
            p_name,
            v_code,
            COALESCE(p_codigo_tienda, v_code),
            p_owner,
            p_clientId,
            COALESCE(p_status, 'active'),
            p_lat,
            p_long,
            p_address,
            p_contactId,
            p_meta
        )
        RETURNING * INTO v_result;
    EXCEPTION
        WHEN unique_violation THEN
            -- Another process created it concurrently, fetch it
            SELECT * INTO v_result
            FROM puntoventa p
            WHERE p.code = v_code OR p.codigo_tienda = v_code
            LIMIT 1;
    END;
    
    -- If we still don't have a result (shouldn't happen, but safety check)
    IF v_result IS NULL THEN
        SELECT * INTO v_result
        FROM puntoventa p
        WHERE p.code = v_code OR p.codigo_tienda = v_code
        LIMIT 1;
    END IF;
    
    -- Return created or found record
    IF v_result IS NOT NULL THEN
        RETURN QUERY SELECT 
            v_result.id,
            v_result.name,
            v_result.code,
            v_result.codigo_tienda,
            v_result.createdat,
            v_result.updatedat,
            v_result.owner,
            v_result.clientid,
            v_result.status,
            v_result.lat,
            v_result.long,
            v_result.address,
            v_result.contactid,
            v_result.meta;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION get_or_create_punto_venta IS 'Gets existing puntoVenta by code/codigo_tienda or creates a new one if it does not exist';

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ get_or_create_punto_venta function created successfully';
END $$;

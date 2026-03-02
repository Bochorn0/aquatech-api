-- Migration: Create puntoventa_v1 table (V1: equipos/products, metrics)
-- Separates V1 (equipos matching, metrics) from V2 (MQTT sensors, region, ciudad)
-- REQUIRES: puntoventa table (migration 002)
-- Usage: psql -U TIWater_user -d TIWater_timeseries -f scripts/migrations/029_create_puntoventa_v1.sql

-- Create puntoventa_v1 table (V1 flow: equipos/products join, metrics)
CREATE TABLE IF NOT EXISTS puntoventa_v1 (
    id BIGSERIAL PRIMARY KEY,
    
    -- Link to V2 puntoventa (optional, for sync/correlation)
    puntoventa_id BIGINT REFERENCES puntoventa(id) ON DELETE SET NULL,
    
    -- Basic information (same as puntoventa)
    name VARCHAR(255) DEFAULT NULL,
    code VARCHAR(100) UNIQUE NOT NULL,
    codigo_tienda VARCHAR(100) UNIQUE,
    
    -- Timestamps
    createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Relationships
    owner VARCHAR(255) DEFAULT NULL,
    clientid VARCHAR(255) DEFAULT NULL,
    
    -- Status and location
    status VARCHAR(50) DEFAULT NULL,
    lat DECIMAL(10, 8) DEFAULT NULL,
    long DECIMAL(11, 8) DEFAULT NULL,
    address TEXT DEFAULT NULL,
    contactid VARCHAR(255) DEFAULT NULL,
    
    -- Metadata
    meta JSONB DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_puntoventa_v1_code ON puntoventa_v1 (code);
CREATE INDEX IF NOT EXISTS idx_puntoventa_v1_codigo_tienda ON puntoventa_v1 (codigo_tienda) WHERE codigo_tienda IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_puntoventa_v1_clientid ON puntoventa_v1 (clientid) WHERE clientid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_puntoventa_v1_puntoventa_id ON puntoventa_v1 (puntoventa_id) WHERE puntoventa_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_puntoventa_v1_createdat ON puntoventa_v1 (createdat DESC);

CREATE OR REPLACE FUNCTION update_puntoventa_v1_updatedat_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedat = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_puntoventa_v1_updatedat ON puntoventa_v1;
CREATE TRIGGER update_puntoventa_v1_updatedat
    BEFORE UPDATE ON puntoventa_v1
    FOR EACH ROW
    EXECUTE FUNCTION update_puntoventa_v1_updatedat_column();

COMMENT ON TABLE puntoventa_v1 IS 'V1: Punto de venta for equipos/products matching and metrics (separate from V2 MQTT/sensors)';
COMMENT ON COLUMN puntoventa_v1.puntoventa_id IS 'Optional link to puntoventa (V2) for correlation';

-- Copy existing puntoventa data to puntoventa_v1 (one row per puntoventa for metrics migration)
-- Use 'PV1-'||id as code to guarantee uniqueness and 1:1 mapping for migration 030
INSERT INTO puntoventa_v1 (puntoventa_id, name, code, codigo_tienda, createdat, updatedat, owner, clientid, status, lat, long, address, contactid, meta)
SELECT p.id, p.name,
  'PV1-' || p.id,
  NULLIF(TRIM(p.codigo_tienda), ''),
  p.createdat,
  p.updatedat,
  p.owner,
  p.clientid,
  p.status, p.lat, p.long, p.address,
  p.contactid,
  p.meta
FROM puntoventa p
WHERE NOT EXISTS (SELECT 1 FROM puntoventa_v1 pv1 WHERE pv1.puntoventa_id = p.id);

DO $$
BEGIN
    RAISE NOTICE '✅ puntoventa_v1 table created successfully';
    RAISE NOTICE 'ℹ️  Run migration 030 to update metrics to use puntoventa_v1';
END $$;

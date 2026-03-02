-- Migration: Add region_punto_venta join table and ciudad_id to puntoventa
-- REQUIRES: puntoventa table (migration 002) and regions/ciudades (migration 027)
-- Usage: psql -U TIWater_user -d TIWater_timeseries -f scripts/migrations/028_add_region_punto_venta_and_ciudad_id.sql

-- =============================================================================
-- 1. REGION_PUNTO_VENTA JOIN TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS region_punto_venta (
    id BIGSERIAL PRIMARY KEY,
    region_id BIGINT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    punto_venta_id BIGINT NOT NULL REFERENCES puntoventa(id) ON DELETE CASCADE,
    createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(region_id, punto_venta_id)
);

CREATE INDEX IF NOT EXISTS idx_region_pv_region_id ON region_punto_venta (region_id);
CREATE INDEX IF NOT EXISTS idx_region_pv_punto_venta_id ON region_punto_venta (punto_venta_id);
CREATE INDEX IF NOT EXISTS idx_region_pv_createdat ON region_punto_venta (createdat DESC);

COMMENT ON TABLE region_punto_venta IS 'Many-to-many: Region to PuntoVenta';
COMMENT ON COLUMN region_punto_venta.region_id IS 'Foreign key to regions';
COMMENT ON COLUMN region_punto_venta.punto_venta_id IS 'Foreign key to puntoventa';

-- =============================================================================
-- 2. ADD ciudad_id TO PUNTOVENTA
-- =============================================================================
ALTER TABLE puntoventa ADD COLUMN IF NOT EXISTS ciudad_id BIGINT REFERENCES ciudades(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_puntoventa_ciudad_id ON puntoventa (ciudad_id) WHERE ciudad_id IS NOT NULL;

COMMENT ON COLUMN puntoventa.ciudad_id IS 'Foreign key to ciudades (MQTT-sourced city)';

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ region_punto_venta join table created successfully';
    RAISE NOTICE '✅ ciudad_id column added to puntoventa';
END $$;

-- Migration: Create regions and ciudades tables (no puntoventa dependency)
-- For MQTT topic: tiwater/CODIGO_REGION/CIUDAD/CODIGO_TIENDA/data
-- region_punto_venta is in migration 028 (requires puntoventa)
-- Usage: psql -U TIWater_user -d TIWater_timeseries -f scripts/migrations/027_create_regions_ciudades_region_punto_venta.sql

-- =============================================================================
-- 1. REGIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS regions (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL DEFAULT '',
    createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_regions_code ON regions (code);
CREATE INDEX IF NOT EXISTS idx_regions_createdat ON regions (createdat DESC);

COMMENT ON TABLE regions IS 'Geographic regions for MQTT topic hierarchy (e.g. NORTE, CENTRO)';
COMMENT ON COLUMN regions.code IS 'Unique region code from MQTT topic (CODIGO_REGION)';
COMMENT ON COLUMN regions.name IS 'Display name for the region';

-- Trigger for updatedat
CREATE OR REPLACE FUNCTION update_regions_updatedat_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedat = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_regions_updatedat ON regions;
CREATE TRIGGER update_regions_updatedat
    BEFORE UPDATE ON regions
    FOR EACH ROW
    EXECUTE FUNCTION update_regions_updatedat_column();

-- =============================================================================
-- 2. CIUDADES TABLE (MQTT-sourced cities, linked to region)
-- =============================================================================
CREATE TABLE IF NOT EXISTS ciudades (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    region_id BIGINT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, region_id)
);

CREATE INDEX IF NOT EXISTS idx_ciudades_region_id ON ciudades (region_id);
CREATE INDEX IF NOT EXISTS idx_ciudades_name ON ciudades (name);
CREATE INDEX IF NOT EXISTS idx_ciudades_name_region ON ciudades (name, region_id);
CREATE INDEX IF NOT EXISTS idx_ciudades_createdat ON ciudades (createdat DESC);

COMMENT ON TABLE ciudades IS 'Cities from MQTT topic (CIUDAD), linked to region';
COMMENT ON COLUMN ciudades.name IS 'City name from MQTT topic';
COMMENT ON COLUMN ciudades.region_id IS 'Foreign key to regions table';

-- Trigger for updatedat
CREATE OR REPLACE FUNCTION update_ciudades_updatedat_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedat = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ciudades_updatedat ON ciudades;
CREATE TRIGGER update_ciudades_updatedat
    BEFORE UPDATE ON ciudades
    FOR EACH ROW
    EXECUTE FUNCTION update_ciudades_updatedat_column();

-- =============================================================================
-- 3. SEED DEFAULT NoRegion (for backward compatibility)
-- =============================================================================
INSERT INTO regions (code, name) VALUES ('NoRegion', 'Sin región')
ON CONFLICT (code) DO NOTHING;

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ regions table created successfully';
    RAISE NOTICE '✅ ciudades table created successfully';
    RAISE NOTICE '✅ NoRegion default record seeded';
    RAISE NOTICE 'ℹ️  Run migration 028 for region_punto_venta and ciudad_id (requires puntoventa)';
END $$;

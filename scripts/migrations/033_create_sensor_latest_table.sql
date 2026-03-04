-- Migration: Create sensor_latest table
-- Stores only the most recent value per (codigo_tienda, sensor type, resource).
-- Updated every time new data is written to sensores. Use this for "current value" reads
-- instead of scanning the time-series sensores table.
-- Usage: psql -U TIWater_user -d TIWater_timeseries -f scripts/migrations/033_create_sensor_latest_table.sql

CREATE TABLE IF NOT EXISTS sensor_latest (
    id BIGSERIAL PRIMARY KEY,
    codigo_tienda VARCHAR(100) NOT NULL,
    type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255) NOT NULL DEFAULT '',
    resource_type VARCHAR(100) NOT NULL DEFAULT '',
    name VARCHAR(255) DEFAULT NULL,
    value DECIMAL(20, 6) DEFAULT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(codigo_tienda, type, resource_id, resource_type)
);

CREATE INDEX IF NOT EXISTS idx_sensor_latest_codigo_tienda ON sensor_latest (codigo_tienda);
CREATE INDEX IF NOT EXISTS idx_sensor_latest_type ON sensor_latest (type);
CREATE INDEX IF NOT EXISTS idx_sensor_latest_updated_at ON sensor_latest (updated_at DESC);

COMMENT ON TABLE sensor_latest IS 'Latest sensor value per (codigo_tienda, type, resource). Updated on every sensores insert.';
COMMENT ON COLUMN sensor_latest.codigo_tienda IS 'Store/sales point code (matches sensores.codigoTienda)';
COMMENT ON COLUMN sensor_latest.type IS 'Sensor type (e.g. flujo_produccion, tds, electronivel_cruda)';
COMMENT ON COLUMN sensor_latest.value IS 'Most recent reading value';
COMMENT ON COLUMN sensor_latest.timestamp IS 'When the reading was taken (from sensores)';

-- Trigger to refresh updated_at
CREATE OR REPLACE FUNCTION update_sensor_latest_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sensor_latest_updated_at ON sensor_latest;
CREATE TRIGGER update_sensor_latest_updated_at
    BEFORE UPDATE ON sensor_latest
    FOR EACH ROW
    EXECUTE FUNCTION update_sensor_latest_updated_at();

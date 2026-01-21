-- Migration: Create punto_venta_sensors table
-- This table stores sensor configurations/registry for each puntoVenta
-- Run this migration after puntoVenta table exists
-- Usage: psql -U TIWater_user -d TIWater_timeseries -f scripts/migrations/010_create_punto_venta_sensors_table.sql

CREATE TABLE IF NOT EXISTS punto_venta_sensors (
    id BIGSERIAL PRIMARY KEY,
    punto_venta_id BIGINT NOT NULL REFERENCES puntoventa(id) ON DELETE CASCADE,
    
    -- Sensor identification
    sensor_name VARCHAR(255) NOT NULL,  -- e.g., "Flujo Producción", "TDS"
    sensor_type VARCHAR(100) NOT NULL,  -- e.g., "flujo_produccion", "tds"
    resource_id VARCHAR(255) DEFAULT NULL,  -- Optional: equipment/gateway ID
    resource_type VARCHAR(100) DEFAULT NULL,  -- Optional: "osmosis", "tiwater", "nivel"
    
    -- Configuration
    label VARCHAR(255) DEFAULT NULL,  -- Display label
    unit VARCHAR(50) DEFAULT NULL,  -- e.g., "L/min", "ppm", "%"
    min_value DECIMAL(20, 6) DEFAULT NULL,
    max_value DECIMAL(20, 6) DEFAULT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    meta JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint: one sensor type per puntoVenta (unless resource_id differentiates)
    UNIQUE(punto_venta_id, sensor_type, resource_id, resource_type)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_pv_sensors_punto_venta ON punto_venta_sensors(punto_venta_id);
CREATE INDEX IF NOT EXISTS idx_pv_sensors_type ON punto_venta_sensors(sensor_type);
CREATE INDEX IF NOT EXISTS idx_pv_sensors_resource ON punto_venta_sensors(resource_id, resource_type);
CREATE INDEX IF NOT EXISTS idx_pv_sensors_enabled ON punto_venta_sensors(enabled) WHERE enabled = TRUE;

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pv_sensors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_punto_venta_sensors_updated_at ON punto_venta_sensors;
CREATE TRIGGER update_punto_venta_sensors_updated_at
    BEFORE UPDATE ON punto_venta_sensors
    FOR EACH ROW
    EXECUTE FUNCTION update_pv_sensors_updated_at();

-- Add comments for documentation
COMMENT ON TABLE punto_venta_sensors IS 'Sensor configuration/registry table linking sensors to puntos de venta';
COMMENT ON COLUMN punto_venta_sensors.punto_venta_id IS 'Foreign key to puntoventa table';
COMMENT ON COLUMN punto_venta_sensors.sensor_name IS 'Human-readable sensor name';
COMMENT ON COLUMN punto_venta_sensors.sensor_type IS 'Technical sensor type identifier';
COMMENT ON COLUMN punto_venta_sensors.resource_id IS 'Optional resource ID (equipment/gateway)';
COMMENT ON COLUMN punto_venta_sensors.resource_type IS 'Optional resource type (osmosis, tiwater, nivel)';
COMMENT ON COLUMN punto_venta_sensors.enabled IS 'Whether this sensor is active/enabled';

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ punto_venta_sensors table created successfully';
    RAISE NOTICE '✅ Indexes created for optimized queries';
    RAISE NOTICE '✅ Auto-update trigger for updated_at created';
END $$;

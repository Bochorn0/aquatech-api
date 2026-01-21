-- Migration: Alter metrics table to support metric configurations
-- This migration adds support for configurable metric rules with ranges, colors, and sensor mappings
-- Run this migration after 006_create_metrics_table.sql
-- Usage: psql -U TIWater_user -d TIWater_timeseries -f scripts/migrations/011_alter_metrics_table_for_configuration.sql

-- Add new columns for metric configuration
ALTER TABLE metrics 
  ADD COLUMN IF NOT EXISTS metric_name VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS metric_type VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sensor_type VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sensor_unit VARCHAR(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rules JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS conditions JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS read_only BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Create index on metric_type for faster queries
CREATE INDEX IF NOT EXISTS idx_metrics_metric_type ON metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_metrics_sensor_type ON metrics(sensor_type);
CREATE INDEX IF NOT EXISTS idx_metrics_enabled ON metrics(enabled) WHERE enabled = TRUE;

-- Add comments
COMMENT ON COLUMN metrics.metric_name IS 'Human-readable metric name (e.g., TDS, PRODUCCION, EFICIENCIA)';
COMMENT ON COLUMN metrics.metric_type IS 'Metric type identifier (tds, produccion, eficiencia, etc.)';
COMMENT ON COLUMN metrics.sensor_type IS 'Sensor type this metric is based on (tds, flujo_produccion, eficiencia, etc.)';
COMMENT ON COLUMN metrics.sensor_unit IS 'Unit of measurement (PPM, L/MIN, %, PSI, etc.)';
COMMENT ON COLUMN metrics.rules IS 'JSONB array of rules with ranges and colors: [{"min": 50, "max": 70, "color": "#00B050", "label": "Normal"}, ...]';
COMMENT ON COLUMN metrics.conditions IS 'JSONB object for complex conditions (e.g., {"depends_on": "caudal_cruda", "conditions": [...]})';
COMMENT ON COLUMN metrics.enabled IS 'Whether this metric is active';
COMMENT ON COLUMN metrics.read_only IS 'Whether this metric is read-only (e.g., AMPERAJE)';
COMMENT ON COLUMN metrics.display_order IS 'Order for displaying metrics in UI';

-- Example of rules structure:
-- rules: [
--   {"min": 50, "max": 70, "color": "#00B050", "label": "Normal"},
--   {"min": 35, "max": 49, "color": "#FFFF00", "label": "Warning"},
--   {"min": null, "max": 34, "color": "#EE0000", "label": "Critical"},
--   {"min": 71, "max": 99, "color": "#FFFF00", "label": "Warning"},
--   {"min": 100, "max": null, "color": "#EE0000", "label": "Critical"}
-- ]

-- Example of conditions structure (for complex metrics like NIVEL AGUA CRUDA):
-- conditions: {
--   "depends_on": "caudal_cruda",
--   "rules": [
--     {"flujo_condition": ">=0", "level_ranges": [{"min": 75, "max": null, "color": "#00B050", "label": "Normal"}]},
--     {"flujo_condition": "==0", "level_ranges": [{"min": 40, "max": 74, "color": "#FFFF00", "label": "Cisterna sin entrada"}]}
--   ]
-- }

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ metrics table altered successfully';
    RAISE NOTICE '✅ New columns added for metric configuration';
    RAISE NOTICE '✅ Indexes created for optimized queries';
END $$;

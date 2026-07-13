-- Migration: Configurable Tuya logs routine (fields + custom derived rules)
-- Requires: product_logs (024)
-- Usage: psql -U TIWater_user -d TIWater_timeseries -f scripts/migrations/048_tuya_logs_routine_config.sql

CREATE TABLE IF NOT EXISTS tuya_logs_routine_config (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(255)
);

COMMENT ON TABLE tuya_logs_routine_config IS 'Singleton config for fetchLogsRoutine: enabled Tuya DP codes + custom derived metrics';
COMMENT ON COLUMN tuya_logs_routine_config.config IS 'JSONB keyed by product_type (Osmosis, Nivel, ...): enabled_fields + custom_rules';

ALTER TABLE product_logs
  ADD COLUMN IF NOT EXISTS custom_metrics JSONB DEFAULT NULL;

COMMENT ON COLUMN product_logs.custom_metrics IS 'Derived metrics from custom_rules (e.g. produccion_desde_ultima_hora)';

-- Default config matching previous hardcoded Osmosis routine (totals only)
INSERT INTO tuya_logs_routine_config (id, config)
VALUES (
  1,
  '{
    "Osmosis": {
      "enabled_fields": {
        "flowrate_total_1": { "enabled": true, "db_column": "production_volume", "scale": 0.1 },
        "flowrate_total_2": { "enabled": true, "db_column": "rejected_volume", "scale": 0.1 },
        "flowrate_speed_1": { "enabled": true, "db_column": "flujo_produccion", "scale": 1 },
        "flowrate_speed_2": { "enabled": true, "db_column": "flujo_rechazo", "scale": 1 },
        "tds_out": { "enabled": false, "db_column": "tds", "scale": 1 }
      },
      "custom_rules": []
    },
    "Nivel": {
      "enabled_fields": {
        "liquid_depth": { "enabled": true, "db_column": "flujo_produccion", "scale": 1 },
        "liquid_level_percent": { "enabled": true, "db_column": "flujo_rechazo", "scale": 1 }
      },
      "custom_rules": []
    }
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
    RAISE NOTICE '✅ tuya_logs_routine_config created with default Osmosis/Nivel config';
    RAISE NOTICE '✅ product_logs.custom_metrics column added';
END $$;

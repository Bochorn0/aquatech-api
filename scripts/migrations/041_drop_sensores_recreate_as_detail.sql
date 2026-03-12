-- Migration: Drop old sensores (and sensor_details); recreate sensores as detail-only table.
-- New schema: sensores_message (1 row per message, meta once) + sensores (detail: id, sensores_message_id, name, type, value).
-- Usage: psql -U TIWater_user -d TIWater_timeseries -f scripts/migrations/041_drop_sensores_recreate_as_detail.sql
-- WARNING: This drops existing sensores data. Run only when you are ready to use the new structure.

-- Drop old sensores (TimescaleDB hypertable or plain table) and sensor_details from 040
DROP TABLE IF EXISTS sensor_details;
DROP TABLE IF EXISTS sensores CASCADE;

-- Recreate sensores as detail table only (no meta, no codigotienda/timestamp – those are in sensores_message)
CREATE TABLE sensores (
    id BIGSERIAL PRIMARY KEY,
    sensores_message_id BIGINT NOT NULL REFERENCES sensores_message(id) ON DELETE CASCADE,
    name VARCHAR(255) DEFAULT NULL,
    type VARCHAR(100) DEFAULT NULL,
    value DECIMAL(20, 6) DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_sensores_message_id ON sensores (sensores_message_id);
CREATE INDEX IF NOT EXISTS idx_sensores_type ON sensores (type);
CREATE INDEX IF NOT EXISTS idx_sensores_message_id_type ON sensores (sensores_message_id, type);

COMMENT ON TABLE sensores IS 'Detail rows: one per sensor value per message. Join sensores_message for codigotienda, timestamp, meta.';

DO $$
BEGIN
  RAISE NOTICE '✅ sensores recreated as detail table (sensores_message + sensores)';
END $$;

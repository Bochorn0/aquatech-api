-- Migration: Message + detail tables to reduce meta redundancy
-- One row per MQTT message in sensores_message (meta stored once); N rows per message in sensor_details (name, type, value only).
-- Usage: psql -U TIWater_user -d TIWater_timeseries -f scripts/migrations/040_sensores_message_and_sensor_details.sql
--
-- This migration does NOT drop or truncate the existing sensores table.
-- If you need to start fresh (e.g. before switching all reads to sensores_message + sensor_details),
-- run manually when appropriate:
--   TRUNCATE sensores CASCADE;
-- or, if you no longer need the old table:
--   DROP TABLE sensores CASCADE;

-- One row per incoming MQTT message: context + meta (payload) stored once
CREATE TABLE IF NOT EXISTS sensores_message (
    id BIGSERIAL PRIMARY KEY,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    clientid VARCHAR(255) DEFAULT NULL,
    lat DECIMAL(10, 8) DEFAULT NULL,
    long DECIMAL(11, 8) DEFAULT NULL,
    codigotienda VARCHAR(100) DEFAULT NULL,
    resourceid VARCHAR(255) DEFAULT NULL,
    resourcetype VARCHAR(100) DEFAULT NULL,
    meta JSONB DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_sensores_message_timestamp ON sensores_message ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_sensores_message_codigotienda ON sensores_message (codigotienda);
CREATE INDEX IF NOT EXISTS idx_sensores_message_codigo_timestamp ON sensores_message (codigotienda, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_sensores_message_createdat ON sensores_message (createdat DESC);

COMMENT ON TABLE sensores_message IS 'One row per MQTT message; meta (payload) stored once. Detail rows in sensor_details.';

-- One row per sensor reading; no meta duplication (get context from sensores_message)
CREATE TABLE IF NOT EXISTS sensor_details (
    id BIGSERIAL PRIMARY KEY,
    sensores_message_id BIGINT NOT NULL REFERENCES sensores_message(id) ON DELETE CASCADE,
    name VARCHAR(255) DEFAULT NULL,
    type VARCHAR(100) DEFAULT NULL,
    value DECIMAL(20, 6) DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_sensor_details_message_id ON sensor_details (sensores_message_id);
CREATE INDEX IF NOT EXISTS idx_sensor_details_type ON sensor_details (type);
CREATE INDEX IF NOT EXISTS idx_sensor_details_message_id_type ON sensor_details (sensores_message_id, type);

COMMENT ON TABLE sensor_details IS 'One row per sensor value per message; join to sensores_message for codigotienda, timestamp, meta.';

-- Optional: composite index for historico-style queries (codigo + type + time via join)
-- Queries will JOIN sensor_details d ON sensores_message m ON d.sensores_message_id = m.id WHERE m.codigotienda = $1 AND d.type = $2 AND m.timestamp >= $3

DO $$
BEGIN
  RAISE NOTICE '✅ sensores_message and sensor_details tables created';
END $$;

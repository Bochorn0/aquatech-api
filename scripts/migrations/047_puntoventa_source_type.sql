-- Migration: Add source_type to puntoventa (V2 dual-source: MQTT sensors vs Tuya products)
-- REQUIRES: puntoventa table (migration 002)
-- Usage: psql -U TIWater_user -d TIWater_timeseries -f scripts/migrations/047_puntoventa_source_type.sql

ALTER TABLE puntoventa
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) NOT NULL DEFAULT 'mqtt'
    CHECK (source_type IN ('mqtt', 'tuya', 'hybrid'));

COMMENT ON COLUMN puntoventa.source_type IS
  'Data origin for V2 layout: mqtt (sensors/MQTT), tuya (Tuya products), hybrid (both)';

CREATE INDEX IF NOT EXISTS idx_puntoventa_source_type ON puntoventa (source_type);

-- Backfill: hybrid when both V1 product_ids and MQTT sensors exist
UPDATE puntoventa pv
SET source_type = 'hybrid'
WHERE source_type = 'mqtt'
  AND EXISTS (
    SELECT 1 FROM puntoventa_v1 pv1
    WHERE pv1.puntoventa_id = pv.id
      AND pv1.meta IS NOT NULL
      AND jsonb_typeof(pv1.meta->'product_ids') = 'array'
      AND jsonb_array_length(pv1.meta->'product_ids') > 0
  )
  AND (
    EXISTS (SELECT 1 FROM puntoventasensors pvs WHERE pvs.punto_venta_id = pv.id)
    OR EXISTS (
      SELECT 1 FROM sensor_latest sl
      WHERE UPPER(TRIM(sl.codigo_tienda)) = UPPER(TRIM(COALESCE(pv.codigo_tienda, pv.code, '')))
    )
  );

-- Backfill: tuya when linked V1 has products but no MQTT sensors
UPDATE puntoventa pv
SET source_type = 'tuya'
WHERE source_type = 'mqtt'
  AND EXISTS (
    SELECT 1 FROM puntoventa_v1 pv1
    WHERE pv1.puntoventa_id = pv.id
      AND pv1.meta IS NOT NULL
      AND jsonb_typeof(pv1.meta->'product_ids') = 'array'
      AND jsonb_array_length(pv1.meta->'product_ids') > 0
  )
  AND NOT EXISTS (SELECT 1 FROM puntoventasensors pvs WHERE pvs.punto_venta_id = pv.id)
  AND NOT EXISTS (
    SELECT 1 FROM sensor_latest sl
    WHERE UPPER(TRIM(sl.codigo_tienda)) = UPPER(TRIM(COALESCE(pv.codigo_tienda, pv.code, '')))
  );

DO $$
BEGIN
  RAISE NOTICE '✅ puntoventa.source_type column added (default: mqtt — existing behavior preserved)';
END $$;

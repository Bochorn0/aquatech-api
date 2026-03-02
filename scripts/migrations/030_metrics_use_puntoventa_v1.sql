-- Migration: Update metrics to reference puntoventa_v1 (V1) instead of puntoventa (V2)
-- REQUIRES: puntoventa_v1 table (migration 029)
-- Usage: psql -U TIWater_user -d TIWater_timeseries -f scripts/migrations/030_metrics_use_puntoventa_v1.sql

-- Add new column for puntoventa_v1 reference
ALTER TABLE metrics ADD COLUMN IF NOT EXISTS punto_venta_v1_id BIGINT REFERENCES puntoventa_v1(id) ON DELETE SET NULL;

-- Migrate: map old punto_venta_id (puntoventa) to new punto_venta_v1_id
-- puntoventa_v1.puntoventa_id stores the original puntoventa.id
UPDATE metrics m
SET punto_venta_v1_id = pv1.id
FROM puntoventa_v1 pv1
WHERE pv1.puntoventa_id = m.punto_venta_id
  AND m.punto_venta_id IS NOT NULL;

-- Drop old column and rename new one (keeps API compatibility: metrics.punto_venta_id)
ALTER TABLE metrics DROP COLUMN IF EXISTS punto_venta_id;
ALTER TABLE metrics RENAME COLUMN punto_venta_v1_id TO punto_venta_id;

CREATE INDEX IF NOT EXISTS idx_metrics_punto_venta_id ON metrics (punto_venta_id) WHERE punto_venta_id IS NOT NULL;

COMMENT ON COLUMN metrics.punto_venta_id IS 'Reference to puntoventa_v1 (V1 equipos/metrics flow)';

DO $$
BEGIN
    RAISE NOTICE '✅ metrics now references puntoventa_v1';
END $$;

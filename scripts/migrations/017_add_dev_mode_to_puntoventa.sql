-- Migration: Add dev_mode column to puntoventa
-- Dedicated column for "dev mode" so the cron (random data generator) can find puntos without querying JSON.
-- Usage: psql -U TIWater_user -d TIWater_timeseries -f scripts/migrations/017_add_dev_mode_to_puntoventa.sql

-- Add column (idempotent)
ALTER TABLE puntoventa ADD COLUMN IF NOT EXISTS dev_mode BOOLEAN DEFAULT false;

-- Migrate existing data: if meta had dev_mode = true, set the new column
UPDATE puntoventa
SET dev_mode = true
WHERE meta IS NOT NULL
  AND (
    (meta::jsonb) @> '{"dev_mode": true}'
    OR (meta::jsonb)->>'dev_mode' = 'true'
  );

-- Index for the cron query: WHERE dev_mode = true
CREATE INDEX IF NOT EXISTS idx_puntoventa_dev_mode ON puntoventa (dev_mode) WHERE dev_mode = true;

COMMENT ON COLUMN puntoventa.dev_mode IS 'When true, the dev mode data generator cron will create random sensor readings for this punto.';

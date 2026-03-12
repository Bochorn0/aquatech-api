-- Migration: Add indexes on sensores to speed reads under MQTT insert load
-- REQUIRES: sensores table (001) – OLD schema with codigotienda, createdat.
-- After migration 041, sensores is detail-only (no codigotienda/createdat); those columns live in sensores_message.
-- This migration only runs when sensores still has the old schema (e.g. 037 run before 040/041).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sensores' AND column_name = 'codigotienda'
  ) THEN
    RAISE NOTICE '037 skipped: sensores has no codigotienda (post-041 detail-only schema); indexes live on sensores_message.';
    RETURN;
  END IF;

  -- PuntoVenta "online" check and similar: codigotienda + createdat
  CREATE INDEX IF NOT EXISTS idx_sensores_codigotienda_createdat
    ON sensores (codigotienda, createdat DESC);

  -- Recent data by store (avoid full scan when filtering by createdat)
  CREATE INDEX IF NOT EXISTS idx_sensores_createdat_codigotienda
    ON sensores (createdat DESC, codigotienda)
    WHERE codigotienda IS NOT NULL;

  RAISE NOTICE '✅ sensores read-path indexes created (037)';
END $$;

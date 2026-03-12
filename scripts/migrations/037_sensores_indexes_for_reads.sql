-- Migration: Add indexes on sensores to speed reads under MQTT insert load
-- REQUIRES: sensores table (001) and optionally 035
-- Usage: psql -U TIWater_user -d TIWater_timeseries -f scripts/migrations/037_sensores_indexes_for_reads.sql
--
-- Problem: MQTT constantly inserts into sensores; long or frequent write transactions
-- can block or slow SELECTs. Fixes applied:
-- 1) SensoresModel.createMany() uses a single batch INSERT (code change) to shorten lock time.
-- 2) These indexes help read queries use index scans instead of full scans.
--
-- Common read patterns: WHERE codigotienda = ? AND createdat >= ?; historico by codigo/type/name/timestamp

-- PuntoVenta "online" check and similar: codigotienda + createdat
CREATE INDEX IF NOT EXISTS idx_sensores_codigotienda_createdat
  ON sensores (codigotienda, createdat DESC);

-- Recent data by store (avoid full scan when filtering by createdat)
CREATE INDEX IF NOT EXISTS idx_sensores_createdat_codigotienda
  ON sensores (createdat DESC, codigotienda)
  WHERE codigotienda IS NOT NULL;

DO $$
BEGIN
  RAISE NOTICE '✅ sensores read-path indexes created (037)';
END $$;

-- Migration: Add indexes on sensores for historico and detalle queries (OLD schema only)
-- After migration 041, sensores is detail-only; historico/detalle use sensores_message + sensores (join).
-- Run: psql -U TIWater_user -d TIWater_timeseries -f scripts/migrations/035_sensores_indexes_for_historico.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sensores' AND column_name = 'codigotienda'
  ) THEN
    RAISE NOTICE '035 skipped: sensores has no codigotienda (post-041 schema); historico uses sensores_message + sensores.';
    RETURN;
  END IF;

  -- Composite index for historico queries (old table)
  CREATE INDEX IF NOT EXISTS idx_sensores_codigo_res_type_res_id_name_ts
    ON sensores (codigotienda, resourcetype, resourceid, name, timestamp DESC);

  CREATE INDEX IF NOT EXISTS idx_sensores_tiwater_name_ts
    ON sensores (codigotienda, name, timestamp DESC)
    WHERE resourcetype = 'tiwater' AND (resourceid IS NULL OR resourceid = 'tiwater-system');

  CREATE INDEX IF NOT EXISTS idx_sensores_nivel_name_ts
    ON sensores (codigotienda, resourceid, name, timestamp DESC)
    WHERE resourcetype = 'nivel';

  CREATE INDEX IF NOT EXISTS idx_sensores_codigo_resource_type
    ON sensores (codigotienda, resourcetype, resourceid);

  RAISE NOTICE '✅ sensores indexes for historico/detalle created (035)';
END $$;

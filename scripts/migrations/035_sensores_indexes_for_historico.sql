-- Migration: Add indexes on sensores for historico and detalle queries
-- Speeds up nivel/historico aggregation and punto venta detalle lookups
-- Run: psql -U TIWater_user -d TIWater_timeseries -f scripts/migrations/035_sensores_indexes_for_historico.sql

-- Composite index for historico queries: filter by codigo, resource, sensor name; sort by time
-- Used by generateNivelHistoricoV2 and generateNivelHistoricoDiarioV2
CREATE INDEX IF NOT EXISTS idx_sensores_codigo_res_type_res_id_name_ts
  ON sensores (codigotienda, resourcetype, resourceid, name, timestamp DESC);

-- Index for tiwater systems (resourceid NULL or 'tiwater-system')
CREATE INDEX IF NOT EXISTS idx_sensores_tiwater_name_ts
  ON sensores (codigotienda, name, timestamp DESC)
  WHERE resourcetype = 'tiwater' AND (resourceid IS NULL OR resourceid = 'tiwater-system');

-- Index for nivel products
CREATE INDEX IF NOT EXISTS idx_sensores_nivel_name_ts
  ON sensores (codigotienda, resourceid, name, timestamp DESC)
  WHERE resourcetype = 'nivel';

-- Index for distinct systems lookup (punto venta detalle)
CREATE INDEX IF NOT EXISTS idx_sensores_codigo_resource_type
  ON sensores (codigotienda, resourcetype, resourceid);

DO $$
BEGIN
  RAISE NOTICE '✅ sensores indexes for historico/detalle created';
END $$;

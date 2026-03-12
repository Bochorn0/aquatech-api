-- Migration: Fast approximate row count for product_logs
-- REQUIRES: product_logs table (024)
-- Usage: psql -U TIWater_user -d TIWater_timeseries -f scripts/migrations/038_product_logs_approximate_count.sql
--
-- SELECT COUNT(*) FROM product_logs can take many seconds on large tables (full scan).
-- This function returns an approximate count from statistics (updated by ANALYZE / autovacuum).
-- Use for dashboards/admin when exact count is not required. For exact count, run during low load
-- or increase max_parallel_workers_per_gather to speed up the scan.

CREATE OR REPLACE FUNCTION approximate_count_product_logs()
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((SELECT reltuples::bigint FROM pg_class WHERE relname = 'product_logs'), 0);
$$;

COMMENT ON FUNCTION approximate_count_product_logs() IS 'Fast approximate row count for product_logs; run ANALYZE product_logs; to refresh estimate';

DO $$
BEGIN
  RAISE NOTICE '✅ approximate_count_product_logs() created. Use: SELECT approximate_count_product_logs();';
  RAISE NOTICE '   For exact count, consider: SET max_parallel_workers_per_gather = 4; before SELECT COUNT(*);';
END $$;

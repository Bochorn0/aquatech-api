-- Migration: Add indexes on product_logs for reporting and lookups
-- REQUIRES: product_logs table (024)
-- Usage: psql -U TIWater_user -d TIWater_timeseries -f scripts/migrations/036_product_logs_indexes_for_reporting.sql
--
-- Query patterns (from report.controller and productLog.model):
--   - product_id = ANY($1::bigint[]) AND date >= $2 AND date <= $3  (reporte mensual)
--   - (product_id = $1 OR product_device_id = $1) AND date::date = ANY($2::date[])  (findByDates)
--   - product_id / product_device_id + date range (findOne, find, count)
-- Sample data: id, product_id, product_device_id, tds, production_volume, rejected_volume,
--   temperature, flujo_produccion, flujo_rechazo, tiempo_inicio, tiempo_fin, source, date, createdat, updatedat

-- Composite (product_id, date): reporte mensual filters by multiple product_ids and date range; findOne/count by product_id + date
CREATE INDEX IF NOT EXISTS idx_product_logs_product_id_date
  ON product_logs (product_id, date DESC);

-- Composite (product_device_id, date DESC): already exists as (product_device_id, date); make DESC explicit for "latest first" queries
-- 024 has idx_product_logs_product_device_id_date ON (product_device_id, date); add date DESC variant if needed for ORDER BY date DESC
CREATE INDEX IF NOT EXISTS idx_product_logs_product_device_id_date_desc
  ON product_logs (product_device_id, date DESC);

-- Cover date-range-only scans (e.g. admin/analytics by time)
CREATE INDEX IF NOT EXISTS idx_product_logs_date_product_id
  ON product_logs (date DESC, product_id);

COMMENT ON INDEX idx_product_logs_product_id_date IS 'Reporte mensual and lookups: product_id IN (...) AND date range';
COMMENT ON INDEX idx_product_logs_product_device_id_date_desc IS 'Lookups by device_id with ORDER BY date DESC';
COMMENT ON INDEX idx_product_logs_date_product_id IS 'Date-range scans with product filter';

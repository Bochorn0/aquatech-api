-- Migration: Per-product Tuya logs routine config
-- Requires: products (021), optionally 048
-- Usage: psql ... -f scripts/migrations/049_products_tuya_logs_routine_config.sql

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS tuya_logs_routine_config JSONB DEFAULT NULL;

COMMENT ON COLUMN products.tuya_logs_routine_config IS
  'Per-product fetchLogsRoutine config: { enabled_fields, custom_rules }. NULL = use default for product_type.';

DO $$
BEGIN
    RAISE NOTICE '✅ products.tuya_logs_routine_config column added';
END $$;

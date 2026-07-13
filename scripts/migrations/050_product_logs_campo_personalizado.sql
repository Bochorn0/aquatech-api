-- Migration: Dedicated columns for up to 2 custom log-derived metrics
-- Requires: product_logs (024), optionally 048
-- Usage: psql ... -f scripts/migrations/050_product_logs_campo_personalizado.sql

ALTER TABLE product_logs
  ADD COLUMN IF NOT EXISTS campo_personalizado_1 NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS campo_personalizado_2 NUMERIC DEFAULT NULL;

COMMENT ON COLUMN product_logs.campo_personalizado_1 IS
  'Custom derived metric slot 1 from per-product Tuya logs routine rules';
COMMENT ON COLUMN product_logs.campo_personalizado_2 IS
  'Custom derived metric slot 2 from per-product Tuya logs routine rules';

DO $$
BEGIN
    RAISE NOTICE '✅ product_logs.campo_personalizado_1 / campo_personalizado_2 added';
END $$;

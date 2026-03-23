-- Canonical product row can list Tuya device_ids that were merged into it (logic + audit).
-- Application resolves any of these ids to the same product (sync, logs routine, detalle).
-- Run BEFORE 044_merge_duplicate_products_oxxo_asdeoros.sql (numeric sort order).

ALTER TABLE products
ADD COLUMN IF NOT EXISTS merged_from_device_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN products.merged_from_device_ids IS
  'JSON array of Tuya device_id strings merged into this row. ProductModel.findByDeviceId resolves them to this canonical product.';

-- Merge two Tuya devices that represent the same physical equipo (same name / punto).
-- Prerequisite: run 044_products_merged_from_device_ids.sql first (adds merged_from_device_ids).
-- Scenario: keep NEW device, move all product_logs to NEW, drop OLD product row.
--
-- Devices (edit if you reuse this pattern):
--   OLD (superseded): eb3a4ee3ad618b4696anyi  → Postgres id was often 7
--   NEW (canonical):  eb49196e47e2711139bfx9 → Postgres id was often 22
--
-- Run on production only after backup. Idempotent-ish: second run updates 0 rows if OLD already deleted.

BEGIN;

-- 1) Re-point historical logs to the canonical product + device_id
UPDATE product_logs pl
SET
  product_id = (SELECT id FROM products WHERE device_id = 'eb49196e47e2711139bfx9' LIMIT 1),
  product_device_id = 'eb49196e47e2711139bfx9'
WHERE product_id = (SELECT id FROM products WHERE device_id = 'eb3a4ee3ad618b4696anyi' LIMIT 1)
   OR product_device_id = 'eb3a4ee3ad618b4696anyi';

-- 2) puntoventa_v1.meta.product_ids may store numeric ids OR Tuya device_id strings — adjust both patterns
UPDATE puntoventa_v1
SET meta = replace(meta::text, 'eb3a4ee3ad618b4696anyi', 'eb49196e47e2711139bfx9')::jsonb
WHERE meta IS NOT NULL
  AND meta::text LIKE '%eb3a4ee3ad618b4696anyi%';

-- If meta only has numeric ids (e.g. 7 → 22), fix manually in SQL or UI after checking no other punto shares id 7.

-- 2b) Logic layer: record merged Tuya id on canonical product (requires migration 044)
UPDATE products
SET merged_from_device_ids = COALESCE(merged_from_device_ids, '[]'::jsonb) || jsonb_build_array('eb3a4ee3ad618b4696anyi'::text)
WHERE device_id = 'eb49196e47e2711139bfx9';

-- 3) Remove superseded product (no FK references left after step 1)
DELETE FROM products WHERE device_id = 'eb3a4ee3ad618b4696anyi';

COMMIT;

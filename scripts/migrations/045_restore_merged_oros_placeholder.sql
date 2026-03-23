-- Restore a placeholder row for the old merged Oxxo As de Oros device
-- so global/detail totals can add canonical + legacy baseline again.
--
-- Old merged device_id:  eb3a4ee3ad618b4696anyi
-- Canonical device_id:   eb49196e47e2711139bfx9
--
-- Baseline provided by business/user (display liters):
--   flowrate_total_1 = 27019 L
--   flowrate_total_2 = 39304 L
--
-- products.status stores Tuya raw totals in 0.1 L units,
-- so we persist:
--   flowrate_total_1 = 270190
--   flowrate_total_2 = 393040
--
-- Idempotent: if old row already exists, insert is skipped.

BEGIN;

WITH canonical AS (
  SELECT *
  FROM products
  WHERE device_id = 'eb49196e47e2711139bfx9'
  LIMIT 1
)
INSERT INTO products (
  device_id,
  active_time,
  last_time_active,
  product_type,
  biz_type,
  category,
  create_time,
  icon,
  ip,
  city,
  state,
  client_id,
  drive,
  lat,
  local_key,
  lon,
  model,
  name,
  online,
  owner_id,
  product_id,
  product_name,
  status,
  sub,
  time_zone,
  uid,
  update_time,
  uuid,
  tuya_logs_routine_enabled,
  merged_from_device_ids
)
SELECT
  'eb3a4ee3ad618b4696anyi'::text AS device_id,
  c.active_time,
  c.last_time_active,
  c.product_type,
  c.biz_type,
  c.category,
  c.create_time,
  c.icon,
  c.ip,
  c.city,
  c.state,
  c.client_id,
  c.drive,
  c.lat,
  c.local_key,
  c.lon,
  c.model,
  COALESCE(NULLIF(c.name, ''), 'Oxxo As de Oros GDL') || ' (merged legacy baseline)' AS name,
  false AS online,
  c.owner_id,
  c.product_id,
  c.product_name,
  jsonb_build_array(
    jsonb_build_object('code', 'tds_out', 'value', 0),
    jsonb_build_object('code', 'work_error', 'value', 0),
    jsonb_build_object('code', 'water_overflow', 'value', false),
    jsonb_build_object('code', 'water_wash', 'value', false),
    jsonb_build_object('code', 'flowrate_total_1', 'value', 270190),
    jsonb_build_object('code', 'flowrate_total_2', 'value', 393040),
    jsonb_build_object('code', 'flowrate_total_1_reset', 'value', false),
    jsonb_build_object('code', 'flowrate_total_2_reset', 'value', false),
    jsonb_build_object('code', 'filter_element_1', 'value', 0),
    jsonb_build_object('code', 'filter_element_2', 'value', 0),
    jsonb_build_object('code', 'filter_element_3', 'value', 0),
    jsonb_build_object('code', 'filter_element_4', 'value', 0),
    jsonb_build_object('code', 'filter_element_5', 'value', 0),
    jsonb_build_object('code', 'filter_element_1_rs', 'value', false),
    jsonb_build_object('code', 'filter_element_2_rs', 'value', false),
    jsonb_build_object('code', 'filter_element_3_rs', 'value', false),
    jsonb_build_object('code', 'filter_element_4_rs', 'value', false),
    jsonb_build_object('code', 'filter_element_5_rs', 'value', false),
    jsonb_build_object('code', 'temperature_type', 'value', false),
    jsonb_build_object('code', 'language_type', 'value', false),
    jsonb_build_object('code', 'beep_mood', 'value', false),
    jsonb_build_object('code', 'water_washing', 'value', false),
    jsonb_build_object('code', 'water_production', 'value', false),
    jsonb_build_object('code', 'flowrate_speed_1', 'value', 0),
    jsonb_build_object('code', 'flowrate_speed_2', 'value', 0),
    jsonb_build_object('code', 'temperature', 'value', 0)
  ) AS status,
  c.sub,
  c.time_zone,
  c.uid,
  c.update_time,
  c.uuid,
  false AS tuya_logs_routine_enabled,
  '[]'::jsonb AS merged_from_device_ids
FROM canonical c
WHERE NOT EXISTS (
  SELECT 1
  FROM products p
  WHERE p.device_id = 'eb3a4ee3ad618b4696anyi'
);

COMMIT;

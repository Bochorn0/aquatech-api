# sensores_message + sensor_details structure

Reduces redundancy: **meta is stored once per message** in `sensores_message`; only `name`, `type`, `value` per reading in `sensor_details`.

**Note:** Migrations do not drop or truncate the existing `sensores` table. If you need to start fresh (e.g. before going live with only the new structure), run manually when appropriate: `TRUNCATE sensores CASCADE;` or `DROP TABLE sensores CASCADE;`

---

## Tables

| Table | Purpose | Rows per MQTT message |
|-------|--------|------------------------|
| **sensores_message** | One row per message: timestamp, codigotienda, clientid, lat, long, resourceid, resourcetype, **meta** (JSONB, once) | 1 |
| **sensor_details** | One row per sensor value: sensores_message_id, name, type, value (no meta) | ~15–25 |

---

## Write path (already implemented)

- MQTT → `saveMultipleSensorsFromMQTT`:
  1. Insert 1 row into **sensores_message** (meta = message container; slim by default, or full payload if `SENSORES_META_STORE_ORIGINAL_PAYLOAD=true`).
  2. Insert N rows into **sensor_details** (sensores_message_id, name, type, value).
  3. Dual-write: still insert N rows into legacy **sensores** so dashboard/API keep working.
  4. Update **sensor_latest** as before.

If migration 040 has not been run, step 1–2 are skipped (warning logged); sensores and sensor_latest still receive data.

---

## Read path (when you migrate)

Today all reads use **sensores** (and **sensor_latest** for “current value”). To use the new tables for historico/detalle:

- **Current value:** Keep using **sensor_latest** (unchanged).
- **Historico / time-series:** Query by joining:
  ```sql
  SELECT m.timestamp, d.name, d.type, d.value
  FROM sensor_details d
  JOIN sensores_message m ON d.sensores_message_id = m.id
  WHERE m.codigotienda = $1 AND d.type = $2
    AND m.timestamp >= $3 AND m.timestamp < $4
  ORDER BY m.timestamp ASC
  ```
- **Full message (e.g. debug):** `SELECT * FROM sensores_message WHERE id = $1` (meta is there once).

After switching reads to these queries (e.g. in `generateNivelHistoricoV2` and detalle fallbacks), you can set **SENSORES_LEGACY_DUAL_WRITE=false** (when we add it) or remove the `SensoresModel.createMany(sensors)` call to stop writing to **sensores** and rely only on sensores_message + sensor_details.

---

## Env

| Variable | Effect |
|----------|--------|
| **SENSORES_META_STORE_ORIGINAL_PAYLOAD** | When `'true'`, the single **sensores_message.meta** row includes `original_payload` (full MQTT). Default: not set = slim meta only. |

# Sensores table: recommendations for ~200k messages/day

Current design stores one row per (message × sensor_type): each MQTT message produces ~15–25 rows. At 200k messages/day that’s **~3–5M rows/day**. This doc summarizes the main issues and recommended changes.

---

## Current issues

| Issue | Impact |
|-------|--------|
| **One row per sensor type per message** | 200k messages → millions of rows/day; repeated dimension columns (codigoTienda, resourceId, meta) on every row. |
| **meta.original_payload** | Full MQTT payload stored in **every** of the ~20 rows per message → huge duplication and JSONB bloat. |
| **VARCHAR for dimensions** | codigoTienda, resourceId, resourceType, type, name as text → more storage and larger indexes. |
| **createdAt / updatedAt** | Redundant with `timestamp` for time-series; trigger on update adds cost. |
| **Reads on raw table** | Historico and detalle query `sensores` directly; no pre-aggregation. |

---

## Recommendations (by effort)

### 1. Quick wins (do first)

- **Stop storing `original_payload` in sensores.meta**  
  Keep only `{ source, gateway_ip, rssi }` (and any `context.metadata`). Optionally sample full payload elsewhere if needed.  
  **Implemented:** env `SENSORES_META_STORE_ORIGINAL_PAYLOAD` – when not `'true'`, new rows do not store the full MQTT payload in meta (both single-sensor and batch save paths). Set to `'true'` only for temporary debugging.

- **TimescaleDB compression**  
  Compress chunks older than 7 days to cut storage and improve cache usage:
  ```sql
  ALTER TABLE sensores SET (timescaledb.compress, timescaledb.compress_segmentby = 'codigotienda, resourcetype', timescaledb.compress_orderby = 'timestamp DESC');
  SELECT add_compression_policy('sensores', INTERVAL '7 days');
  ```

- **Retention policy**  
  Drop very old data if not needed:
  ```sql
  SELECT add_retention_policy('sensores', INTERVAL '12 months');
  ```

- **Optional: drop updatedAt trigger**  
  If you never update sensores rows, drop the trigger to save a little write cost.

### 2. Short-term (schema and write path)

- **Slim meta in code**  
  Already done if you disable original_payload. Ensure no other code writes large objects into `meta`.

- **Continuous aggregates for historico**  
  Pre-aggregate by (codigo_tienda, resource_id, type, name, hour/day) so historico reads hit a small table instead of scanning raw sensores:
  ```sql
  CREATE MATERIALIZED VIEW sensores_hourly
  WITH (timescaledb.continuous) AS
  SELECT
    codigotienda,
    resourceid,
    resourcetype,
    name,
    time_bucket('1 hour', timestamp) AS bucket,
    AVG(value) AS avg_value,
    MAX(value) AS max_value,
    MIN(value) AS min_value,
    COUNT(*) AS cnt
  FROM sensores
  GROUP BY 1, 2, 3, 4, 5;
  ```
  Then point `generateNivelHistoricoV2` (or a new version) at this view instead of raw `sensores`.

- **Tune chunk interval**  
  For ~4M rows/day, 1-day chunks are reasonable. Check current:
  ```sql
  SELECT * FROM timescaledb_information.chunks WHERE hypertable_name = 'sensores';
  ```
  If chunks are too small, consider:
  ```sql
  SELECT set_chunk_time_interval('sensores', INTERVAL '1 day');
  ```
  (Only affects new chunks.)

### 3. Medium-term (structural)

- **Normalize dimensions**  
  - Add lookup tables for `codigo_tienda`, `resource_type`, `sensor_type` and store IDs in sensores (e.g. `codigo_tienda_id`, `sensor_type_id`).  
  - Shrinks row and index size; makes it easier to add constraints and analytics.

- **Wide row per message (alternative model)**  
  One row per MQTT message with columns like `flujo_produccion`, `flujo_rechazo`, `tds`, `nivel_purificada`, … plus `codigo_tienda`, `resource_id`, `timestamp`.  
  - Pros: 200k rows/day instead of millions; simpler for “last value per message” reads.  
  - Cons: Schema change when adding sensor types; many nulls; historico still needs aggregation (or another structure).

- **Dedicated historico store**  
  Write hourly/daily aggregates (e.g. from a job or continuous aggregate) into a separate table or view and use it only for charts/reports. Keep sensores as the raw event store.

### 4. Operational

- **Prefer sensor_latest for “current value”**  
  Already in place. Use it everywhere for “latest value per sensor” so detalle/dashboard don’t hit sensores for that.

- **Index discipline**  
  Only create indexes that match real query filters (codigotienda, resourcetype, resourceid, name, timestamp). Avoid indexing rarely used columns.

- **Monitor chunk count and size**  
  Use `timescaledb_information.chunks` and compression/retention so the hypertable doesn’t grow unbounded.

---

## Summary

| Priority | Action |
|----------|--------|
| 1 | Stop storing `original_payload` in sensores.meta (env toggle in code). |
| 2 | Enable TimescaleDB compression + retention (and optional chunk interval tune). |
| 3 | Add continuous aggregate(s) for historico and read from them instead of raw sensores. |
| 4 | Consider dimension normalization or wide-row model when you’re ready for a larger refactor. |

These steps keep your current “one row per sensor type per message” model but reduce storage, improve read performance, and set you up for ~200k messages/day and beyond.

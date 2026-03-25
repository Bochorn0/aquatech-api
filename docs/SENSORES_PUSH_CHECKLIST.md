# Sensores message + detail schema – push checklist

Use this to confirm all required changes are in place before pushing the sensores_message + sensores (detail-only) schema.

## Migrations (run in order)

| # | File | Purpose |
|---|------|--------|
| 040 | `040_sensores_message_and_sensor_details.sql` | Creates `sensores_message` and `sensor_details` (040); no drop of old `sensores`. |
| 041 | `041_drop_sensores_recreate_as_detail.sql` | Drops `sensor_details` and old `sensores`, recreates `sensores` as detail table (id, sensores_message_id, name, type, value). **Destructive:** run only when app uses new write/read paths. |
| 035 | `035_sensores_indexes_for_historico.sql` | **Conditional:** creates indexes only if `sensores` has `codigotienda` (old schema). Skips after 041. |
| 037 | `037_sensores_indexes_for_reads.sql` | **Conditional:** same as 035; skips after 041. |
| 039 | `039_sensores_timescale_compression_retention.sql` | **No-op:** documents that TimescaleDB compression targets `sensores_message` if needed later. |

## Application code

### Write path (all go through message + detail)

- **postgres.service.js**
  - `saveSensorFromMQTT`: uses `SensoresMessageModel.createMessage` + `createDetails` (one message, one detail row). No longer calls `SensoresModel.create`.
  - `saveMultipleSensorsFromMQTT`: uses `createMessage` + `createDetails` (one message, N detail rows). Updates `sensor_latest` and metric notifications as before.
- **devModeDataGenerator.service.js**: uses `SensoresMessageModel.createMessage` + `createDetails`; updates `sensor_latest`.
- **sensoresMessage.model.js**: `createMessage` → `sensores_message`; `createDetails` → `sensores` (table name is `sensores`, not `sensor_details`).
- **sensores.model.js**: `create` / `createMany` throw (callers must use SensoresMessageModel).

### Read path (all join `sensores_message`)

- **sensores.model.js**: All reads use `FROM sensores s INNER JOIN sensores_message m ON s.sensores_message_id = m.id`; filters on `m.codigotienda`, `m.timestamp`, etc.
- **puntoVenta.controller.js**: Raw SQL updated to join `sensores` + `sensores_message` (getLatestTiwaterPayloadForPublish, V2 online check).
- **sensorData.controller.js**: All handlers use join (getLatestSensorData, getSensorData, getSensorStatistics, getSensorDataByTiendaEquipo, getSensorDataByTienda, getSensorDataByGateway).
- **sensorDataV2.controller.js**: All raw queries use join (historico diario/hora, getOsmosisSystemByPuntoVenta, getPuntosVentaV2 fallback, detalle fallback, distinct systems, tiwater/nivel/metrica, getSensorTimeSeries, getTiwaterSensorData, getMainDashboardV2Metrics).
- **customizationV2.controller.js**: getPuntoVentaSensorsV2 and getPuntoVentaSensorsReadingsV2 use join.

### Other

- **sensor_latest**: Still updated on every save (postgres.service, devModeDataGenerator). Dashboard and “current value” reads use `sensor_latest` where applicable.
- **PRODUCTION.md**: Contains example `SELECT COUNT(*) FROM sensores`; after 041 this counts detail rows. Optional: add a note that message count is in `sensores_message`.

## Pre-push verification

1. **Migrations**: Run 040 then 041 (and 035, 037, 039 as needed). Ensure no errors; after 041, `sensores` has only columns: id, sensores_message_id, name, type, value.
2. **Writes**: MQTT tiwater path → `saveMultipleSensorsFromMQTT` (message + details). Non-tiwater path → `saveSensorFromMQTT` (message + one detail). Dev generator → createMessage + createDetails.
3. **Reads**: No raw `SELECT ... FROM sensores` without joining `sensores_message`; all controller and model reads use the join or SensoresModel (which uses the join).
4. **Lint**: `ReadLints` on changed files (postgres.service, controllers, models) clean.

## Scripts and tests

- **scripts/test-postgres-connection.js**: Test 4 (insert) supports both schemas: if `sensores` has `sensores_message_id`, it inserts via `sensores_message` + `sensores` and cleans up both; otherwise uses the old single-table insert. Prevents failure after 041.

## Optional after push

- Add a new migration (e.g. 042) for TimescaleDB compression/retention on `sensores_message` if you use TimescaleDB.
- Update PRODUCTION.md or runbooks to mention `sensores_message` and `sensores` (detail) layout.

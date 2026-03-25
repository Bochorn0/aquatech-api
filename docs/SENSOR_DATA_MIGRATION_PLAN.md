# Sensor data architecture migration plan

Goal: move to a better storage/access model for sensor data while **keeping dashboard, MQTT, and API functional** at every step. No big-bang cutover.

---

## Three possible approaches (pick one)

| Approach | What happens to `sensores` | What you add | Complexity |
|----------|----------------------------|--------------|------------|
| **A. Improve existing table only** | Keep it. Same table, same schema. Add compression, retention, and a **view/aggregate** that pre-computes historico. | One or more **continuous aggregates** (or materialized views) that read from `sensores`. No new event table. | Low. No new table; no dual-write. |
| **B. Additional tables only** | Keep it. Keep writing to `sensores` and reading from it (or from aggregates on it). | Same as A (aggregates). Optionally a **service layer** in code so all access goes through one place. | Low–medium. No replacement. |
| **C. Replace with a new structure** | Stop using it for new data. New data goes to a **new table** (e.g. `sensor_events`) with a better, narrow schema. Old data stays in `sensores` until you archive/drop it. | New table **sensor_events** + aggregates on it; **sensor_latest** is fed from the new table. Dual-write during transition, then switch reads, then stop writing to `sensores`. | Higher. New table, dual-write, then cutover. |

**In short:**

- **A = don’t change the table; add views/aggregates** so historico doesn’t scan raw `sensores`.
- **B = same as A, plus a single “sensor data service” in code** that talks to `sensores` and those aggregates (no new event table).
- **C = add a new table with a better structure and eventually replace `sensores`** (new table + dual-write + cutover).

**Recommendation:** Start with **B**: keep the `sensores` table, add **continuous aggregates** for historico (so you don’t change or replace the table), and add a **sensor data service** so all access goes through one place. If later you want a cleaner schema, you can introduce a new table (approach C) and switch the service to it without touching every controller.

---

## Current state (summary)

| Component | Writes | Reads |
|-----------|--------|--------|
| **MQTT** | postgres.service → SensoresModel.createMany + SensorLatestModel.upsertMany | — |
| **Dashboard (home-v2, map)** | — | sensor_latest (getLatestByCodigoTiendas); fallback sensores |
| **Detalle (punto venta v2)** | — | sensor_latest first; fallback sensores (latest snapshot); sensores for distinct systems / nivel / metricas |
| **Historico (charts)** | — | sensores (generateNivelHistoricoV2, generateNivelHistoricoDiarioV2) |
| **API v1 (sensorData)** | — | sensores (find, count, by tienda/equipo/gateway) |
| **CustomizationV2** | — | sensores (raw SELECT for metrics) |
| **Dev mode generator** | SensoresModel.createMany + sensor_latest | — |

So: **writes** go to `sensores` + `sensor_latest`. **Reads** use `sensor_latest` for “current value” and `sensores` for historico, detalle fallbacks, and v1/customization.

---

## Target architecture (after migration)

1. **Current values**  
   **sensor_latest** (unchanged). Single source for “latest value per (store, type, resource)”. Dashboard and detalle already prefer it.

2. **Time-series / historico**  
   **Continuous aggregate** (or materialized view) over the raw event store, e.g. hourly/daily by (codigo_tienda, resource_id, type, name). Historico and charts read from this instead of scanning `sensores`.

3. **Raw events**  
   Either:
   - **Option A (minimal change):** Keep `sensores` as the only event table; add compression + retention; add continuous aggregate; point historico reads to the aggregate.  
   - **Option B (new store):** New table `sensor_events` (narrow: codigo_tienda, resource_id, resource_type, type, name, value, timestamp; no meta bloat). Write MQTT there (and optionally still to sensores during transition). Continuous aggregate on `sensor_events`. Eventually drop writes to `sensores`.

4. **Single access layer (recommended)**  
   A **sensor data service** in the API that:
   - **Write:** `saveSensorReadings(mqttData, context)` → writes to the chosen backend(s).
   - **Read current:** `getLatestByCodigoTienda(s)` → sensor_latest (unchanged).
   - **Read historico:** `getHistorico(codigo, resourceId, name, range)` → continuous aggregate (or sensores during transition).

   MQTT and all API controllers call this service instead of SensoresModel / raw SQL. Then you can switch backend (e.g. from sensores to sensor_events) in one place.

---

## Phased migration (keep everything working)

### Phase 1: Introduce the service layer (no storage change)

- Add **SensorDataService** (or similar) in the API:
  - `saveSensorReadings(mqttData, context)` → today: PostgresService.saveMultipleSensorsFromMQTT (same as now: sensores + sensor_latest).
  - `getLatestByCodigoTienda`, `getLatestByCodigoTiendas` → delegate to SensorLatestModel (unchanged).
  - `getHistorico(...)` → delegate to current logic (generateNivelHistoricoV2 / Diario reading sensores).
- **MQTT path:** Call SensorDataService.saveSensorReadings instead of PostgresService.saveMultipleSensorsFromMQTT directly. Implementation still writes to sensores + sensor_latest.
- **API read paths:** Replace direct SensoresModel / raw SQL with SensorDataService where it makes sense (at least for detalle and historico). Implementation still reads from sensores and sensor_latest.
- **Deploy.** Dashboard, MQTT, API behavior unchanged. You now have one place that “owns” how sensor data is written and read.

**Rollback:** Revert to direct PostgresService / SensoresModel / raw SQL.

---

### Phase 2: Add continuous aggregate for historico (Option A path)

- In the DB (TimescaleDB):
  - Create a **continuous aggregate** on `sensores`, e.g. by (codigotienda, resourceid, resourcetype, name) and 1-hour bucket; expose columns needed for historico (e.g. bucket, avg_value, max_value, count).
  - Optionally daily aggregate as well for “historico diario”.
- In the API:
  - Implement `getHistoricoFromAggregate(...)` that queries the continuous aggregate instead of raw sensores.
  - In SensorDataService (or in generateNivelHistoricoV2), add a **feature flag or env** (e.g. `SENSOR_HISTORICO_USE_AGGREGATE=true`) to choose:
    - `true` → read from continuous aggregate.
    - `false` → keep reading from sensores (current behavior).
- **Deploy** with flag off; verify. Turn flag on; verify historico charts. If anything breaks, turn flag off.

**Rollback:** Set `SENSOR_HISTORICO_USE_AGGREGATE=false` (or revert code).

---

### Phase 3 (optional): New event table + dual-write (Option B)

- Create table **sensor_events** (narrow schema: codigo_tienda, resource_id, resource_type, type, name, value, timestamp; no meta or minimal meta).
- In SensorDataService.saveSensorReadings:
  - Keep writing to sensores + sensor_latest (so nothing breaks).
  - **Also** write the same readings to sensor_events (batch insert).
- **Deploy.** Both tables receive data. All reads still from sensores + sensor_latest + aggregate on sensores.

**Rollback:** Stop writing to sensor_events in code; leave table as-is.

---

### Phase 4 (optional): Switch historico to new store (only if you did Phase 3)

- Create continuous aggregate on **sensor_events** (same idea as Phase 2).
- Add a second flag or config: “historico source” = sensores aggregate vs sensor_events aggregate.
- Point historico reads to sensor_events aggregate; verify.
- When stable, you can stop writing to sensores (and later drop or archive it). sensor_latest stays the single source for “current” and can be fed from sensor_events only.

**Rollback:** Point historico back to sensores aggregate.

---

## What stays working at each step

| Phase | Dashboard | MQTT | API (detalle, historico, v1, customization) |
|-------|-----------|------|---------------------------------------------|
| 1 – Service layer | ✅ unchanged | ✅ unchanged | ✅ unchanged (same DB under the hood) |
| 2 – Historico aggregate | ✅ | ✅ | ✅ historico reads from aggregate when flag on; rest unchanged |
| 3 – Dual-write sensor_events | ✅ | ✅ | ✅ reads unchanged; both tables written |
| 4 – Historico from sensor_events | ✅ | ✅ | ✅ historico from new aggregate; can stop writing sensores |

---

## Concretes to implement (when you’re ready)

1. **SensorDataService**  
   - File: e.g. `src/services/sensorData.service.js`.  
   - Methods: saveSensorReadings, getLatestByCodigoTienda(s), getLatestByCodigoTiendas, getHistorico (and any helpers for “distinct systems”, “online”, etc. that today hit sensores).  
   - Implementation: call PostgresService, SensorLatestModel, and existing historico helpers.

2. **MQTT**  
   - In mqtt.service.js (or wherever you call PostgresService.saveMultipleSensorsFromMQTT), call SensorDataService.saveSensorReadings instead. No change to payload or topic handling.

3. **Controllers**  
   - sensorDataV2: replace direct SensoresModel / query() / SensorLatestModel with SensorDataService where possible (detalle, historico, getPuntosVentaV2 online/last_reading, getTiwaterSensorData, etc.).  
   - sensorData (v1): same idea if you want v1 to go through the service.  
   - customizationV2: replace raw SELECT from sensores with SensorDataService if you add a method that matches that need.

4. **Feature flags**  
   - Use env vars (e.g. `SENSOR_HISTORICO_USE_AGGREGATE`, `SENSOR_HISTORICO_SOURCE=sensores|sensor_events`) so you can switch and roll back without code deploy.

5. **Migrations**  
   - Phase 2: SQL migration that creates the continuous aggregate(s) on sensores.  
   - Phase 3: SQL migration that creates sensor_events (and optional aggregate on it).

---

## Recommendation

- **Short term:** Do **Phase 1** (service layer) and **Phase 2** (continuous aggregate for historico, read behind a flag). That gives you a single place to change behavior, keeps dashboard/MQTT/API working, and reduces load on the raw sensores table for historico without a new event table.
- **Later:** If you want a cleaner long-term store, add **Phase 3** (sensor_events + dual-write) and **Phase 4** (historico from sensor_events, then stop writing sensores). The same service layer makes that switch localized and low-risk.

**Next step:** Implement Phase 1 (add `sensorData.service.js`, wire MQTT and one read path through it). No behavior change; sets the foundation for swapping storage later.

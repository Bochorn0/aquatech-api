# V2 Flows Validation – V1/V2 Separation Impact

## Summary

This document validates that **V2 flows** (puntoventa, MQTT, sensors, region/ciudad) are **not broken** by the puntoventa_v1 separation, and identifies **gaps that need fixes**.

---

## ✅ V2 Flows – Correctly Using PuntoVentaModel (puntoventa)

| Flow | Controller/Service | Model Used | Status |
|------|-------------------|------------|--------|
| **GET /api/v2.0/puntoVentas/all** | sensorDataV2.controller | PuntoVentaModel.find | ✅ V2 |
| **GET /api/v2.0/puntoVentas/:id** | sensorDataV2.controller | PuntoVentaModel.findById/findByCode | ✅ V2 |
| **POST /api/v2.0/puntoVentas** | customizationV2.controller | PuntoVentaModel.getOrCreate | ✅ V2 |
| **PATCH /api/v2.0/puntoVentas/:id** | customizationV2.controller | PuntoVentaModel.findById, update | ✅ V2 |
| **DELETE /api/v2.0/puntoVentas/:id** | customizationV2.controller | PuntoVentaModel.delete | ✅ V2 |
| **GET /api/v2.0/puntoVentas/:id/sensors** | customizationV2.controller | PuntoVentaModel.findById | ✅ V2 |
| **GET /api/v2.0/puntoVentas/:id/sensors/readings** | customizationV2.controller | PuntoVentaModel.findById | ✅ V2 |
| **POST /api/v2.0/puntoVentas/:id/sensors** | customizationV2.controller | PuntoVentaModel.findById | ✅ V2 |
| **MQTT saveMultipleSensorsFromMQTT** | postgres.service | PuntoVentaModel.getOrCreate, findByCode | ✅ V2 |
| **MQTT sensor registration** | postgres.service | PuntoVentaModel.findByCode → puntoventasensors | ✅ V2 |
| **Region linking** | postgres.service | RegionPuntoVentaModel.link(puntoVenta.id) | ✅ V2 |
| **region_punto_venta** | regionPuntoVenta.model | puntoventa (punto_venta_id) | ✅ V2 |
| **puntoventasensors** | puntoVentaSensor.model | puntoventa (punto_venta_id) | ✅ V2 |
| **Dev mode generator** | devModeDataGenerator.service | PuntoVentaModel.findAllWithDevModeEnabled | ✅ V2 |
| **MQTT publish topic** | mqttTopic.js | PuntoVentaModel.findByCode | ✅ V2 |
| **Metric notifications** | metricNotification.service | PuntoVentaModel.findByCode | ✅ V2 |
| **Report controller** | report.controller | PuntoVentaModel.findById | ✅ V2 |

---

## ⚠️ Metrics (V2 API) – ID Mismatch After Migration 030

**Issue:** The frontend uses puntos from `GET /api/v2.0/puntoVentas/all` (puntoventa V2). When creating/editing metrics or filtering, it sends `punto_venta_id` = **puntoventa id**. After migration 030, `metrics.punto_venta_id` references **puntoventa_v1**.

| Action | Frontend sends | Backend expects | Gap |
|--------|----------------|-----------------|-----|
| Create metric | puntoventa id | puntoventa_v1 id | ❌ FK violation or wrong mapping |
| Update metric | puntoventa id | puntoventa_v1 id | ❌ Same |
| Filter metrics `?punto_venta_id=X` | puntoventa id | puntoventa_v1 id | ❌ No match |

**Required fix:** Add mapping in the API:

1. **addMetricV2 / updateMetricV2**: When `punto_venta_id` is received, resolve it:
   - If it matches `puntoventa_v1.id` → use as-is.
   - Else treat as `puntoventa.id` → find `puntoventa_v1` where `puntoventa_id = X` and use that `puntoventa_v1.id`.

2. **getMetricsV2** (filter): When `punto_venta_id` is in the query:
   - Same resolution: accept puntoventa id or puntoventa_v1 id and translate to puntoventa_v1 id for `MetricModel.find`.

---

## ⚠️ V1 Routes – ID Mismatch for Dev/Simulate

**Issue:** V1 routes (`/api/v1.0/puntoVentas`) now use `PuntoVentaV1Model`, so the `:id` in the URL is a **puntoventa_v1 id**. But these flows still use `PuntoVentaModel` (puntoventa):

| Route | Uses | Expects id to be |
|-------|------|------------------|
| POST /api/v1.0/puntoVentas/:id/generate-mock-data-now | PuntoVentaModel.findById | puntoventa id |
| POST /api/v1.0/puntoVentas/:id/simulate-sensor | PuntoVentaModel.findById | puntoventa id |
| POST /api/v1.0/puntoVentas/:id/simulate-bajo-nivel-cruda | PuntoVentaModel.findById | puntoventa id |
| POST /api/v1.0/puntoVentas/:id/simulate-nivel-cruda-normalizado | PuntoVentaModel.findById | puntoventa id |
| POST /api/v1.0/puntoVentas/:id/generate-daily-data | PuntoVentaModel.findById | puntoventa id |

**Required fix:** Resolve `puntoventa_v1` id → `puntoventa` id before calling `PuntoVentaModel`:

1. `PuntoVentaV1Model.findById(id)` → get `puntoventaId`.
2. If `puntoventaId` exists, use `PuntoVentaModel.findById(puntoventaId)`.
3. If not (no V2 link), either skip or return an error.

---

## ✅ getMetricsV2 – Punto Name Lookup

`getMetricsV2` uses `PuntoVentaV1Model.findById` to resolve `punto_venta_name` for metrics. After migration 030, `metrics.punto_venta_id` points to `puntoventa_v1`, so this is correct.

---

## Checklist Before Running Migrations

- [ ] Add `punto_venta_id` → `puntoventa_v1.id` mapping in `addMetricV2` and `updateMetricV2`
- [ ] Add `punto_venta_id` resolution in `getMetricsV2` when filtering
- [ ] Add `puntoventa_v1` id → `puntoventa` id resolution in V1 dev/simulate routes (generateMockDataNow, simulateSensor, etc.)

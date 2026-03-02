# Checklist: MQTT Topic Change to Region/Ciudad Structure

## Overview

**Current topic:** `tiwater/CODIGO_TIENDA_001/data`  
**New topic:** `tiwater/CODIGO_REGION/CIUDAD/CODIGO_TIENDA_001/data`

When MQTT receives a message on the new topic, we will:
1. Create Region record if it doesn't exist
2. Create Ciudad record if it doesn't exist (linked to Region)
3. Add Region-PuntoVenta join record if it doesn't exist
4. Create/update PuntoVenta with ciudad_id
5. Store sensor data as before

---

## Phase 1: Database Migrations

### 1.1 Migration 027: Create `regions` and `ciudades` tables ✅

- [x] Create `regions` table: `id`, `code`, `name`, `createdat`, `updatedat`
- [x] Create `ciudades` table: `id`, `name`, `region_id` (FK), `createdat`, `updatedat`
- [x] Create `region_punto_venta` join table: `region_id`, `punto_venta_id`, `createdat`
- [x] Add unique constraints and indexes
- [x] Insert default `NoRegion` record (code='NoRegion', name='Sin región') for backward compatibility

**Run:** `npm run migrate:regions` (no puntoventa dependency)

### 1.2 Migration 028: region_punto_venta + ciudad_id on puntoventa

- [ ] Create `region_punto_venta` join table (requires puntoventa)
- [ ] Add `ciudad_id` column to puntoventa (FK to ciudades, nullable)
- [ ] Create index on `ciudad_id`

**Run:** `npm run migrate:regions:pv` (requires puntoventa table - run `npm run migrate:puntoventa` first)

---

## Phase 2: API / Backend

### 2.1 Models ✅

- [x] Create `RegionModel` (region.model.js): getOrCreate, findByCode, findById
- [x] Create `CiudadModel` (ciudad.model.js): getOrCreate by name+region_id, findByRegion
- [x] Create `RegionPuntoVentaModel` for join
- [x] Update `PuntoVentaModel`: add ciudad_id to create/update, parseRow

### 2.2 MQTT Service ✅

- [x] Subscribe to both `tiwater/+/data` (legacy) and `tiwater/+/+/+/data` (new)
- [x] Update `handleMessage`: parse both formats
- [x] Pass `codigo_region`, `ciudad` to `handleTiwaterData` and `saveMultipleSensorsToPostgreSQL`

### 2.3 PostgresService ✅

- [x] In `saveMultipleSensorsFromMQTT`: accept `codigo_region`, `ciudad` in context
- [x] Get or create Region by codigo_region (use NoRegion if empty)
- [x] Get or create Ciudad by name + region_id
- [x] Get or create PuntoVenta with ciudad_id
- [x] Create region_punto_venta link if not exists
- [x] Update PuntoVenta with ciudad_id when it existed without it

### 2.4 PuntoVenta Controller & Routes

- [ ] Update `updatePuntoVenta`: accept `ciudad_id`, `lat`, `long` (lat/long already supported)
- [ ] Update `buildPuntoResponseFromPostgres`: include `region`, `ciudad` in response
- [ ] Add `GET /api/v2.0/regions` endpoint
- [ ] Add `GET /api/v2.0/ciudades` endpoint (optionally filter by region_id)
- [x] Update `getPuntosVentaV2` / `getPuntoVentaDetalleV2` to join and return region, ciudad

### 2.5 MQTT Publish (simulate, dev generator, etc.) ✅

- [x] Update all publish calls to use new topic: `tiwater/${codigoRegion}/${ciudad}/${codigoTienda}/data`
- [x] For simulate endpoints: get region/ciudad from puntoVenta or use defaults (NoRegion, empty ciudad)
- [x] Add `buildTiwaterTopic(codigoTienda)` helper in `src/utils/mqttTopic.js`
- [x] Update `devModeDataGenerator.service.js` topic format

---

## Phase 3: Frontend

### 3.1 Types

- [ ] Add `region` and `ciudad` to `PuntosVenta` interface
- [ ] Add `Region` and `Ciudad` types if needed

### 3.2 PuntoVenta List (punto-venta-v2.tsx)

- [ ] Add Region column to table
- [ ] Add Region filter dropdown
- [ ] Ensure Ciudad column shows from new structure

### 3.3 PuntoVenta Edit (personalizacion-v2.tsx)

- [ ] Add Region selector (fetch from /regions)
- [ ] Add Ciudad selector (fetch from /ciudades, filter by region)
- [ ] Add Latitud (lat) and Longitud (long) input fields for manual update
- [ ] On save: PATCH with ciudad_id, lat, long
- [x] Add Regiones module: edit region name/code, assign/unassign puntos (admin)

### 3.4 PuntoVenta Detail (punto-venta-detalle-v2.tsx) ✅

- [x] Add Edit button/modal to update region, ciudad, lat, long
- [x] Display region and ciudad in header/info section
- [x] Display lat/long with option to edit

---

## Phase 4: Azure Event Grid & Docs

- [ ] Update topic space template: `tiwater/+/+/+/data` or `tiwater/#`
- [ ] Update `AZURE_EVENT_GRID_MQTT_SETUP.md` with new topic format
- [ ] Update `CLIENT_ARCHITECTURE.md` if it documents MQTT topics

---

## Backward Compatibility

- **Existing topics** `tiwater/CODIGO_TIENDA/data`: Optionally keep supporting for a transition period by checking `topicParts.length === 3` and using NoRegion + empty ciudad.
- **NoRegion**: Default region for puntos without region in MQTT.
- **Existing puntoventa**: ciudad_id = null, no region_punto_venta until they receive MQTT with new format.

---

## File Reference

| Area | Files to modify |
|------|-----------------|
| Migrations | `scripts/migrations/027_*.sql`, `028_*.sql` |
| Models | `region.model.js`, `ciudad.model.js`, `puntoVenta.model.js` |
| MQTT | `mqtt.service.js` |
| Postgres | `postgres.service.js` |
| Controllers | `puntoVenta.controller.js`, `sensorDataV2.controller.js` |
| Routes | `puntoVenta.routes.js`, new `region.routes.js`, `ciudad.routes.js` |
| Frontend | `punto-venta-v2.tsx`, `personalizacion-v2.tsx`, `punto-venta-detalle-v2.tsx`, `types.ts` |
| Dev generator | `devModeDataGenerator.service.js` |

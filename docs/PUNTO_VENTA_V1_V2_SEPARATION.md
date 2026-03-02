# Punto de Venta V1 vs V2 Separation Plan

## Problem

The `puntoventa` table is used by both:
- **V1**: Equipos/products matching, metrics (v1), legacy flow
- **V2**: MQTT sensors, region/ciudad, codigo_tienda, puntoventasensors

This creates conflicts because:
- V1 needs punto–product (equipo) relationships for equipos matching
- V2 needs codigo_tienda, region, ciudad for MQTT topic hierarchy
- Different data sources and lifecycles

## Solution: Create `puntoventa_v1` Table

### Tables

| Table | Purpose | Used by |
|-------|---------|---------|
| **puntoventa** | V2: MQTT sensors, region, ciudad, codigo_tienda | sensorDataV2, MQTT, customizationV2, puntoventasensors, region_punto_venta |
| **puntoventa_v1** | V1: Equipos/products join, metrics | V1 puntoVenta routes, metrics (v1), equipos matching |

### Metrics

- **metrics.punto_venta_id** → references **puntoventa_v1** (V1 metrics flow)
- Metrics table stays as-is; only the FK target changes for V1 usage

### New Tables / Migrations

1. **Migration 029**: Create `puntoventa_v1`
   - Same core columns as puntoventa: id, name, code, clientId, address, lat, long, status, etc.
   - No: ciudad_id, dev_mode (V2-specific)
   - Optional: `puntoventa_v1_products` join table (punto_venta_v1_id, product_id) for equipos matching

2. **Migration 030**: Update `metrics`
   - Add `punto_venta_v1_id` (FK to puntoventa_v1) OR
   - Rename/repurpose `punto_venta_id` to point to puntoventa_v1
   - Decision: Add `punto_venta_v1_id`, keep `punto_venta_id` for backward compat, then migrate

### Code Changes

| Area | Change |
|------|--------|
| **V1 routes** (`/api/v1.0/puntoVentas`) | Use PuntoVentaV1Model, puntoventa_v1 table |
| **V2 routes** (`/api/v2.0/puntoVentas`) | Keep PuntoVentaModel, puntoventa table |
| **Metrics** | punto_venta_id → puntoventa_v1_id (for V1 metrics) |
| **region_punto_venta** | Stays with puntoventa (V2) |
| **puntoventasensors** | Stays with puntoventa (V2) |
| **sensores** | Uses codigotienda; links to puntoventa via codigo_tienda (V2) |

### Linking V1 and V2 (Optional)

If we need to correlate V1 and V2 records:
- Add `puntoventa_v1.puntoventa_id` (FK to puntoventa) — nullable, for sync
- Or use `codigo_tienda` / `code` as logical link (no FK)

### Data Migration

1. Copy existing puntoventa rows to puntoventa_v1 (for V1 consumers)
2. Update metrics.punto_venta_id → metrics.punto_venta_v1_id (new column)
3. Map old punto_venta_id to new puntoventa_v1.id during migration

---

## Open Questions

1. **Products/equipos join**: Does V1 have a `puntoventa_v1_products` (punto_venta_v1_id, product_id) table, or is the link elsewhere (e.g. products have client_id/city)?
2. **Sync**: Should creating a V2 punto (from MQTT) auto-create a V1 punto, or are they managed separately?
3. **Metrics**: Are all metrics V1-only (punto_venta_id → puntoventa_v1), or do we have V2 metrics too?

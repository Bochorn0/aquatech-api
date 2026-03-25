# Merge duplicate Tuya products (same tienda / equipo)

When Tuya replaces a device or you get two rows for the same physical unit (same name, two `device_id`s), you usually want:

1. **One** product row (the current Tuya device).
2. **All** `product_logs` under that canonical product (`product_id` + `product_device_id`).
3. **puntoventa_v1.meta.product_ids** pointing only at the canonical id (numeric or `device_id` string, depending on how you store them).

## Example: Oxxo As de Oros GDL

| Role | `device_id` | Notes |
|------|-------------|--------|
| OLD (remove) | `eb3a4ee3ad618b4696anyi` | |
| NEW (keep)   | `eb49196e47e2711139bfx9` | |

**Order (runner sorts by filename):** run **`043_products_merged_from_device_ids.sql`** first, then **`044_merge_duplicate_products_oxxo_asdeoros.sql`** (after DB backup).

- **043:** adds `merged_from_device_ids` on `products`.
- **044:** updates `product_logs` to the NEW device and FK `product_id`, fixes `puntoventa_v1.meta`, sets `merged_from_device_ids` on the canonical row, `DELETE`s the OLD `products` row.

If `meta.product_ids` uses **only** Postgres numeric ids (`7` → `22`), adjust that JSON manually for the affected punto(s)—do not blindly replace `7` globally.

## Tuya totals → liters (`/10`)

Tuya `flowrate_total_1` / `flowrate_total_2` are typically in **0.1 L** units. The **logs routine** (`fetchLogsRoutine` / `doFetchLogsRoutineWork`) now divides those values by **10** before inserting into `product_logs`, consistent with:

- Product API display (÷10 on status), and  
- Reporte mensual / `generateProductLogsReport` special handling.

`logs.yaml` diffs are for debugging; **persisted metrics** come from DB + routine—ensure routine is enabled on the **canonical** product only after merge.

## Logic layer (not only SQL)

**Migration 043** adds `products.merged_from_device_ids` (JSON array of Tuya `device_id` strings).

- After merge, the **canonical** product row lists superseded ids there (migration **044** step 2b).
- **`ProductModel.findByDeviceId`** resolves:
  - primary `device_id`, or  
  - any row where `merged_from_device_ids` contains that id  

So Tuya sync, logs routine, detalle by device id, and old URLs still hit the **same** product row and the **same** `product_logs` history.

API responses include **`merged_from_device_ids`** so clients can show “Este equipo también absorbió el dispositivo …” for support/audit.

**Equipos / product list:** `getAllProducts` loads superseded Tuya ids from `merged_from_device_ids` and **drops** those devices from the Tuya-driven list so you only see the **canonical** row, even if Tuya still returns the old hardware id. For **Osmosis** rows with `merged_from_device_ids`, **`flowrate_total_1` / `flowrate_total_2`** in the response are the **sum** of raw Tuya values (canonical + merged devices) before the usual ÷10 to liters; **`online`** is true if **any** of those devices is online. **Local-only** DB rows whose `device_id` is superseded are also excluded so the old id does not appear as a second row.

### How this relates to **métricas** (alert rules)

In this codebase, **métricas configuradas** (`metrics` / region metrics) are scoped by **punto de venta** (and sensor/metric **type**), **not** by individual Tuya Osmosis `device_id`.  

After a merge:

- There is **one** product row and **one** stream of logs for that equipo.
- **One** punto still has its **same** metric rules (e.g. NIVEL AGUA CRUDA); they apply to the data that punto sees (sensors / products as you wired them).

If you ever need **different** alert rules per device while both are active, that requires **two** product rows (or extra dimensions on metrics)—merge is for “same physical unit, new Tuya id”.

## Reuse for another pair

1. **043** is already applied once per environment (column exists).  
2. Copy **044** to a new numbered migration (e.g. `045_merge_...sql`), change both `device_id` literals and step **2b** `jsonb_build_array(...)`.

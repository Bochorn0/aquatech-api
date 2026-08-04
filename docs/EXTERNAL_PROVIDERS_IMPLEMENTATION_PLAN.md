# Plan: External Providers (Linghu first) — push ingest + dashboard

**Branch:** `feature/external-providers-linghu-ingest`  
**Repo:** `Aquatech_api`  
**Goal:** Add an **agnostic** external-providers layer (mirror of `tuya.service.js` style), with a **Linghu** adapter first, so meter pushes can land in our DB and the dashboard can read them without hard-coding vendor names in controllers.

---

## 1. Why this shape

| Today | Problem if we copy-paste “linghu.service” only |
|-------|--------------------------------------------------|
| `tuya.service.js` = vendor HTTP client | Next meter vendor = another one-off |
| `puntoVentaSource.service.js` = `mqtt \| tuya \| hybrid` | Need a third telemetry family without exploding `source_type` forever |
| MQTT → `sensores_message` / `sensores` | Push payloads are cumulative volumes (m³), not the same field map as MQTT gateways |

**Approach:**

1. **`externalProviders/`** — registry + shared types + ingest pipeline.  
2. **`providers/linghu/`** — vendor-specific parse/normalize/auth (Linghu push today; pull helpers stubbed if docs appear later).  
3. **Reuse time-series tables** (`sensores_message` / `sensores` / latest) with `resourceType` / meta `source = 'external:<providerId>'`.  
4. **Bindings table** — `device_external_id` → `codigo_tienda` / `puntoventa_id`.  
5. **Extend `source_type`** carefully: add `external` and/or `hybrid` that can include external (see §5).

---

## 2. Target folder layout

```
src/
  services/
    externalProviders/
      index.js                 # getProvider(id), listProviders()
      types.js                 # JSDoc typedefs / constants
      ingest.service.js        # enqueue/ack orchestration (shared)
      persist.service.js       # map normalized reading → sensores*
      binding.service.js       # resolve device → tienda
      providers/
        linghu/
          linghu.provider.js   # id, name, verifyAuth, normalizePush, …
          linghu.mapping.js    # field map, units m³→L, alarm codes
          linghu.client.js     # optional outbound helpers (stubs OK)
  controllers/
    externalProviderIngest.controller.js   # POST webhook(s)
    # later: externalProviderAdmin.controller.js for bindings CRUD
  routes/
    externalProvider.routes.js
  models/postgres/
    deviceBinding.model.js     # NEW
  migrations/
    YYYYMMDD_device_bindings.sql
  utils/
    externalProviderAuth.js    # shared secret / HMAC helpers
```

**Naming:** public HTTP path should stay agnostic, e.g.:

- `POST /api/v2.0/ingest/external/:providerId/readings`  
- Provider id for Linghu: `linghu` (config + registry key only).

---

## 3. Data model

### 3.1 New table: `device_bindings`

| Column | Type | Notes |
|--------|------|--------|
| `id` | serial PK | |
| `provider` | text NOT NULL | e.g. `linghu` |
| `external_device_id` | text NOT NULL | `device_number` / IMEI |
| `external_imei` | text NULL | optional secondary key |
| `puntoventa_id` | int NULL FK | prefer this when known |
| `codigo_tienda` | text NOT NULL | join key used by sensores MQTT path |
| `client_id` | int NULL | scope |
| `active` | boolean default true | |
| `meta` | jsonb | raw enroll info |
| `created_at` / `updated_at` | timestamptz | |

**Unique:** `(provider, external_device_id)` where active (or unique always + soft-delete).

Unmapped pushes → store in **dead-letter / ingest_log** (see §3.3) **without** inventing a PV.

### 3.2 Reuse: `sensores_message` + `sensores`

Normalized reading → one message + N detail rows (same pattern as MQTT):

Suggested meta / dimensions:

- `resourceType`: `tiwater` (keep dashboard filters) **or** `external` if we want clean split — **decision in P2** (recommend keep `tiwater` + `meta.source = 'external:linghu'` so V2 detalle needs minimal change).
- `resourceId`: external device id or binding id.
- `codigoTienda`: from binding.
- Sensor `name` / `type` examples:
  - `volume_positive` / `volume_reverse` (store **liters**; convert ×1000 from m³)
  - `temperature`, `pressure` (`para_b`), `flow_instant` (`para_a`)
  - `voltage_meter`, `signal_meter`, alarm flags as 0/1 metrics or meta.alarms

### 3.3 Optional: `external_ingest_log`

For ops at 24k scale (retries, DLQ, unmapped):

| Column | Notes |
|--------|--------|
| `id`, `provider`, `received_at` | |
| `external_device_id`, `idempotency_key` | unique for dedupe |
| `status` | `queued` / `persisted` / `unmapped` / `failed` |
| `payload` | jsonb (or omit in prod via flag) |
| `error` | text |

Phase 1 can log to app logger only; table recommended before prod scale.

---

## 4. Push flow (runtime)

```
Linghu ──POST──► WAF ──► POST /api/v2.0/ingest/external/linghu/readings
                              │
                              ├─ verifyAuth (header secret / HMAC)
                              ├─ linghu.normalizePush(body)
                              ├─ build idempotency key (device + volume_time)
                              ├─ binding.service.resolve(...)
                              ├─ [P1 sync] persist.service.saveNormalizedReading(...)
                              │     or [P2+] enqueue → worker
                              └─ res 200 { code: "200", message: "" }  (< 5s)
```

**P1 (MVP):** synchronous persist if DB write is fast enough for pilot (&lt;50 stores).  
**P2:** Azure Service Bus / queue + worker process (mirror mqtt-consumer separation) before 24k.

Linghu response contract (vendor doc): HTTP 200 + `{ "code": "200", "message": "" }`.

---

## 5. Dashboard / `source_type`

### Option A (recommended for PR series)

Extend:

```js
SOURCE_TYPES = ['mqtt', 'tuya', 'hybrid', 'external']
```

- `external` → online/last reading from sensores where `meta.source` starts with `external:` (or binding-linked `codigo_tienda`).
- `hybrid` → keep MQTT ∨ Tuya; later `hybrid` may also OR external if we add flags, **or** introduce `meta.sources: ['mqtt','external']` without more enums.

### Option B

Keep `mqtt` for “tienda sensors” and treat external pushes as another writer into the same MQTT-shaped tables (dashboard unchanged). Binding alone links device→tienda.

**Recommendation:** **B for first reading PR** (fastest UX), then **A** when customization UI must distinguish vendor.

Dashboard path after persist:

1. Existing `sensorDataV2` detalle / historico by `codigo_tienda` already reads `sensores` + `sensores_message`.  
2. Enrichment: optional `enrichDetalleWithExternal` in `puntoVentaSource.service.js` (parallel to `enrichDetalleWithTuya`) for labels / “última lectura fabricante”.

---

## 6. Provider interface (agnostic contract)

Each provider module exports something like:

```js
export default {
  id: 'linghu',
  displayName: 'Linghu meter platform',
  verifyAuth(req, config): boolean | Promise<boolean>,
  normalizePush(body): NormalizedReading,  // throws ValidationError
  // Optional outbound (stubs until vendor documents pull APIs):
  getDeviceDetail?(externalId): Promise<Result>,
  listDevices?(): Promise<Result>,
};
```

`NormalizedReading` (shared):

```js
{
  provider: 'linghu',
  externalDeviceId: string,
  imei?: string,
  observedAt: Date,          // volume_time / create_time
  idempotencyKey: string,
  metrics: Array<{ name, type, value, unit }>,
  alarms?: Record<string, number|boolean>,
  raw?: object,              // stripped in prod
}
```

`tuya.service.js` stays as-is (equipos cloud). External providers = **meter push / third-party telemetry**, not a replacement for Tuya.

---

## 7. Config / security

Env (examples):

```
EXTERNAL_PROVIDERS_ENABLED=true
LINGHU_INGEST_SECRET=...          # or EXTERNAL_PROVIDER_LINGHU_SECRET
LINGHU_INGEST_ALLOWLIST_IPS=      # optional
# later queue:
EXTERNAL_INGEST_QUEUE_URL=
```

- No JWT for webhook (machine-to-machine).  
- Rate limit dedicated route.  
- Never log full secrets; payload logging behind flag.

---

## 8. Implementation phases (PR-friendly checkpoints)

Work **point by point** on this branch (or stacked PRs from same branch commits).

| # | Deliverable | Done when |
|---|-------------|-----------|
| **P0** | This plan + branch | ✅ |
| **P1** | Scaffold `externalProviders/` + Linghu provider (normalize + verifyAuth) | ✅ unit tests mapping |
| **P2** | Migration `device_bindings` + `external_ingest_log` + models + `binding.service` | ✅ |
| **P3** | `persist.service` → `sensores_message` / `sensores` / `sensor_latest` | ✅ |
| **P4** | Ingest controller + routes + Linghu JSON ack | ✅ `POST /api/v2.0/ingest/external/:providerId/readings` |
| **P5** | Dashboard: confirm V2 detalle/historico; tweak `source_type` / enrichment if needed | ✅ `external` + `externalMeters` |
| **P6** | Harden idempotency ops / DLQ visibility | partial (log table exists) |
| **P7** | Async queue + worker | pending |
| **P8** | Admin API/UI bindings | pending |

---

## 9. Out of scope (this story)

- Front UI for bindings (unless needed for pilot — separate front PR).  
- Replacing Tuya / MQTT.  
- Prices / commercial terms.  
- Assuming a Linghu **pull** API (not in current PDF) — only stubs in `linghu.client.js`.

---

## 10. Suggested first coding step after plan approval

**P1 only:** create `src/services/externalProviders/` with registry + `providers/linghu/linghu.mapping.js` + tests for `normalizePush` using the documented payload shape (including known PDF typos). No routes yet.

Confirm with stakeholders:

1. Persist into existing `sensores*` with `meta.source = 'external:linghu'`? (**yes recommended**)  
2. New `source_type: 'external'` in P5 or later?  
3. Sync persist in P4 vs queue-from-day-one?

---

## 11. Traceability

- Vendor doc: *APIPlatform push interface documentation* (Linghu).  
- Architecture PDF: dual path MQTT + API push.  
- Parallel patterns: `tuya.service.js`, `mqtt.service.js` → Postgres, `puntoVentaSource.service.js`.

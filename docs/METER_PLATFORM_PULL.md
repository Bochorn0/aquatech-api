# Meter platform pull integration

**Branch:** `feature/external-providers-meter-platform-pull`  
**Docs source:** `Documentation/05_Water-Gas-Meter-WebManagementPlatform-API-Doc-EN.pdf`, `Documentation/api_response.md`

## Model

Meters talk **TCP** to the vendor master station (`47.97.252.2:2205`). MQTT push to Aquatech is **not** available. We **PULL** REST + JWT from `METER_PLATFORM_BASE_URL` (default `http://47.97.252.2/prod-api`).

| Step | Endpoint / action |
|------|-------------------|
| Login | `POST …/app/login` or `/login` → Bearer token |
| List | `GET /getDeviceInfoList` |
| Latest | `GET /device/deviceInfo/deviceExtend/{deviceCode}` |
| History | `GET /device/deviceConnRecord/list?deviceCode=` |
| Valve (async) | `POST /valueControl` |

## Config (`.env`)

```
METER_PLATFORM_BASE_URL=http://47.97.252.2/prod-api
METER_PLATFORM_USERNAME=
METER_PLATFORM_PASSWORD=
METER_PLATFORM_LOGIN_PATH=/app/login
METER_PLATFORM_VOLUME_UNIT=auto
```

Do not call the live host until the vendor account is filled in (demo login in the Q&A is blank).

## Ops API (JWT; sync also accepts `X-Cron-Secret`)

- `GET /api/v2.0/external-providers/status` — includes `meter-platform` with `mode: pull`
- `GET /api/v2.0/external-providers/meter-platform/login-test`
- `POST /api/v2.0/external-providers/meter-platform/bindings` — `{ deviceCode, codigoTienda, … }`
- `POST /api/v2.0/external-providers/meter-platform/sync`
  - Body: `{ deviceCode? }` one meter, or omit to sync all **active bindings**
  - `{ discover: true }` — list from platform then sync (still needs bindings to persist mapped)
  - `{ persist: false }` — normalize only (dry-run)
  - Cron: same secret as Tuya logs (`CRON_METER_PLATFORM_SECRET` or `CRON_TUYA_LOGS_SECRET`)

## Flow

1. Bind `deviceCode` → `codigo_tienda` (`device_bindings`, provider `meter-platform`).
2. Cron or manual sync → latest **conn `report`** (preferred) + `deviceExtend` → normalize (m³→L) → `sensores*`.
3. Dashboard: `source_type: external` (same as Linghu path).

### Live payload notes (demo account)

- Login works on both `/app/login` (token in `data.token`) and `/login` (token at root).
- `deviceExtend` nests profile under `deviceInfo` (`totalMetering`, `isOnline: "on_line"`, Chinese `valveDesc`).
- Rich metrics (`currentForwardUsage`, `batteryVoltage`, `dailyUsageMap`) live in conn `analyticalBody` → `meterReportRequest`.

## Not in this PR

- Live credential smoke test against `47.97.252.2`
- Scheduled Azure Logic App wiring (endpoint ready)
- Valve control UI / command queue
- MQTT if vendor adds it later

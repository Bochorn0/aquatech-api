# Exporting logs for OOM / MQTT load analysis

When the API runs out of memory (OOM), often under MQTT mocker load, you need logs to find patterns and reinforce the server. This guide explains how to export and what to look for.

---

## 1. Where the API runs

- **Azure App Service** (typical production): Log stream + Download logs / Log blob.
- **VM / PM2**: Application logs + system logs (dmesg, journalctl) for OOM killer.

Use the section below that matches your host.

---

## 2. Azure App Service – export logs

### Option A: Log stream (real time)

1. **Azure Portal** → your **App Service** (API) → **Monitoring** → **Log stream**.
2. Leave it open during an MQTT mocker run or until you see errors.
3. Copy the relevant portion (e.g. from “Publishing” to “Out of memory” or restart) and save as a `.txt` or paste into a file like `logs-oom-YYYY-MM-DD.txt`.

### Option B: Download / blob (batch)

1. **App Service** → **Monitoring** → **App Service logs**:
   - Set **Application Logging** to **File System** (or **Blob** for long retention).
   - **Level**: Information or Verbose (to see MQTT and DB activity).
   - **Save**.
2. **Advanced Tools (Kudu)** → **Debug console** → **CMD** or **PowerShell**:
   - Go to `D:\home\LogFiles\Application\` (Windows) or `/home/LogFiles/Application/` (Linux).
   - Download the latest `*_default_docker.log` (or similar) or the whole `Application` folder.
3. Or enable **Log stream to Azure Monitor (Application Insights)** and query there (see below).

### Option C: Application Insights (if enabled)

1. **Application Insights** → **Logs**.
2. Example queries to run around the time of OOM:

```kusto
// Exceptions and errors before OOM
traces
| where timestamp > ago(2h)
| where message contains "Error" or message contains "OOM" or message contains "memory" or message contains "FATAL"
| order by timestamp desc

// MQTT / tiwater activity (high volume = many concurrent saves)
traces
| where timestamp > ago(2h)
| where message contains "MQTT" or message contains "tiwater" or message contains "PostgresService"
| summarize count() by bin(timestamp, 1m)
| order by timestamp desc
```

Export results (e.g. **Export to CSV**) and keep a copy with a name like `oom-analysis-YYYY-MM-DD.csv`.

---

## 3. What to capture for OOM analysis

When exporting, try to include:

| What to capture | Why |
|-----------------|-----|
| **Time window** | From ~10–15 min before OOM/restart until the failure. |
| **MQTT volume** | Lines like `[MQTT] 📨 Mensaje recibido` or `Publishing … MQTT messages` (from mocker). Count or rate per minute. |
| **Postgres / API** | `[PostgresService]`, `timeout exceeded when trying to connect`, `Error saving`, `FATAL`, `Out of memory`, `JavaScript heap out of memory`. |
| **Concurrent work** | Many `Guardando corriente` / `Sensor data saved` in a short window → many concurrent tiwater saves. |
| **Restart/crash** | “Application is restarting”, “Worker process exited”, “FATAL ERROR: … CALL_AND_RETRY_LAST … JavaScript heap out of memory”. |

Save these as:

- **One file per incident**: e.g. `logs-oom-2026-03-11.txt` (or the CSV from App Insights).
- **Optional**: a short **notes** file (e.g. `oom-notes-2026-03-11.md`) with: time of OOM, mocker settings (`MQTT_LOAD_PUNTOS_COUNT`, `MQTT_LOAD_INTERVAL_MINUTES`), and any change (e.g. “increased interval to 3 min”).

---

## 4. Patterns that suggest OOM from MQTT load

- **Burst of MQTT messages** (e.g. 30–135 in one minute) followed by:
  - Many `[PostgresService]` / `Guardando corriente` lines in the same second.
  - Then `timeout exceeded when trying to connect` or DB errors.
  - Then `JavaScript heap out of memory` or process exit.
- **RSS/heap growth** over minutes (if you log or sample `process.memoryUsage()`) with message rate.
- **Repeated OOM** when mocker runs every 1 min, and **no OOM** when interval is 2–3 min or puntos count is lower.

These support: “too many concurrent tiwater saves and DB/API work → memory and connections exhausted.”

---

## 5. Sharing logs for analysis

- **Do**: Share **plain text** logs (or CSV) in a **private** channel or with the person doing the analysis. Redact secrets (tokens, connection strings, PII) if needed.
- **Do**: Include the **time window** and **mocker config** (puntos count, interval).
- **Don’t**: Commit unredacted logs with secrets into the repo.

Example placeholder for a ticket or chat:

```text
OOM on API around 2026-03-11 16:42 UTC. Attached:
- logs-oom-2026-03-11.txt (App Service log stream export, ~15 min)
- Mocker: MQTT_LOAD_PUNTOS_COUNT=30, MQTT_LOAD_INTERVAL_MINUTES=1
```

---

## 6. Server-side reinforcements (already or to apply)

To reduce OOM risk under MQTT mocker load:

| Measure | Where | Purpose |
|--------|--------|--------|
| **Tiwater save queue** | API: `mqtt.service.js` | Limit concurrent tiwater→PostgreSQL saves (e.g. 5–10). Avoids 30–135 concurrent DB operations per burst. |
| **MQTT_TIWATER_SAVE_CONCURRENCY** | API env (e.g. Azure App settings) | Max concurrent tiwater saves. Default `10`; keep below Postgres connection limit. |
| **MQTT_TIWATER_QUEUE_MAX** | API env | Max queued tiwater jobs (default `200`); excess are dropped to avoid unbounded memory. |
| **Mocker: fewer puntos** | Mocker: `MQTT_LOAD_PUNTOS_COUNT` | e.g. 15–20 instead of 30–135. |
| **Mocker: longer interval** | Mocker: `MQTT_LOAD_INTERVAL_MINUTES` | e.g. 2 or 3 so bursts are less frequent. |
| **Postgres pool** | API: `postgres.config.js` | `max` connections slightly above `MQTT_TIWATER_SAVE_CONCURRENCY` + HTTP usage. |
| **Node heap** | Azure: `NODE_OPTIONS=--max-old-space-size=1536` (or higher if plan allows) | Gives more headroom before heap OOM (does not fix leaks). |

After applying the tiwater queue and env vars, reproduce with the same mocker settings and export logs again to confirm lower concurrency and no OOM.

**Where to set API env (Azure):** App Service → **Configuration** → **Application settings** → add `MQTT_TIWATER_SAVE_CONCURRENCY` and optionally `MQTT_TIWATER_QUEUE_MAX`. Restart the app after changing.

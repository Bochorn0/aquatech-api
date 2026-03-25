# Azure: Migrations – connection limit and long-running steps

## "remaining connection slots are reserved for replication"

### What it means

Azure Database for PostgreSQL reserves a few connection slots for replication. When the rest are in use (e.g. by the running API), the migration job cannot get a connection and fails with:

```text
remaining connection slots are reserved for azure replication users
```

So migrations are failing because the **database is at its connection limit**, not because the migration script is wrong.

---

## What we did in code

- **Retry with backoff**: `run-all-migrations.js` retries the initial connection up to 5 times (configurable) with an 8s delay between attempts. A slot may free up and the next attempt can succeed.
- **Workflow**: The deploy workflow sets `MIGRATE_CONNECT_RETRIES=6` and `MIGRATE_CONNECT_RETRY_DELAY_MS=10000` so migrations get about 6 tries with 10s between them (~1 minute of retries).

If it still fails after retries, use one of the options below.

---

## Options if migrations keep failing

### 1. Run migrations when the API uses fewer connections

- Run the migration step **before** the app holds many connections (e.g. run migrations in a separate job that runs at low traffic, or right after a scale-down).
- Or run migrations **manually** from a machine that connects when the API is idle (e.g. scale to 0, run migrate, scale back up).

### 2. Increase DB connection limit (Azure)

- In **Azure Portal** → your PostgreSQL server → **Server parameters**, check `max_connections` (and any tier limit).
- On Flexible Server you can raise it within the tier limit; then ensure the API pool size stays below the new limit.

### 3. Lower API pool size

- In the API’s Postgres config, reduce `max` pool size so the app uses fewer connections and leaves room for the migration (and replication). Example: if the DB allows 50 and reserves 5, set pool `max` to something like 20–30 so migrations can connect during deploy.

### 4. Run migrations outside the deploy pipeline

- Run `npm run migrate:deploy` from a scheduled job or a one-off step when traffic is low, instead of in the same workflow that deploys the API. That way the deploy doesn’t depend on a free slot at peak connection usage.

---

## Env vars for the migration script

| Variable | Default | Description |
|--------|---------|-------------|
| `MIGRATE_CONNECT_RETRIES` | 5 | Number of connection attempts before giving up. |
| `MIGRATE_CONNECT_RETRY_DELAY_MS` | 8000 | Delay in ms between attempts. |

Use these in CI (e.g. in the workflow `env` block) to tune retries.

---

## Migrations "taking forever" (index builds)

Creating indexes on large tables (e.g. **sensores**, **product_logs**) can take **5–20+ minutes** because PostgreSQL must scan the whole table to build the index. The deploy workflow sets **timeout-minutes: 30** for the migrate step so these runs can finish.

- Logs will show: `Running 036_... (index build on large table may take 5–20 min)...` so you know it's not stuck.
- If the job is still killed, run the pending index migrations manually during low traffic (same SQL), then re-run the pipeline so the migration tracker marks them applied.

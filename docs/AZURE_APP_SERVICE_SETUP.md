# Azure App Service Setup for Aquatech API

## Required Configuration

### 1. GitHub Secrets (for deployment)

In your repo: **Settings → Secrets and variables → Actions**, add:

| Secret | Value | Required |
|--------|-------|----------|
| `POSTGRES_HOST` | `tiwaterprod.postgres.database.azure.com` | Yes |
| `POSTGRES_DB` | `postgres` | **Yes** – migrations run on this DB |
| `POSTGRES_USER` | `AdminTiWater` | Yes |
| `POSTGRES_PASSWORD` | Your tiwaterprod admin password | Yes |
| `POSTGRES_PORT` | `5432` | Optional (default) |
| `POSTGRES_SSL` | Handled by workflow | No (injected automatically) |

**Important:** `POSTGRES_DB` must be `postgres` because migrations were run against that database.

### 2. Azure App Service Application Settings

In **Azure Portal → App Service (lccapp) → Configuration → Application settings**, add:

| Name | Value |
|-----|--------|
| `POSTGRES_HOST` | `tiwaterprod.postgres.database.azure.com` |
| `POSTGRES_DB` | `postgres` |
| `POSTGRES_USER` | `AdminTiWater` |
| `POSTGRES_PASSWORD` | Your tiwaterprod admin password |
| `POSTGRES_SSL` | `true` |
| `SECRET_KEY` | A random string for JWT signing (e.g. `openssl rand -base64 32`) |

These override any `.env` in the deployment and ensure the running app uses the correct database.

**Important:** `SECRET_KEY` is required for login. Without it you'll get `secretOrPrivateKey must have a value`.

### Optional: Tuya device sync

To sync devices from Tuya Cloud, add:

| Name | Value |
|------|-------|
| `TUYA_CLIENT_ID` | Your Tuya Cloud access key |
| `TUYA_CLIENT_SECRET` | Your Tuya Cloud secret |
| `TUYA_API_URL` | `https://openapi.tuyaus.com` (or your region) |

Without these, the app uses products from the database only (no Tuya sync).

### 3. MQTT – Azure Event Grid (required for simulate endpoints)

To use Azure Event Grid MQTT instead of the old Mosquitto server, add these settings:

| Name | Value |
|------|-------|
| `MQTT_BROKER` | `tiwatermqtt.eastus-1.eventgrid.azure.net` |
| `MQTT_PORT` | `8883` |
| `MQTT_USE_TLS` | `true` |
| `MQTT_USERNAME` | `tiwater-api-consumer` |
| `MQTT_CLIENT_ID` | `tiwater-api-consumer-session1` |
| `WEBSITES_INCLUDE_CLOUD_CERTS` | `true` |

**Note:** `WEBSITES_INCLUDE_CLOUD_CERTS=true` is required for Event Grid TLS on App Service Linux (fixes "socket disconnected before secure TLS connection").

**Certificates (choose one):**

- **Option A – Base64 in App Settings** (recommended for Azure; no file deployment):
  - `MQTT_CLIENT_CERT_B64` = base64 of `tiwater-api-consumer.pem`
  - `MQTT_CLIENT_KEY_B64` = base64 of `tiwater-api-consumer.key`
  - Generate: `base64 -i tiwater-api-consumer.pem | tr -d '\n'` (and same for `.key`)

- **Option B – File paths:** Deploy certs in `certs/` and set `MQTT_CLIENT_CERT_PATH=./certs/tiwater-api-consumer.pem`, `MQTT_CLIENT_KEY_PATH=./certs/tiwater-api-consumer.key`

**Important:** Do **not** set `MQTT_PASSWORD` for Event Grid. Event Grid uses X.509 only; a password can cause connection failures.

Without these, the API uses the default broker (`146.190.143.141`) and simulate endpoints (e.g. `simulate-bajo-nivel-cruda`) publish to the old server.

**Test:** After deploy, call `GET https://your-app.azurewebsites.net/api/v1.0/mqtt/status` (no auth). It shows `broker`, `isConnected`, `hasCert`, `certSource`. If `isConnected: false`, check App Service logs and the `hint` field.

See `docs/AZURE_EVENT_GRID_MQTT_SETUP.md` for Event Grid namespace setup (topic space, client, permission bindings).

### 4. Azure PostgreSQL Firewall (tiwaterprod)

The App Service must be allowed to connect to tiwaterprod:

1. **Azure Portal** → **PostgreSQL flexible servers** → **tiwaterprod**
2. **Settings** → **Networking** (or **Connection security**)
3. Enable **Allow public access from any Azure service within Azure to this server**
4. Save

Without this, the App Service will get connection timeouts.

### 5. Verify

After redeploying:

- Check App Service logs for `[PostgreSQL] ✅ Connected successfully`
- Try login at `https://<your-app>.azurewebsites.net/api/v1.0/auth/login`

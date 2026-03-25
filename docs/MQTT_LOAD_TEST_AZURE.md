# MQTT Load Test in Azure (30–135 puntos, every minute)

## Goal

- Simulate **30–135 puntos de venta** sending one MQTT message each **every minute**.
- Test how MQTT (and your consumer) handle that traffic.
- **Do not** add load to the main API: the job must run **outside** the API process so the API processing queue is not affected.

## Recommended approach: Azure Functions (Timer trigger)

| Option | Pros | Cons |
|--------|------|------|
| **Azure Functions (Timer)** | Decoupled from API; pay-per-execution; runs every minute on schedule; same MQTT/topic/payload as API | Separate deployment and env (MQTT_* in Function App settings) |
| Logic Apps + HTTP to API | No custom MQTT code | API still does the publish → uses API CPU/connection; not fully decoupled |
| Separate VM/Container with cron | Full control | More ops and cost; overkill for “every minute” |

**Recommendation:** Use a **Timer-triggered Azure Function** that:

1. Runs on a schedule (e.g. `0 * * * * *` = every minute).
2. Connects to the **same MQTT broker** (same `MQTT_BROKER`, TLS/certs) as the API.
3. Builds **30–135 mock payloads** (same shape as `buildMockTiwaterPayload` / `tiwater/REGION/CIUDAD/CODIGO/data`) and publishes them.
4. Disconnects when done.

The API (and its MQTT consumer) only **receive** these messages; they do **not** run the timer or the publish loop, so the API processing queue is not sacrificed.

## Architecture

```
┌─────────────────────────────────┐     MQTT publish      ┌──────────────────┐
│  Azure Function (Timer)          │ ───────────────────►  │  MQTT Broker      │
│  - Every 1 min                   │  30–135 msgs/min     │  (e.g. Event Grid │
│  - 30–135 puntos (configurable)  │                      │   or Mosquitto)   │
│  - Own MQTT client                │                      └────────┬─────────┘
└─────────────────────────────────┘                                 │
                                                                    │ subscribe
                                                                    ▼
┌─────────────────────────────────┐                      ┌──────────────────┐
│  Aquatech API (separate app)     │ ◄─────────────────── │  MQTT consumer   │
│  - No timer, no publish loop     │   process messages   │  (e.g. mqtt-     │
│  - Only processes incoming msgs  │                      │  consumer / API) │
└─────────────────────────────────┘                      └──────────────────┘
```

## What’s in the repo

- **`/lcc_mqtt_mocker`** – Lcc_mqtt_mocker: Azure Functions (Node v4) app:
  - One Timer function: runs every minute by default, or every N minutes via `MQTT_LOAD_INTERVAL_MINUTES` (1, 2, 3, …).
  - Reads `MQTT_LOAD_PUNTOS_COUNT` (default 30; use 1–135). Lower to reduce load.
  - Reads `MQTT_LOAD_INTERVAL_MINUTES` (optional): run every N minutes (e.g. 2 or 3) to ease server load.
  - Uses same topic format: `tiwater/REGION/CIUDAD/CODIGO/data` and same mock payload shape as the API.
  - Reuses the same MQTT env vars as the API (`MQTT_BROKER`, `MQTT_PORT`, TLS/certs, etc.) so traffic is identical.

### API: limiting PostgreSQL concurrency

When many MQTT messages arrive at once (e.g. 135/min), the API **queues** tiwater→PostgreSQL saves and processes them with a **concurrency limit** so the Postgres pool is not exhausted (`timeout exceeded when trying to connect`). You can tune this in the **API** app settings:

| Variable | Default | Description |
|----------|--------|-------------|
| `MQTT_TIWATER_SAVE_CONCURRENCY` | `10` | Max number of tiwater saves to PostgreSQL running at the same time. Keep below `POSTGRES_MAX_CONNECTIONS` (e.g. 20) so other requests can use the pool. |

No change is required for 30–135 puntos; the default keeps concurrent DB writes within a safe limit.

## How to create the resource

You need an **Azure Function App** (the “resource” that will run the timer and publish to MQTT). Choose one way below.

### Plan type: Consumption vs Flex Consumption

| Plan | Best for | Notes |
|------|----------|--------|
| **Consumption (Serverless)** | Simple “run every minute” load test; minimal cost; no VNet needed | Pay per execution + free monthly grant. Cold start possible on first run. |
| **Flex Consumption** | Same as above, but you want **faster scaling**, **VNet** (e.g. MQTT in a private network), or **configurable memory** (e.g. 512 MB–4 GB) | GA (Linux, Node 18/20/22). On-demand billing or “always-ready” instances. [Docs](https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-plan). |

For this MQTT load test (one short run per minute), **Consumption** is usually enough. Use **Flex Consumption** if your MQTT broker is only reachable via VNet or you want to avoid cold starts.

### “Select a hosting option” (Portal)

When the portal asks **Select a hosting option**, you’ll see:

| Option | Scale to zero | Virtual networking | Best for this load test? |
|--------|----------------|--------------------|---------------------------|
| **Flex Consumption** | ✓ | ✓ | Yes – use if you need VNet or faster scale. |
| **Functions Premium** | No (min 1 instance) | ✓ | No – overkill and always-on cost. |
| **App Service** | No | ✓ | No – for web + functions on a fixed plan. |
| **Container Apps environment** | No | ✓ | No – for containerized workloads. |
| **Consumption** | ✓ | No | **Yes – cheapest.** Pay only when the timer runs; often free tier. |

**Pick for cheapest:** **Consumption** – you only pay for the seconds the function runs each minute (plus a small storage cost). There’s a free monthly execution grant, so this load test often stays within free tier.  

Use **Flex Consumption** only if you need VNet or Always Ready; it can cost more. Ignore Premium, App Service, and Container Apps for this scenario.

**If the portal shows a confirmation:** *"Flex Consumption is now the recommended serverless hosting plan... Are you sure you want to continue with the Consumption plan?"* – choose **Yes, continue with Consumption**. That message is Azure promoting Flex; for this timer-based load test, Consumption is still the cheapest and is fine to use.

### Option A: Azure Portal (click-through)

1. **Sign in:** [portal.azure.com](https://portal.azure.com).
2. **Create resource:** Click **Create a resource** → search **Function App** → **Create**.
3. **Basics:**
   - **Subscription:** yours  
   - **Resource group:** create new (e.g. `rg-aquatech-loadgen`) or use existing  
   - **Function App name:** e.g. `MQTT-MOCKER` or `Lcc_mqtt_mocker` (must be globally unique)  
   - **Runtime:** **Node.js**  
   - **Version:** **22** (LTS), **20**, or **18** – all supported; 22 is current LTS  
   - **Region:** same as your MQTT broker / API if possible  
   - **Operating system:** **Linux** (recommended for Node.js; use Windows only if you have a specific need)  
   - **Plan type:** **Consumption (Serverless)** or **Flex Consumption** (see table above)  
4. **Storage:** Create new storage account (required for standard Consumption) or select existing. *(Flex Consumption does not use a storage account for the plan.)*  
5. Click **Review + create** → **Create**. Wait until the app is created.
6. **Configure MQTT and load settings:**
   - Open your new Function App → **Settings** → **Environment variables** (or **Configuration** → **Application settings**).
   - Click **+ Add application setting** and add the same MQTT variables your API uses, for example:
     - `MQTT_BROKER` = your broker hostname  
     - `MQTT_PORT` = `8883` (or `1883`)  
     - `MQTT_USE_TLS` = `true` (or `false`)  
     - `MQTT_USERNAME` = your MQTT username (if any)  
     - `MQTT_PASSWORD` = your MQTT password (if any)  
     - If using Azure Event Grid / client certs: `MQTT_CLIENT_CERT_B64`, `MQTT_CLIENT_KEY_B64` (base64 strings)  
   - Add the load-test setting:
     - `MQTT_LOAD_PUNTOS_COUNT` = `30` (or up to `135`)  
   - Save (e.g. **Apply** or **Save**).
7. **Deploy the code** (see “Deploy the code” below).

### Option B: Azure CLI (copy-paste)

Prerequisites: [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) installed and logged in (`az login`).

```bash
# Set these to your values
RESOURCE_GROUP="rg-aquatech-loadgen"
LOCATION="eastus"
STORAGE_ACCOUNT="saqloadgen"
FUNCTION_APP="MQTT-MOCKER"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create storage account (required for Functions)
az storage account create --name $STORAGE_ACCOUNT --resource-group $RESOURCE_GROUP --location $LOCATION --sku Standard_LRS

# Create Function App (Node 22, Consumption, Linux)
az functionapp create \
  --resource-group $RESOURCE_GROUP \
  --consumption-plan-location $LOCATION \
  --runtime node \
  --runtime-version 22 \
  --functions-version 4 \
  --name $FUNCTION_APP \
  --storage-account $STORAGE_ACCOUNT \
  --os-type Linux
```

Then add application settings (use the same MQTT values as your API):

```bash
az functionapp config appsettings set --name $FUNCTION_APP --resource-group $RESOURCE_GROUP --settings \
  MQTT_BROKER="your-broker.events.data.microsoft.com" \
  MQTT_PORT="8883" \
  MQTT_USE_TLS="true" \
  MQTT_USERNAME="your-username" \
  MQTT_LOAD_PUNTOS_COUNT="30"
# If you use client certs, add: MQTT_CLIENT_CERT_B64="..." MQTT_CLIENT_KEY_B64="..."
```

After that, **deploy the code** (see below).

---

## Next steps after the Function App is created

Once the Function App resource exists in Azure, do the following in order.

### Step 1: Configure Application settings (MQTT + load + storage)

In the [Azure Portal](https://portal.azure.com): open your Function App → **Settings** → **Environment variables** (or **Configuration** → **Application settings**).

**Required for all plans:** The runtime needs a storage account. Ensure **`AzureWebJobsStorage`** is set:

- If **publish** says it’s missing, create a Storage account and add it:
  1. **Create Storage account:** Portal → **Create a resource** → search **Storage account** → **Create**. Use the **same subscription and resource group** as your Function App (e.g. the one that contains MQTT-MOCKER). Pick a unique **Storage account name** (e.g. `mqttmockerstorage`), **Region** same as the Function App, **Performance** Standard, **Redundancy** LRS. Review + create → **Create**.
  2. **Get connection string:** Open the new Storage account → **Security + networking** → **Access keys** → under **key1**, copy the **Connection string** (click Show if needed).
  3. **Add to Function App:** Function App → **Configuration** → **Application settings** → **+ Add** → Name: `AzureWebJobsStorage`, Value: paste the connection string → **OK** → **Save**.

Then add (or confirm) these settings, using the **same values as your Aquatech API**:

| Name | Example | Required |
|------|--------|----------|
| `MQTT_BROKER` | Your broker hostname | Yes |
| `MQTT_PORT` | `8883` or `1883` | Yes |
| `MQTT_USE_TLS` | `true` or `false` | Yes |
| `MQTT_USERNAME` | Your MQTT username | If your broker uses it |
| `MQTT_PASSWORD` | Your MQTT password | If your broker uses it |
| `MQTT_CLIENT_CERT_B64` | Base64 client cert | If using Event Grid / client certs |
| `MQTT_CLIENT_KEY_B64` | Base64 client key | If using Event Grid / client certs |
| `MQTT_LOAD_PUNTOS_COUNT` | `30` (or 1–135; lower = less load) | Yes – number of messages per run |
| `MQTT_LOAD_INTERVAL_MINUTES` | `1`, `2`, `3`, … (optional) | Run every N minutes; e.g. `2` or `3` to reduce load |

Click **Save** / **Apply**.

### Step 2a: Deploy via GitHub (recommended, like your other apps)

You can deploy from GitHub so every push to `lcc_mqtt_mocker` deploys to Azure, without using `func` or a Storage account on your machine.

1. **Add the publish profile as a GitHub secret**
   - In Azure Portal: open your **MQTT-MOCKER** Function App → **Overview** → **Get publish profile**. Download the file.
   - In GitHub: repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
   - Name: `AZURE_FUNCTIONAPP_PUBLISH_PROFILE_MQTT_MOCKER`  
   - Value: paste the **entire contents** of the publish profile file → **Add secret**.

2. **Ensure app settings in Azure are set** (Step 1 above): `AzureWebJobsStorage`, MQTT vars, `MQTT_LOAD_PUNTOS_COUNT`, and optionally `MQTT_LOAD_INTERVAL_MINUTES`. These are not in the repo; they stay in the Function App.

3. **Workflow is already in the repo:** `.github/workflows/deploy-lcc-mqtt-mocker.yml`  
   It runs on push to `main` when files under `lcc_mqtt_mocker/` change, and on **workflow_dispatch** (manual run).  
   If your default branch is not `main`, edit the workflow and change `branches: - main` to your branch.

4. **Push to GitHub.** After the first push that touches `lcc_mqtt_mocker/`, the workflow will run and deploy. Check **Actions** in GitHub to see the run.

To deploy only when you want, trigger **Actions** → **Deploy Lcc_mqtt_mocker to Azure Functions** → **Run workflow**.

### Step 2b: Deploy from your machine (optional)

From the project root (where `lcc_mqtt_mocker` lives):

1. Install [Azure Functions Core Tools v4](https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local) if the `func` command is not found:  
   - **macOS (Homebrew):** `brew tap azure/functions && brew install azure-functions-core-tools@4`  
   - **npm (global):** `npm install -g azure-functions-core-tools@4` (on Mac you may need `sudo`, or use a user prefix)

2. Deploy the function app:
   ```bash
   cd lcc_mqtt_mocker
   npm install
   func azure functionapp publish <YourFunctionAppName> --javascript
   ```
   Replace `<YourFunctionAppName>` with your Function App name (e.g. `MQTT-MOCKER`). The `--javascript` flag tells the CLI this is a Node.js project (required for v4 model).

   **Or from VS Code:** Install the “Azure Functions” extension → right-click the `lcc_mqtt_mocker` folder → **Deploy to Function App** → select your app.

### Step 3: Verify it’s running

- In the Portal: Function App → **Functions** → you should see **MqttLoadGen**.
- Open **MqttLoadGen** → **Monitor** (or **Log stream**) to see invocations and logs. The timer runs every minute by default.
- Confirm your MQTT consumer (e.g. the Aquatech API) is receiving the messages.

## Configuration

- **Puntos count:** `MQTT_LOAD_PUNTOS_COUNT` (1–135). Number of “stores” that send one message per run. Lower it to reduce load.
- **Time lapse (interval):** `MQTT_LOAD_INTERVAL_MINUTES` = `1`, `2`, `3`, etc. Run every N minutes (e.g. `2` or `3` when the server is overloaded). If not set, default is every minute.
- **Schedule (advanced):** `MQTT_LOAD_SCHEDULE` = NCRONTAB (e.g. `0 * * * * *`). Only used when `MQTT_LOAD_INTERVAL_MINUTES` is not set.
- **MQTT:** Same as API: `MQTT_BROKER`, `MQTT_PORT`, `MQTT_USE_TLS`, `MQTT_USERNAME`, `MQTT_PASSWORD`, and if using Event Grid: `MQTT_CLIENT_CERT_B64`, `MQTT_CLIENT_KEY_B64`, etc.

## Cost (ballpark)

- Consumption plan: one execution per minute ≈ 43,200 runs/month. Each run is a short MQTT connect + 30–135 publishes + disconnect. Typically stays within the free grant; beyond that, cost is low.

## Troubleshooting

### "Function App is missing host storage configuration" / AzureWebJobsStorage

If deploy or the host fails with **missing host storage configuration** or **AzureWebJobsStorage**:

1. **Create a Storage account** (if needed): Portal → **Storage accounts** → **Create** → same subscription & resource group as the Function App → e.g. name `mqttmockerstorage`, **LRS** → Create.
2. **Get connection string:** Storage account → **Access keys** → **key1** → copy **Connection string**.
3. **Add to Function App:** MQTT-MOCKER → **Configuration** → **Environment variables** → Add:
   - **Name:** `AzureWebJobsStorage`
   - **Value:** the full connection string (e.g. `DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net`)
4. **Save** and **Restart**, then redeploy.

### Run from package (recommended)

Azure may recommend enabling **Run From Package**. In **Environment variables** (under Configuration), add:

- **Name:** `WEBSITE_RUN_FROM_PACKAGE`  
- **Value:** `1`

Then save and restart. The app will run from the deployed zip, which reduces locking issues and can improve cold start. Keep this set for production.

### "Error while loading" / "Encountered an error (InternalServerError) from host runtime"

This often happens when the Node.js v4 programming model runs with a wrong Node version or the host can’t start the app. Try:

1. **Set Node version (required for v4)**  
   In Azure Portal: **MQTT-MOCKER** → **Configuration** → **Environment variables** (or Application settings) → add:
   - **Name:** `WEBSITE_NODE_DEFAULT_VERSION`  
   - **Value:** `~20` (or `~18`)  
   Save and **Restart** the Function App.

2. **Surface entry-point errors**  
   Add application setting:
   - **Name:** `FUNCTIONS_NODE_BLOCK_ON_ENTRY_POINT_ERROR`  
   - **Value:** `true`  
   Restart the app, then check **Log stream** or **Monitor** → **Logs** for messages containing “entry point” or the real exception.

3. **Use Diagnose and solve problems**  
   In the Function App blade: **Diagnose and solve problems** → run the suggested checks and open any reported issues.

4. **Check runtime version**  
   Node v4 model needs **Azure Functions runtime 4.25+**. In **Function app** → **Settings** → **Configuration** → **Function app settings**, ensure the runtime is up to date (no manual setting usually; platform uses a supported version).

5. **Redeploy**  
   After changing app settings, trigger a new deploy from GitHub Actions (or redeploy from your machine) so the same code runs with the new settings.

## Disabling the load test

- In Azure: set the Function App setting **AzureWebJobs.MqttLoadGen.Disabled** = `true` to stop the timer from running, or delete/disable the function.

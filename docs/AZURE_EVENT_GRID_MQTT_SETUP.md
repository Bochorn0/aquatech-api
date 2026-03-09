# Azure Event Grid MQTT - Setup & Integration Guide

## Step 1: Enable MQTT Broker (Required)

Your namespace shows **MQTT broker: Deshabilitada**. Enable it first:

1. In the Event Grid Namespace **Overview** page, click the **"Deshabilitada"** (Disabled) link next to MQTT broker
2. You'll be redirected to the **Configuration** page
3. Select **Enable MQTT broker**
4. Click **Apply**

---

## Step 2: Create Topic Space

1. Left menu → **MQTT broker** → **Topic spaces**
2. Click **+ Topic space**
3. **Name:** `tiwater-topics` (alphanumeric and hyphen only, 3–50 chars)
4. **Topic template:** Use one of these (try in order if one fails):

   | Template | Matches |
   |----------|---------|
   | `tiwater/+/data` | `tiwater/TEST-001/data`, `tiwater/MX-001/data` |
   | `tiwater/#` | All topics under `tiwater/` |
   | `machines/#` | Azure example – use as reference |

   **Format rules:**
   - `+` = single segment wildcard
   - `#` = multi-level wildcard (only at end)
   - Examples from Azure: `clients/${client.authenticationName}/temperatures` or `machines/#`

5. Click **Create**

**If template validation fails:** Try a simple template first (e.g. `tiwater/test/data`) to confirm the topic space works, then edit it to add wildcards.

---

## Step 3: Create Client (for API consumer + publisher)

Azure Event Grid MQTT uses **X.509 certificate authentication**. You need to generate a client certificate.

### 3a. Generate client certificate (macOS/Linux)

**Important:** Run from your home directory (`~`) where `.step` was created by `step ca init`.

When prompted for the CA key password, enter the **password you set during `step ca init`** (not your Mac password).

```bash
cd ~

# Create client cert for API (will prompt for CA password from step ca init)
step certificate create tiwater-api-consumer tiwater-api-consumer.pem tiwater-api-consumer.key \
  --ca .step/certs/intermediate_ca.crt --ca-key .step/secrets/intermediate_ca_key \
  --no-password --insecure --not-after 2400h

# Get thumbprint (paste this in Azure when creating the client)
step certificate fingerprint tiwater-api-consumer.pem

# Copy certs to project
cp tiwater-api-consumer.pem tiwater-api-consumer.key /Users/luisfercordova/Documents/Projects/Aquatech/Aquatech_api/certs/
```

**If you forgot the CA password:** Remove `~/.step` and run `step ca init` again. When prompted for password, press **Enter** to leave it empty. Then run the commands above (no password will be asked).

### 3b. Register client in Azure Portal

1. Left menu → **MQTT broker** → **Clients**
2. Click **+ Client**
3. **Name:** `tiwater-api-consumer`
4. **Client authentication name:** `tiwater-api-consumer` (must match Username in MQTT CONNECT)
5. **Primary thumbprint:** paste the thumbprint from step 3a
6. Click **Create**

---

## Step 4: Create Permission Bindings

1. Left menu → **Permission bindings**
2. Click **+ Permission binding**

**Publisher binding:**
- Name: `tiwater-publisher`
- Client group: `$all`
- Topic space: `tiwater-topics`
- Permission: **Publisher**
- Create

**Subscriber binding:**
- Name: `tiwater-subscriber`
- Client group: `$all`
- Topic space: `tiwater-topics`
- Permission: **Subscriber**
- Create

---

## Step 5: Get MQTT Connection Details

From the namespace **Overview** page (or `mqtt_azure_config.json`):

- **MQTT hostname (topics):** `tiwatermqtt.eastus-1.eventgrid.azure.net`
- **MQTT hostname (topic spaces):** `tiwatermqtt.eastus-1.ts.eventgrid.azure.net` – use this if the topics hostname fails with ECONNRESET
- **Port:** 8883 (TLS)
- **Username:** `tiwater-api-consumer` (must match Client authentication name)

---

## Step 6: Environment Variables for API

Add to `.env` or Azure App Service settings:

```env
MQTT_BROKER=tiwatermqtt.eastus-1.eventgrid.azure.net
MQTT_PORT=8883
MQTT_USE_TLS=true
MQTT_USERNAME=tiwater-api-consumer
MQTT_CLIENT_ID=tiwater-api-consumer-session1
```

**Certificates – choose one:**

**Option A – Base64 (recommended for Azure App Service):**

The values are the base64-encoded contents of each file. Generate them:

```bash
# From the directory containing your certs (e.g. Aquatech_api/certs/ or ~)
base64 -i tiwater-api-consumer.pem | tr -d '\n'
base64 -i tiwater-api-consumer.key | tr -d '\n'
```

Copy each output and paste into the corresponding App Setting:

| Name | Value |
|------|-------|
| `MQTT_CLIENT_CERT_B64` | Output of first command (long string starting with `LS0tLS1CRUdJTi...`) |
| `MQTT_CLIENT_KEY_B64` | Output of second command (long string starting with `LS0tLS1CRUdJTi...`) |

**Option B – File paths (local/dev):**
```env
MQTT_CLIENT_CERT_PATH=./certs/tiwater-api-consumer.pem
MQTT_CLIENT_KEY_PATH=./certs/tiwater-api-consumer.key
```

**For Azure App Service Linux:** Add `WEBSITES_INCLUDE_CLOUD_CERTS=true` so the app uses system CA certs for outbound TLS (fixes "socket disconnected before secure TLS connection").

**Important:** Never commit `.pem` or `.key` files to git. Add `certs/` to `.gitignore`.

**For Event Grid:** Do **not** set `MQTT_PASSWORD`. Event Grid uses X.509 only; a password will cause connection failures. If you had it from the old Mosquitto config, remove it.

---

## What you need from Azure to connect as **publisher** (e.g. onboard script)

The onboard script (`scripts/onboard-puntos-venta-mqtt.js`) publishes to `tiwater/REGION/CIUDAD/CODIGO/data`. To connect as a **publisher** to Azure Event Grid you need the same connection details as the API, plus **Publisher** permission.

| From Azure | Use in .env |
|------------|-------------|
| **Namespace hostname** (Overview or `mqtt_azure_config.json`) | `MQTT_BROKER=tiwatermqtt.eastus-1.eventgrid.azure.net` (or `...ts.eventgrid.azure.net` if the other fails) |
| **Port** | `MQTT_PORT=8883`, `MQTT_USE_TLS=true` |
| **A Client** with **Publisher** permission | Create a client (or reuse the API client); ensure a **Permission binding** with Permission = **Publisher** exists for the topic space that matches `tiwater/#` or `tiwater/+/+/+/data`. |
| **Client authentication name** | `MQTT_USERNAME=<exactly that name>` (e.g. `tiwater-api-consumer`) |
| **X.509 certificate** for that client | `MQTT_CLIENT_CERT_B64` and `MQTT_CLIENT_KEY_B64` (or `MQTT_CLIENT_CERT_PATH` / `MQTT_CLIENT_KEY_PATH`) |
| **No password** | Do **not** set `MQTT_PASSWORD` for Event Grid; the script skips it when the broker hostname contains `eventgrid.azure.net`. |

Checklist:

1. **Topic space** – Topic template must allow your topics, e.g. `tiwater/#` or `tiwater/+/+/+/data`.
2. **Permission binding** – One binding with **Publisher** for the client (or `$all`) on that topic space.
3. **Client** – Client’s Primary thumbprint in Azure must match the cert you use for `MQTT_CLIENT_CERT_*`.
4. **Single session** – If the API is already connected with the same `MQTT_USERNAME`, only one MQTT session is allowed per auth name. Run the onboard script when the API is stopped, or use a **different client** (new cert + new Client authentication name in Azure) for the script.

---

## Dedicated MQTT user with Publisher-only (e.g. for Lcc_mqtt_mocker)

To give the load-test / mocker app its own identity and **only publish** (no subscribe), use a separate **Client** and a **Client group** that has only a **Publisher** permission binding.

**Note:** The **Access keys** blade on the Event Grid Namespace is for the **namespace REST/management API**, not for MQTT. MQTT connections use **X.509 client certificates** and **Clients** (below).

### 1. Create a Client group (publisher-only)

1. Left menu → **MQTT broker** → **Client groups**
2. **+ Client group**
3. **Name:** `mqtt-mocker-publishers` (or similar)
4. **Description:** optional, e.g. “Publisher-only for Lcc_mqtt_mocker”
5. **Create** (you’ll add the client to this group after creating the client)

### 2. Generate a certificate for the mocker

From your machine (same place you have `step` and your CA, e.g. `~`):

```bash
cd ~

# Create client cert for the mocker (use your CA from step ca init)
step certificate create lcc-mqtt-mocker lcc-mqtt-mocker.pem lcc-mqtt-mocker.key \
  --ca .step/certs/intermediate_ca.crt --ca-key .step/secrets/intermediate_ca_key \
  --no-password --insecure --not-after 2400h

# Thumbprint – you’ll paste this in Azure when creating the Client
step certificate fingerprint lcc-mqtt-mocker.pem
```

Save the thumbprint; do **not** commit `.pem` / `.key` to git.

### 3. Create the Client in Azure

1. Left menu → **MQTT broker** → **Clients**
2. **+ Client**
3. **Name:** `lcc-mqtt-mocker`
4. **Client authentication name:** `lcc-mqtt-mocker` (this is the MQTT username the app will use)
5. **Primary thumbprint:** paste the thumbprint from step 2
6. **Client groups:** add the group `mqtt-mocker-publishers` (so this client is only in that group)
7. **Create**

### 4. Permission binding (Publisher only for this group)

1. Left menu → **Permission bindings**
2. **+ Permission binding**
3. **Name:** `tiwater-mocker-publisher`
4. **Client group:** `mqtt-mocker-publishers`
5. **Topic space:** `tiwater-topics` (same as your existing one)
6. **Permission:** **Publisher**
7. **Create**

Now only clients in `mqtt-mocker-publishers` (your mocker) have **Publisher** on `tiwater-topics`. Your API can keep using the existing client (e.g. `tiwater-api-consumer`) and its existing bindings (e.g. `$all` with Subscriber + Publisher).

### 5. Use the new client in MQTT-MOCKER (Azure Function)

1. **Base64 for Azure App Settings** (from the folder with the cert files):

   ```bash
   base64 -i lcc-mqtt-mocker.pem | tr -d '\n'
   base64 -i lcc-mqtt-mocker.key | tr -d '\n'
   ```

2. In **MQTT-MOCKER** Function App → **Environment variables**, set:

   | Name | Value |
   |------|--------|
   | `MQTT_BROKER` | Your namespace hostname (e.g. `tiwatermqtt.eastus-1.eventgrid.azure.net` or `...ts.eventgrid.azure.net`) |
   | `MQTT_PORT` | `8883` |
   | `MQTT_USE_TLS` | `true` |
   | `MQTT_USERNAME` | `lcc-mqtt-mocker` (must match Client authentication name) |
   | `MQTT_CLIENT_CERT_B64` | Output of first `base64` command |
   | `MQTT_CLIENT_KEY_B64` | Output of second `base64` command |

   Do **not** set `MQTT_PASSWORD` for Event Grid.

Result: the mocker connects as `lcc-mqtt-mocker` with **publisher-only** permission; the API keeps its own client and permissions.

---

## Step 7: Test Flow

### From Frontend (or Postman)

1. **Login** to get JWT token
2. **POST** `https://your-api.azurewebsites.net/api/v1.0/mqtt/publish-test`
   - Headers: `Authorization: Bearer <token>`, `Content-Type: application/json`
   - Body: `{ "codigoTienda": "TEST-001", "payload": { "TDS": 100, "NIVEL PURIFICADA": 50 } }`
3. **Verify**: The mqtt-consumer receives the message and saves to PostgreSQL `sensores` table

### From terminal (curl)

```bash
# 1. Login
TOKEN=$(curl -s -X POST https://your-api/api/v1.0/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@lcc.com.mx","password":"admin"}' | jq -r '.token')

# 2. Publish test
curl -X POST https://your-api/api/v1.0/mqtt/publish-test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"codigoTienda":"TEST-001","payload":{"TDS":95}}'
```

---

## Alternative: HTTP Publish (no MQTT connection for publishing)

Azure Event Grid supports **HTTP Publish** - publish MQTT messages via HTTPS POST without an MQTT client. Useful for server-side publishing (e.g. from API when frontend sends data).

Requires:
- Azure AD app registration
- Client registered in Event Grid with OAuth/JWT auth
- API uses `@azure/identity` to get bearer token

See `src/services/eventgrid-mqtt-http.service.js` for implementation.

---

## Troubleshooting: ECONNRESET / "socket disconnected before secure TLS"

From your namespace config (`mqtt_azure_config.json`):

| Config | Value | Implication |
|--------|-------|-------------|
| `topicsConfiguration.hostname` | `tiwatermqtt.eastus-1.eventgrid.azure.net` | Default MQTT hostname |
| `topicSpacesConfiguration.hostname` | `tiwatermqtt.eastus-1.ts.eventgrid.azure.net` | Alternative for topic spaces |
| `maximumClientSessionsPerAuthenticationName` | `1` | Only **one** session per username – API and mqtt-consumer cannot both connect with the same auth name |
| `minimumTlsVersionAllowed` | `1.2` | TLS 1.2+ required |

**Try in order:**

1. **Use topic spaces hostname** – Some setups require the `ts` hostname:
   ```env
   MQTT_BROKER=tiwatermqtt.eastus-1.ts.eventgrid.azure.net
   ```

2. **Set `WEBSITES_INCLUDE_CLOUD_CERTS=true`** in Azure App Service (Configuration → Application settings) so outbound TLS uses system CA certs.

3. **Single session** – If both the API and `mqtt-consumer` use `tiwater-api-consumer`, only one can be connected. Use different client auth names (and certs) for each, or run MQTT in only one place.

4. **Port 8883** – Ensure outbound 8883 is allowed (App Service default plan usually allows it; VNet/firewall may block it).

---

## Troubleshooting: "Connection refused: Not authorized"

This error means TLS succeeded but Event Grid rejected the client. Fix:

**1. Thumbprint mismatch (most common)** – The cert in `MQTT_CLIENT_CERT_B64` must match the Primary thumbprint in Azure.

- Get thumbprint from your local cert:
  ```bash
  step certificate fingerprint tiwater-api-consumer.pem
  ```
- Or from the base64 in App Service: decode the value, save as `.pem`, then run the command above.
- In Azure Portal → Event Grid Namespace → MQTT broker → Clients → `tiwater-api-consumer` → verify **Primary thumbprint** matches exactly.
- If they differ: either update Azure with the correct thumbprint, or update `MQTT_CLIENT_CERT_B64` with the cert that matches Azure.

**2. Username** – `MQTT_USERNAME` must equal the **Client authentication name** in Azure (e.g. `tiwater-api-consumer`).

**3. Client authentication config** – Namespace → Configuration → Settings → Client authentication. If using **Thumbprint match**, the thumbprint must match. If using **Subject matches authentication name**, the cert subject must match the client auth name.

**4. Permission bindings** – Ensure the client has Publisher and/or Subscriber permissions on the topic space (`tiwater-topics`).

---

## Troubleshooting: "Subscribe error: Unspecified error" (granted: 128)

Connection works but subscription to `tiwater/+/data` fails. You need a **topic space** and **permission bindings**.

**1. Create topic space** (if missing):
- MQTT broker → **Topic spaces** → **+ Topic space**
- Name: `tiwater-topics`
- Topic template: `tiwater/+/data` or `tiwater/#`
- Create

**2. Create Subscriber permission binding**:
- **Permission bindings** → **+ Permission binding**
- Name: `tiwater-subscriber`
- Client group: `$all`
- Topic space: `tiwater-topics`
- Permission: **Subscriber**
- Create

**3. Create Publisher permission binding** (for simulate endpoints):
- Name: `tiwater-publisher`
- Client group: `$all`
- Topic space: `tiwater-topics`
- Permission: **Publisher**
- Create

Restart the App Service after creating these.

# Tuya logs cron on Azure (every 30 minutes)

On your previous server you had a cron job that called the **Tuya logs routine** every 30 minutes. On Azure you can do the same by calling the API endpoint on a schedule. No cron daemon on the VM — use one of the options below.

## Endpoint

- **URL:** `POST https://<your-api-host>/api/v1.0/products/fetchLogsRoutine`  
  Example: `https://lccapp-aefcbwh0ecd7b8cz.canadacentral-01.azurewebsites.net/api/v1.0/products/fetchLogsRoutine`
- **Auth (choose one):**
  - **Cron secret (recommended):** header `X-Cron-Secret: <secret>` or `X-TIWater-API-Key: <key>`
  - **JWT:** normal `Authorization: Bearer <token>` (e.g. for manual testing)
- **Response:** `202 Accepted` and the routine runs in the background.

**Env for the secret:** In App Service **Configuration → Application settings** set one of:

- `CRON_TUYA_LOGS_SECRET` = a long random string (use only for this cron), or  
- `CRON_DEV_MODE_SECRET` or `TIWATER_API_KEY` (if you already use them and want to reuse).

Use that same value in the scheduler (Logic Apps / Functions / external cron) as `X-Cron-Secret`.

---

## Option 1: Azure Logic Apps (no code, every 30 min)

1. **Azure Portal** → **Create a resource** → **Logic App**.
2. In the Logic App:
   - Add trigger: **Recurrence** → Interval **30**, Frequency **Minute**.
   - Add action: **HTTP**:
     - **Method:** POST  
     - **URI:** `https://lccapp-aefcbwh0ecd7b8cz.canadacentral-01.azurewebsites.net/api/v1.0/products/fetchLogsRoutine`  
     - **Headers:**  
       - `X-Cron-Secret`: `<your CRON_TUYA_LOGS_SECRET value>`
3. Save and enable the Logic App.

The app will run every 30 minutes and call your API. No code, no Functions.

---

## Option 2: Azure Functions (Timer trigger)

1. Create a **Function App** (same subscription/resource group if you like).
2. Add a **Timer trigger** function (e.g. Node.js):
   - **Schedule:** NCRONTAB `0 */30 * * * *` (every 30 minutes).
3. In the function, send an HTTP POST to the same URL with the `X-Cron-Secret` header (store the secret in the Function App **Application settings** and read it in code).
4. Deploy and leave the Function App running.

Good if you already use Functions or want everything in code.

---

## Option 3: External cron service

Use a free/paid cron service that can send HTTP requests on a schedule:

- **cron-job.org** (free): create a job, URL = `https://.../api/v1.0/products/fetchLogsRoutine`, Method = POST, add header `X-Cron-Secret: <secret>`, schedule every 30 minutes.
- **EasyCron**, **Uptime Robot** (with HTTP check + optional POST), etc.

Same endpoint and header as above. No Azure Logic App or Function needed.

---

## Summary

| What | Value |
|------|--------|
| **Endpoint** | `POST /api/v1.0/products/fetchLogsRoutine` |
| **Auth** | `X-Cron-Secret: <CRON_TUYA_LOGS_SECRET>` (or `X-TIWater-API-Key`) |
| **Schedule** | Every 30 minutes (or 5/15 min if you prefer) |
| **App setting** | `CRON_TUYA_LOGS_SECRET` (or reuse `CRON_DEV_MODE_SECRET` / `TIWATER_API_KEY`) |

The routine itself (which products, time window, Tuya API) is unchanged; only the way you **trigger** it moves from server cron to Azure or an external scheduler.

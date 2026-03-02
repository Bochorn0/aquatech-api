# How to View Logs in Azure App Service

Use these steps to debug MQTT connection issues or other API errors.

---

## 1. Enable Application Logging (one-time)

1. Go to **Azure Portal** → your App Service (**lccapp**)
2. Left menu → **Monitoring** → **App Service logs**
3. Set **Application Logging** to **On** (or **File System**)
4. **Log Level:** `Information` or `Verbose`
5. Click **Save**

---

## 2. View Live Logs (Log Stream)

**Option A – Azure Portal**

1. App Service → **Monitoring** → **Log stream**
2. Select **Application logs**
3. Logs appear in real time (including `[MQTT]` messages)

**Option B – Azure CLI**

```bash
az webapp log tail --name lccapp --resource-group <your-resource-group>
```

Replace `<your-resource-group>` with your resource group name (e.g. from the App Service overview).

---

## 3. Download Log Files (Kudu)

1. App Service → **Development Tools** → **Advanced Tools** → **Go**
2. In Kudu: **Debug console** → **CMD** or **PowerShell**
3. Go to `LogFiles/Application/` to see log files
4. Or: App Service → **Monitoring** → **App Service logs** → **Download** to get a zip of logs

---

## 4. MQTT Debugging

After enabling logs, trigger an MQTT action (e.g. simulate-bajo-nivel-cruda) and check Log stream for:

- `[MQTT] Conectando a mqtts://...` – connection attempt
- `[MQTT] ✅ Certificado cliente desde env (base64)` – cert loaded
- `[MQTT] ❌ Error de conexión: <message>` – connection error
- `[MQTT] ✅ Conectado al broker` – success

Also call the status endpoint:

```bash
curl https://lccapp-aefcbwh0ecd7b8cz.canadacentral-01.azurewebsites.net/api/v1.0/mqtt/status
```

The response includes `lastError` with the most recent MQTT error message.

# Separating MQTT Consumer from API - Setup Guide

## ✅ What We Did

1. **Removed MQTT auto-start from API** (`src/index.js`)
   - API no longer automatically connects to MQTT on startup
   - MQTT status endpoint still works (read-only)

2. **MQTT Consumer runs separately** (`src/mqtt-consumer.js`)
   - Already configured as separate PM2 instance
   - Handles all MQTT message consumption
   - Prevents duplicate message processing

## 📋 Current PM2 Configuration

Your `ecosystem.config.cjs` already has both processes configured:

```javascript
{
  name: 'api-aquatech',      // API server (no MQTT consumption)
  script: 'src/index.js',
  instances: 1
},
{
  name: 'mqtt-consumer',     // MQTT consumer (separate process)
  script: 'src/mqtt-consumer.js',
  instances: 1  // MUST stay at 1
}
```

## 🚀 How to Start Separate Instances

### Step 1: Stop Current PM2 Processes
```bash
pm2 delete all
```

### Step 2: Start with New Configuration
```bash
pm2 start ecosystem.config.cjs
```

### Step 3: Save Configuration
```bash
pm2 save
```

### Step 4: Verify Both Are Running
```bash
pm2 list
```

You should see:
```
┌─────┬──────────────────┬─────────┬─────────┬──────────┐
│ id  │ name             │ status  │ restart │ uptime   │
├─────┼──────────────────┼─────────┼─────────┼──────────┤
│ 0   │ api-aquatech     │ online  │ 0       │ 10s      │
│ 1   │ mqtt-consumer    │ online  │ 0       │ 10s      │
└─────┴──────────────────┴─────────┴─────────┴──────────┘
```

## ⚠️ Known Issue: Publishing from API

**Current Situation:**
- `puntoVenta.controller.js` uses `mqttService.publish()` to send test data
- When it calls `mqttService.connect()`, it also subscribes to topics
- This means messages will be processed by BOTH:
  - The API (when publishing)
  - The separate consumer (always)

**Impact:**
- Test data generation will create duplicate records
- This is only for testing, not production data

**Solution (Future):**
- Create a publish-only MQTT client for the API
- Keep subscriptions only in `mqtt-consumer.js`

**For Now:**
- This is acceptable for testing
- Production MQTT messages come from gateways, not the API
- The separate consumer handles all gateway messages correctly

## 🔍 Verify Separation

### Check API Logs (should NOT show MQTT connection):
```bash
pm2 logs api-aquatech
```
Should show:
```
Connected to MongoDB
ℹ️  MQTT se ejecuta como proceso separado (mqtt-consumer)
Server is running on port 5000
```

### Check MQTT Consumer Logs (should show MQTT connection):
```bash
pm2 logs mqtt-consumer
```
Should show:
```
🚀 Iniciando consumidor MQTT...
✅ Conectado a MongoDB
📡 Iniciando servicio MQTT...
✅ Consumidor MQTT iniciado correctamente
[MQTT] ✅ Suscrito a topic: tiwater/+/data
```

## 📊 Monitoring

### Check Status:
```bash
pm2 status
```

### Monitor Both:
```bash
pm2 monit
```

### View Logs:
```bash
pm2 logs          # All logs
pm2 logs api-aquatech
pm2 logs mqtt-consumer
```

## ✅ Benefits

1. **No Duplicate Processing**: Only one consumer processes messages
2. **Independent Scaling**: API can scale without affecting MQTT
3. **Better Resource Management**: Each process has its own memory limits
4. **Easier Debugging**: Separate logs for API and MQTT
5. **Independent Restarts**: API restarts don't affect MQTT consumer

## 🎯 Summary

- ✅ API: Runs separately, no MQTT consumption
- ✅ MQTT Consumer: Runs separately, handles all message consumption
- ✅ PM2: Manages both as separate instances
- ⚠️ Publishing from API: Still works but may cause duplicates in test data (acceptable)

Your setup is now properly separated! 🎉

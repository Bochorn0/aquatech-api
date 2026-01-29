# PM2 Multi-Instance Guide - Avoiding Duplicate Records

## 🎯 The Answer: **API = Multiple Instances ✅ | MQTT Consumer = Single Instance ❌**

### ⚠️ **CRITICAL: MQTT Consumer MUST Run as Single Instance**

**Why?** MQTT uses a publish-subscribe model:
- If multiple consumers subscribe to the same topic, **ALL receive the same message**
- Each instance would save the same data → **DUPLICATE RECORDS**
- No built-in duplicate prevention in your current code

**Current Risk:**
```javascript
// If 2 MQTT consumers run:
// Message arrives → Both consumers receive it → Both save to DB → DUPLICATE!
```

### ✅ **API Can Run Multiple Instances**

**Why?** The API is stateless:
- Each request is independent
- No shared state between instances
- Load balancing distributes requests
- **No duplicate risk** (each request is unique)

## 📊 Recommended Configuration for 2GB RAM

### Option 1: **Conservative (Recommended)**
- API: **2 instances** (better performance, still safe on memory)
- MQTT: **1 instance** (MUST stay single)

**Memory Usage:**
- API: 2 × 400M = 800M
- MQTT: 1 × 300M = 300M
- Total: ~1.1GB (safe with swap)

### Option 2: **Current (Stable)**
- API: **1 instance** (current setup)
- MQTT: **1 instance**

**Memory Usage:**
- API: 1 × 500M = 500M
- MQTT: 1 × 350M = 350M
- Total: ~850M (very safe)

### Option 3: **Maximum (If you have 4GB+ RAM)**
- API: **4 instances** (cluster mode)
- MQTT: **1 instance**

## 🔧 Configuration

See `ecosystem.config.cjs` for the updated configuration with:
- API: Multiple instances (configurable)
- MQTT: Single instance (enforced)

## 🛡️ Preventing Duplicates (Future Enhancement)

If you need multiple MQTT consumers for high availability, you would need:

1. **MQTT Shared Subscriptions** (QoS 2):
   ```javascript
   // Only one consumer in a group processes each message
   client.subscribe('$share/group1/tiwater/+/data');
   ```

2. **Database-level duplicate prevention**:
   ```javascript
   // Add unique index on timestamp + codigo_tienda + equipo_id
   // Use upsert instead of insert
   ```

3. **Message deduplication**:
   ```javascript
   // Track processed message IDs
   // Skip if already processed
   ```

**For now, keep MQTT as single instance!**

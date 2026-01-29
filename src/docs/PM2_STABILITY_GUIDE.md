# PM2 Stability Guide - Preventing Session Loss

## 🎯 Goal: Keep PM2 Running, No Restarts

**You're right - we should NOT kill PM2.** The goal is to keep it running continuously without restarts that cause session loss.

## 🔍 The Real Problem

The issue is **NOT** that we're killing PM2. The problem is:

1. **OOM Killer** (Linux) kills PM2 when system runs out of memory
2. **PM2's `max_memory_restart`** restarts the app when memory limit is reached (causes session loss)
3. **No swap configured** means system has no buffer when memory is tight

## ✅ Solution Strategy

### 1. **Increase Memory Limits** (Done)
- Increased `max_memory_restart` to reduce restart frequency
- API: 500M (was 300M)
- MQTT: 350M (was 200M)
- This prevents frequent restarts that cause session loss

### 2. **Use Node.js Heap Limits** (Done)
- `--max-old-space-size` prevents memory leaks
- This is better than PM2 restarts because it:
  - Prevents memory leaks at the source
  - Doesn't cause full app restarts
  - Maintains sessions

### 3. **Configure Swap** (CRITICAL - Do This!)
Swap acts as a buffer when RAM is full. Without it, the OOM killer will kill PM2.

**Check if swap exists:**
```bash
free -h
```

**If swap shows `0`, create it:**
```bash
npm run fix:pm2
# or manually:
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 4. **Reload PM2 with New Config**
```bash
pm2 reload ecosystem.config.cjs
# or if that doesn't work:
pm2 delete all
pm2 start ecosystem.config.cjs
pm2 save
```

## 📊 Monitoring

**Check system resources:**
```bash
npm run check:resources
```

**Monitor PM2:**
```bash
pm2 monit
```

**Check for OOM kills:**
```bash
dmesg | grep -i oom
```

## 🚫 What We Changed

### Before (Causing Session Loss):
- ❌ Low memory limits (300M/200M) → frequent restarts
- ❌ Short restart delays (4s) → rapid restart loops
- ❌ Aggressive restart behavior

### After (Stable):
- ✅ Higher memory limits (500M/350M) → fewer restarts
- ✅ Longer restart delays (10s) → prevents restart loops
- ✅ Node.js heap limits → prevents memory leaks
- ✅ Focus on preventing OOM kills, not on restarting

## 💡 Key Insight

**PM2 should run continuously.** The configuration now:
1. Prevents memory leaks (Node.js heap limits)
2. Reduces restart frequency (higher memory limits)
3. Relies on swap to prevent OOM kills (you need to configure this)

## ⚠️ If You Still See Restarts

1. **Check swap is configured:** `free -h`
2. **Check OOM events:** `dmesg | grep -i oom`
3. **Monitor memory:** `watch -n 1 free -h`
4. **Check PM2 logs:** `pm2 logs`

If OOM kills continue, you may need to:
- Increase swap size
- Reduce MongoDB/PostgreSQL memory usage
- Consider upgrading to 4GB RAM droplet

## 🎯 Bottom Line

**We're NOT killing PM2 anymore.** The new config:
- ✅ Prevents frequent restarts (session loss)
- ✅ Uses Node.js limits to prevent memory issues
- ✅ Relies on swap to prevent OOM kills
- ✅ Keeps PM2 running continuously

**Just make sure swap is configured!**

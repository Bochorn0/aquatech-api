# Fix: PM2 killed by signal + SELinux blocking systemd pid file

Use this guide when PM2 keeps restarting or shows **"pm2 has been killed by signal"** and the journal shows **"Can't convert PID files /root/.pm2/pm2.pid ... Permission denied"** or **"SELinux is preventing systemd from read access on the file pm2.pid"**.

**Root cause:** SELinux blocks systemd from reading PM2’s pid file. Systemd then misbehaves or restarts the service, and PM2 shuts down.

**Server:** Run all commands as **root** (or with `sudo`). App path on server is assumed to be `/api`; adjust if yours is different.

---

## 1. Confirm the problem

```bash
journalctl -u pm2-root -n 30
```

You should see lines like:

- `pm2-root.service: Can't convert PID files /root/.pm2/pm2.pid O_PATH file descriptor to proper file descriptor: Permission denied`
- `SELinux is preventing systemd from read access on the file pm2.pid`

And in `pm2 logs`:

- `pm2 has been killed by signal, dumping process list before exit...`

If you see these, continue with the fixes below.

---

## 2. Fix 1 – Stop systemd from using the pid file (recommended, fastest)

This removes the need for systemd to read the pid file. PM2 keeps running normally.

```bash
mkdir -p /etc/systemd/system/pm2-root.service.d
echo -e '[Service]\nPIDFile=' > /etc/systemd/system/pm2-root.service.d/no-pidfile.conf
systemctl daemon-reload
systemctl restart pm2-root
```

If `systemctl restart pm2-root` hangs, press **Ctrl+C** and run:

```bash
pm2 resurrect
```

**Check:** `journalctl -u pm2-root -n 20` — the "Permission denied" / "Can't convert PID files" messages should stop.

---

## 3. Fix 2 – Relabel the pid file (optional, if you want PIDFile back later)

Makes the pid file use a context systemd is allowed to read. Do this **after** Fix 1 if you want to re-enable `PIDFile` in the future.

```bash
semanage fcontext -a -t var_run_t "/root/.pm2/pm2.pid"
restorecon -v /root/.pm2/pm2.pid
```

If you get "already exists", use **-m** instead of **-a**:

```bash
semanage fcontext -m -t var_run_t "/root/.pm2/pm2.pid"
restorecon -v /root/.pm2/pm2.pid
```

You should see: `Relabeled /root/.pm2/pm2.pid from ... admin_home_t ... to ... var_run_t ...`

---

## 4. Fix 3 – SELinux policy via audit2allow (only if Fix 1 + 2 aren’t enough)

Creates a custom SELinux module. Run from the directory where you want the `.pp` file (e.g. `/api`).

```bash
cd /api
ausearch -c 'pm2' --raw 2>/dev/null | audit2allow -M my-pm2
semodule -i my-pm2.pp
```

If the file was created in `/api` but you run `semodule` from elsewhere, use the full path:

```bash
semodule -i /api/my-pm2.pp
```

If you see a priority warning, you can use:

```bash
semodule -X 300 -i /api/my-pm2.pp
```

Then:

```bash
systemctl restart pm2-root
# or, if it hangs: Ctrl+C then pm2 resurrect
```

---

## 5. Verify

1. **No more pid file denial**
   ```bash
   journalctl -u pm2-root -n 30
   ```
   No "Permission denied" or "Can't convert PID files ... pm2.pid".

2. **PM2 and apps are up**
   ```bash
   pm2 status
   ```
   api-aquatech and mqtt-consumer should be **online**.

3. **No new kills**
   After 10–15 minutes, check `pm2 logs` or the journal again. There should be no new "pm2 has been killed by signal".

---

## 6. If PM2 was started manually (no systemd)

If PM2 is not managed by systemd and you only need to get it running:

```bash
cd /api
pm2 start ecosystem.config.cjs   # or ecosystem.config.multi-api.js
pm2 save
pm2 resurrect   # if processes were already in dump.pm2
```

To have systemd start PM2 on boot (so it survives reboots and SSH disconnect):

```bash
pm2 startup
# Run the command it prints (e.g. systemctl enable ... && systemctl start ...)
pm2 save
```

---

## 7. Quick reference

| What you see | What to run first |
|--------------|-------------------|
| "Permission denied" on pm2.pid in journal | **Fix 1** (no-pidfile drop-in) |
| Want systemd to track PM2 PID again later | **Fix 2** (semanage + restorecon) |
| Fix 1 + 2 not enough | **Fix 3** (audit2allow + semodule) |
| systemctl restart pm2-root hangs | Ctrl+C, then `pm2 resurrect` |
| Need to start PM2 from ecosystem file | `cd /api && pm2 start ecosystem.config.cjs && pm2 save` |

---

## 8. Related docs

- **MANUAL_FIXES.md** – Broader list of manual fixes (cron, systemd, SELinux, PM2 startup).
- **diagnose_pm2_kill.sh** – Run `bash scripts/diagnose_pm2_kill.sh` on the server to detect OOM, cron, systemd, and SELinux issues.

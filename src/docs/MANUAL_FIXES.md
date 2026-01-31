# Manual Fixes (apply on the droplet)

These items **cannot** be applied automatically from the repo. Run the diagnosis script on the server first, then address what it finds.

---

## 1. Run the diagnosis script on the droplet

```bash
cd /path/to/Aquatech_api   # or your app path
bash scripts/diagnose_pm2_kill.sh
# For full checks (cron root, systemd): sudo bash scripts/diagnose_pm2_kill.sh
```

The script prints a **checklist and action required** section at the end. Use that to decide which manual fixes below apply.

---

## 2. Cron: remove or reschedule jobs that touch PM2

**If the script reports cron entries that mention `pm2`, `restart`, or `kill`:**

- **Current user crontab**
  ```bash
  crontab -e
  ```
  Comment out or delete any line that runs `pm2 restart`, `pm2 kill`, or a script that kills/restarts PM2. Save and exit.

- **Root crontab**
  ```bash
  sudo crontab -e
  ```
  Same: remove or comment lines that restart/kill PM2.

- **Files in `/etc/cron.d/`**
  ```bash
  ls -la /etc/cron.d/
  grep -l pm2 /etc/cron.d/*
  ```
  Edit the matching file(s) (e.g. `sudo nano /etc/cron.d/some-file`) and remove or change the schedule so it does **not** run every 1–2 minutes. If the job is for deploy-only restarts, run it only from your deploy pipeline, not on a short interval.

---

## 3. Systemd: ensure PM2 is started correctly and not restarted unnecessarily

**If PM2 is under systemd (script says “PM2 is under systemd” or shows a PM2 unit):**

- **Inspect the unit**
  ```bash
  systemctl cat pm2-$(whoami).service
  # or the unit name shown by the script
  ```

- **Avoid aggressive restarts**
  - If you see `Restart=always` or a short `RestartSec=`, consider `Restart=on-failure` and a longer `RestartSec=` (e.g. 10s) so systemd doesn’t restart PM2 too often.
  - If there is `WatchdogSec=`, it can cause restarts when the watchdog isn’t ticked; remove or increase it if you don’t need a watchdog.

- **Ensure PM2 is started by systemd (not only in SSH)**
  ```bash
  pm2 startup
  # Run the command it prints (usually systemctl enable ... && systemctl start ...)
  pm2 save
  ```
  After that, PM2 should survive SSH disconnect and only restart when you deploy or when systemd is configured to do so.

---

## 4. SELinux: systemd cannot read PM2 pid file

**If the script or journal shows:**  
`Can't convert PID files /root/.pm2/pm2.pid O_PATH file descriptor to proper file descriptor: Permission denied`  
or  
`SELinux is preventing systemd from read access on the file pm2.pid`

SELinux is blocking systemd from reading PM2’s pid file. That can make systemd think the service failed and restart it (or behave oddly).

**Option A – Restore default context (try first)**  
```bash
restorecon -Rv /root/.pm2/
systemctl restart pm2-root
```

**Option B – Allow PM2 via SELinux policy (if A doesn’t fix it)**  
Install policycoreutils-python-utils and setroubleshoot if needed:  
`dnf install -y policycoreutils-python-utils setroubleshoot`  

Create and load a custom module (run as root from any directory):  
```bash
ausearch -c 'pm2' --raw 2>/dev/null | audit2allow -M my-pm2
semodule -X 300 -i my-pm2.pp
systemctl restart pm2-root
```  
If `semodule` complains about priority, use `semodule -X 300 -i my-pm2.pp`.  
Then check: `journalctl -u pm2-root -f` — no more "Permission denied" on pm2.pid.

**Option C – Give pid file a context systemd can read**  
```bash
semanage fcontext -a -t var_run_t "/root/.pm2/pm2.pid"
restorecon -v /root/.pm2/pm2.pid
systemctl restart pm2-root
```
If you get "already exists", use `-m` instead of `-a`:  
`semanage fcontext -m -t var_run_t "/root/.pm2/pm2.pid"`

**Option D – Remove PIDFile from the service (workaround)**  
If the policy/context fixes still don’t stop the denial, stop systemd from reading the pid file:  
```bash
mkdir -p /etc/systemd/system/pm2-root.service.d
printf '%s\n' '[Service]' 'PIDFile=' > /etc/systemd/system/pm2-root.service.d/no-pidfile.conf
systemctl daemon-reload
systemctl restart pm2-root
```
PM2 will still run; systemd just won’t track the main PID via a file. No more "Permission denied" on pm2.pid.

After any option, run the diagnosis script again and check `pm2 logs`; the “Permission denied” / “pm2 has been killed by signal” messages should stop once systemd can read the pid file.

---

## 5. PM2 not under systemd (running in SSH)

**If the script says “PM2 may be running under SSH”:**

- Start PM2 via systemd so it survives disconnect and isn’t tied to your session:
  ```bash
  cd /api   # or your app root on the server
  pm2 start ecosystem.config.cjs   # or ecosystem.config.multi-api.js
  pm2 save
  pm2 startup
  # Execute the command that pm2 startup prints (enable + start the PM2 service)
  ```
  Then disconnect SSH; PM2 should keep running.

---

## 6. No cron/systemd cause found

If the script finds **no** cron or systemd cause and PM2 is still killed ~every 90s:

- Check for **other automation**: CI/CD, external monitoring, or scripts that SSH in and run `pm2 restart` or `kill`.
- Check **DigitalOcean** (or your provider) for any “health check” or “process manager” that might restart processes.
- Capture **who sends the signal** (advanced): run PM2 under a wrapper that logs signals, or use `auditd` to log signal delivery to the PM2 PID.

---

## 7. After applying manual fixes

1. Deploy the **code changes** (SIGTERM handler in API + PostgreSQL pool close on SIGTERM) so that when a kill happens, shutdown is graceful.
2. Restart PM2 once after deploy: `pm2 restart all` (or reload).
3. Wait 30–60 minutes and check logs: `pm2 logs` or your log aggregation. “pm2 has been killed by signal” should stop appearing once the external trigger (cron/systemd/other) is fixed.
4. Re-run the diagnosis script if the issue continues: `bash scripts/diagnose_pm2_kill.sh`

---

## Summary checklist (you do on server)

| # | Action | When |
|---|--------|------|
| 1 | Run `bash scripts/diagnose_pm2_kill.sh` (and optionally with `sudo`) | Once on droplet |
| 2 | Remove or reschedule cron that runs `pm2 restart`/kill every 1–2 min | If script reports such cron |
| 3 | Adjust systemd PM2 unit (Restart=, WatchdogSec) if it restarts PM2 too often | If script shows PM2 under systemd |
| 4 | **Fix SELinux for PM2 pid file** (restorecon or audit2allow) | If journal shows "Permission denied" on pm2.pid |
| 5 | Run `pm2 startup` and `pm2 save` so PM2 runs under systemd | If PM2 was only in SSH |
| 6 | Deploy code (SIGTERM + pool close) and restart PM2 | After deploying repo |
| 7 | Re-check logs and re-run script if kills continue | After 30–60 min |

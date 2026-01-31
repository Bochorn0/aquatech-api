# Log Analysis: PM2 Process Kills — Analysis & Action Plan

**Date:** 2026-01-31  
**Context:** Droplet upgraded to 4 GB RAM; kills persist → treated as **server/process logic**, not OOM.

---

## 1. What the logs show

### 1.1 Pattern of “process killed”

- **Message:** `pm2 has been killed by signal, dumping process list before exit...`
- **Then:** PM2 stops both apps (`Deleting process 0`, `Stopping app:api-aquatech`, same for `mqtt-consumer`).
- **Child exits:**
  - `api-aquatech` → `exited with code [0] via signal [SIGTERM]`
  - `mqtt-consumer` → `exited with code [0] via signal [SIGINT]` (sometimes SIGTERM first, then SIGINT from PM2).
- **Then:** `pid=XXXX msg=process killed` for both PIDs, then `Exited peacefully`.
- **After that:** Apps start again (new PIDs), so **something is restarting PM2** (e.g. systemd, startup script, or manual restarts).

So the **PM2 daemon itself** is receiving a signal from **outside** (not PM2 deciding to restart one app). The children are then stopped by PM2 as it shuts down.

### 1.2 Timing

From log timestamps (SIGTERM / “Cerrando consumidor MQTT (SIGTERM)”):

- Kills occur roughly every **~1.5 minutes** (e.g. 09:47:30 → 09:49:01 → 09:50:32 → 09:52:03 … 10:46:29 → 10:48:00).
- In at least one case, **PM2 is killed again almost immediately** after apps come back (e.g. last API activity 10:46:33, then “pm2 has been killed by signal” again; next SIGTERM at 10:48:00).

So:

- The trigger looks **periodic** (~every 90 s).
- It is **not** tied to a single heavy request (e.g. GET /products) — the kill can happen right after a fresh startup.

### 1.3 What is *not* in the logs

- No **OOM** (“Out of memory”, “Killed process”) in the log excerpt.
- No **uncaughtException** or **unhandledRejection** right before the kill.
- **PostgreSQL** “Connection pool closed” appears only when the app shuts down (expected).
- **Tuya API** “param is illegal” (1109) appears in api-error.log but is unrelated to the kill pattern.

So the evidence points to **something external sending a signal to the PM2 process** on a schedule, not the app crashing or the kernel OOM killer.

### 1.4 Application shutdown behavior

- **mqtt-consumer:** Handles both `SIGINT` and `SIGTERM`; logs “Cerrando consumidor MQTT (SIGTERM)”, disconnects MQTT, closes MongoDB/PostgreSQL → **graceful**.
- **api-aquatech:** Only **SIGINT** is handled (`process.on('SIGINT', ...)`). There is **no SIGTERM handler**. When PM2 is killed, it sends **SIGTERM** to the API, so the API exits **without** running the “Cerrando servidor” / close logic. That can leave MongoDB and PostgreSQL connections not closed cleanly.

---

## 2. Root-cause interpretation

| Hypothesis | Likelihood | Notes |
|------------|------------|--------|
| **External process sending SIGTERM/SIGINT to PM2 on a schedule** | **High** | Fits “pm2 has been killed by signal” and ~90 s interval. |
| Cron job (e.g. `pm2 restart all` or a script that kills PM2) | High | Check `crontab -l`, `sudo crontab -l`, and `/etc/cron.d`. |
| systemd (PM2 started via `pm2 startup` or a unit) | High | Unit or timer could restart/kill PM2 periodically (e.g. WatchdogSec, Restart=, or a timer). |
| PM2 `max_memory_restart` / `cron_restart` | Low | Would restart **one app**, not kill the **PM2 daemon**; ecosystem has no `cron_restart`. |
| OOM killer | Low | No OOM messages in logs; you have 4 GB RAM. |
| App crash (uncaughtException, etc.) | Low | No corresponding errors right before the kill. |

So the main direction is: **find what sends a signal to PM2 every ~1–2 minutes** (cron, systemd, or another process), and then either remove it or align it with how you want PM2 to run.

---

## 3. Action plan: tests and fixes (in order)

### Phase A — Identify who kills PM2 (on the droplet)

Do these on the **server** (droplet), not in the repo.

1. **Cron**
   - `crontab -l` (user that runs PM2).
   - `sudo crontab -l`.
   - List: `ls -la /etc/cron.d/` and inspect any relevant files (e.g. that run `pm2`, `node`, or a deploy script).
   - Search: `grep -r "pm2\|node\|aquatech" /etc/cron.d/ /var/spool/cron/ 2>/dev/null`.

2. **systemd**
   - If PM2 was set up with `pm2 startup`: the generated unit (e.g. `pm2-<user>.service`) might have `Restart=`, `TimeoutStopSec`, or a watchdog. Inspect:
     - `systemctl cat pm2-<user>.service` (or the unit name from `pm2 startup`).
   - List timers: `systemctl list-timers --all` and check for anything that could run a script that touches PM2/node.

3. **Process parent**
   - When PM2 is running: `pstree -p $(pgrep -f "PM2.*god")` (or `pstree -p $(pgrep pm2 | head -1)`) to see what is the parent of the PM2 daemon (e.g. systemd, sshd, cron).

4. **Audit / signal source (optional)**
   - If available: `auditd` or a small wrapper that logs which process sent a signal to the PM2 PID (advanced; only if Phase A.1–A.3 are inconclusive).

**Deliverable:** Note exactly which mechanism is triggering (cron job path, systemd unit/timer name, or “started by hand in SSH”). That determines the fix (disable cron, change systemd, or change how PM2 is started).

---

### Phase B — Align PM2 with how it’s started

5. **How PM2 is started**
   - If PM2 is started in an **SSH session** (e.g. `pm2 start ecosystem.config.js`), disconnecting can cause SIGHUP and kill the process group. Prefer:
     - `pm2 start ecosystem.config.js` then `pm2 save` and **pm2 startup** (systemd), so PM2 survives SSH disconnect and is the only thing managing restarts.
   - If a **deploy script** or CI runs `pm2 restart all` or `pm2 reload all` on a schedule, change that to “restart only when we deploy,” not every 1–2 minutes.

6. **Single ecosystem file in production**
   - Confirm which file is used on the server (e.g. `ecosystem.config.js` vs `ecosystem.config.multi-api.js`). If you use `multi-api` (2 API instances), ensure the droplet has enough memory and that no cron/systemd is restarting the whole PM2 daemon “to be safe.”

---

### Phase C — Server logic: graceful shutdown (recommended regardless)

So that when PM2 *is* killed (or restarted), the API shuts down cleanly and doesn’t leave connections hanging:

7. **Add SIGTERM handler in the API** (`src/index.js`)
   - Today only **SIGINT** is handled; PM2 sends **SIGTERM** when it stops the process. Add the same graceful shutdown for **SIGTERM** (close MongoDB, close PostgreSQL pools if any, then `process.exit(0)`). This matches what mqtt-consumer already does and avoids “process killed” without “Cerrando servidor” / pool close.

8. **Optional: PostgreSQL pool close on shutdown**
   - Ensure any PostgreSQL client used by the API is closed in the same SIGINT/SIGTERM handler (you already log “Closing connection pool” when SIGINT runs; ensure that path also runs on SIGTERM once you add it).

These changes don’t stop PM2 from being killed, but they make the **server logic** correct under shutdown and reduce risk of connection leaks or inconsistent state.

---

### Phase D — PM2 configuration (only after Phase A)

9. **Avoid unnecessary restarts**
   - In `ecosystem.config.*`: you already have `watch: false`, `max_memory_restart`, `max_restarts`, `min_uptime`. Do **not** add `cron_restart` unless you explicitly want a scheduled restart; it could add another source of restarts.
   - If the **cause** turns out to be systemd restarting PM2 (e.g. thinking it’s unhealthy), adjust the unit (e.g. increase timeouts, or remove a watchdog) instead of adding more restarts in PM2.

10. **Logging**
    - Keep capturing PM2 logs (as in `logs.yaml`). After changing cron/systemd and adding SIGTERM, compare a new 1–2 hour window: “pm2 has been killed by signal” should stop appearing once the external trigger is removed.

---

## 4. Summary table

| Step | Action | Goal |
|------|--------|------|
| A.1–A.3 | Inspect cron, systemd, and PM2’s parent process on the droplet | Find what sends the signal to PM2 every ~90 s |
| B.5–B.6 | Ensure PM2 runs under systemd (or desired process) and no deploy/cron restarts PM2 every minute | Stable PM2 lifecycle |
| C.7–C.8 | Add SIGTERM handler (and ensure PG pool close) in API | Correct server shutdown when PM2 kills the process |
| D.9–D.10 | Tune PM2/ecosystem and re-check logs | No unintended restarts; confirm fixes |

---

## 5. Conclusion

- The logs show **PM2 itself** is being killed by an **external signal** roughly every **~1.5 minutes**, not OOM and not an in-app crash.
- **Next step:** On the droplet, run Phase A (cron + systemd + process tree). Once the trigger is found, disable or reschedule it (Phase B). Adding a **SIGTERM** handler and clean shutdown in the API (Phase C) is recommended regardless, so that when a kill happens, server logic (DB/pool closure) is correct. After that, re-check logs to confirm “process killed” no longer occurs at that interval.

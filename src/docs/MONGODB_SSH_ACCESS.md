# MongoDB: localhost-only + SSH tunnel access (server-side)

MongoDB runs on the server as a **fork process**. To allow connections **only** via SSH (same idea as PostgreSQL), MongoDB must listen **only on localhost** on the server. Remote access is then done by SSH tunnel from your machine; no direct MongoDB port is exposed.

> **All steps in section 1 are performed on the server.** Section 2 is for connecting from your local machine via SSH tunnel.

---

## 0. Starting MongoDB manually on the server (no script)

Run these on the server as root. Use the **mongod** user so the process does not exit with "child process failed, exited with 1" (MongoDB typically refuses to run as root).

**1. Stop any existing mongod**

```bash
sudo pkill -f mongod
```

**2. Start mongod in the background (fork)**

```bash
sudo -u mongod mongod --config /etc/mongod.conf --fork --logpath /var/log/mongodb/mongod.log
```

You should see something like: `forked process: XXXXX` and then the shell returns. Check that it’s running:

```bash
pgrep -f mongod
```

**If it still fails:** run **without** `--fork` to see the real error in the terminal (then stop with Ctrl+C):

```bash
sudo -u mongod mongod --config /etc/mongod.conf
```

**If the `mongod` user does not exist:** create it and set ownership of data and log dirs (paths may vary; adjust if your config uses different paths):

```bash
# Example for RHEL/CentOS-style layout
sudo useradd -r mongod 2>/dev/null || true
sudo mkdir -p /var/lib/mongo /var/log/mongodb
sudo chown -R mongod:mongod /var/lib/mongo /var/log/mongodb
```

Then run step 2 again.

---

## 1. Server-side: bind MongoDB to localhost only

On the server, MongoDB is started with `/etc/mongod.conf`. To accept connections only from the same machine (and from SSH-tunneled connections that appear as local):

1. **Edit the config** (path may vary; common ones):
   - `/etc/mongod.conf` (Linux, package install)
   - Or the config file you pass to `mongod --config ...` in `services_recover.sh`

2. **Set `bindIp` to localhost.**

   **YAML format** (MongoDB 3.2+):

   ```yaml
   net:
     port: 27017
     bindIp: 127.0.0.1
   ```

   **Legacy format** (older or some distros):

   ```ini
   bind_ip = 127.0.0.1
   ```

   Use only one of the two, depending on what your `mongod.conf` already uses.  
   **Sample server-side snippet** (add/merge with your existing `/etc/mongod.conf` on the server):

   ```yaml
   # /etc/mongod.conf (server only - listen on localhost)
   net:
     port: 27017
     bindIp: 127.0.0.1
   storage:
     dbPath: /var/lib/mongo
   systemLog:
     path: /var/log/mongodb/mongod.log
     destination: file
   ```

3. **Restart MongoDB** so the new config is applied.  
   If you use the project’s recovery script:

   ```bash
   sudo bash scripts/services_recover.sh
   ```

   That script starts `mongod` with `--config /etc/mongod.conf`, so whatever you set in `/etc/mongod.conf` (including `bindIp: 127.0.0.1`) is what runs on the server.

4. **Check that it’s listening only on localhost:**

   ```bash
   ss -tlnp | grep 27017
   # or
   netstat -tlnp | grep 27017
   ```

   You should see `127.0.0.1:27017`, not `0.0.0.0:27017`.

Result: **on the server**, MongoDB is only reachable as `127.0.0.1:27017`. Your API (and anything else on the same host) connects with `MONGODB_URI=mongodb://127.0.0.1:27017/...` (or `localhost`). No direct MongoDB port is exposed to the internet.

---

## 2. Client-side: how the connection string is built

When you use an SSH tunnel, **your client does not connect to the server’s IP**. It connects to **your own machine** (localhost). The tunnel then forwards that traffic to MongoDB on the server.

### Step 1: Open the tunnel (on your laptop/PC)

In a terminal, leave this running:

```bash
ssh -N -L 27017:127.0.0.1:27017 YOUR_USER@SERVER_IP
```

- `YOUR_USER`: your user on the server (with SSH key).
- `SERVER_IP`: server hostname or IP (e.g. `164.92.95.176`).

Meaning: “Forward **my local** port 27017 to **the server’s** 127.0.0.1:27017.”  
So while the tunnel is open, anything that connects to `localhost:27017` on **your PC** is actually talking to MongoDB on the server.

### Step 2: Build the connection string (client side)

Because the tunnel makes the server’s MongoDB appear on your machine at `localhost:27017`, the connection string always uses **localhost** (or `127.0.0.1`), **never** the server’s IP.

**No auth:**

```text
mongodb://localhost:27017/DATABASE_NAME
```

Example for your DB:

```text
mongodb://localhost:27017/aquatech_prod
```

**With username and password:**

```text
mongodb://USERNAME:PASSWORD@localhost:27017/DATABASE_NAME?authSource=admin
```

**Example — before (direct to server, no longer works once bindIp is 127.0.0.1):**

```text
mongodb://aquatech_root:PASSWORD@164.92.95.176:27017/aquatech_prod?authSource=admin
```

**Example — after (with SSH tunnel; use this in Compass / mongosh on your PC):**

```text
mongodb://aquatech_root:PASSWORD@localhost:27017/aquatech_prod?authSource=admin
```

Only the host changes: `164.92.95.176` → `localhost`. Same user, password, database, and `authSource=admin`.  
Keep the tunnel running: `ssh -N -L 27017:127.0.0.1:27017 YOUR_USER@164.92.95.176`

**Summary:**

| You use in the client | Why |
|-----------------------|-----|
| **Host:** `localhost` (or `127.0.0.1`) | The tunnel exposes the server’s MongoDB on your local port 27017. |
| **Port:** `27017` | Same port locally; the tunnel maps it to the server. |
| **Do not use** the server’s public IP in the connection string | MongoDB on the server only listens on 127.0.0.1; the tunnel is what reaches it, and the client talks only to localhost. |

### Step 3: Where to use the connection string — Compass or terminal?

You can use **either** MongoDB Compass **or** the terminal (mongosh). You don’t need both.

**Option A — MongoDB Compass (paste the URI)**

1. Open a **terminal** and start the tunnel (leave it open):  
   `ssh -N -L 27017:127.0.0.1:27017 YOUR_SSH_USER@164.92.95.176`
2. Open **MongoDB Compass**.
3. Click **New Connection** (or the “Fill in connection details individually” link).
4. In the **connection URI** field, paste the full string, e.g.:  
   `mongodb://aquatech_root:YOUR_PASSWORD@localhost:27017/aquatech_prod?authSource=admin`
5. Click **Connect**.

You only need the terminal for the SSH tunnel; Compass uses the URI you pasted.

**Option B — Terminal (mongosh)**

1. Open a **terminal** and start the tunnel (leave it open):  
   `ssh -N -L 27017:127.0.0.1:27017 YOUR_SSH_USER@164.92.95.176`
2. Open **another terminal** and run:  
   `mongosh "mongodb://aquatech_root:YOUR_PASSWORD@localhost:27017/aquatech_prod?authSource=admin"`

So: **yes, paste the string in the connection URI in MongoDB Compass** — that’s the right place. You don’t have to use the terminal to connect to MongoDB; the terminal is only for (1) the tunnel and (2) mongosh if you prefer that instead of Compass.

Important: the tunnel must be running before you connect in Compass or mongosh. If you close the tunnel terminal, the connection will drop until you run the `ssh -N -L ...` command again.

---

## 3. Summary

| Where        | What |
|-------------|------|
| **Server**  | `mongod.conf`: `net.bindIp: 127.0.0.1`. Start MongoDB with that config (e.g. `services_recover.sh`). |
| **Server**  | API uses `MONGODB_URI=mongodb://127.0.0.1:27017/...` (or `localhost`). |
| **Your PC** | 1) Run `ssh -N -L 27017:127.0.0.1:27017 USER@SERVER` (leave it open). 2) In the client, use **only localhost**: `mongodb://localhost:27017/DATABASE_NAME` (or with user/pass and `?authSource=admin`). |

**Client connection string (with tunnel):** always `localhost` (or `127.0.0.1`), port `27017`, never the server’s IP. The tunnel makes the server’s MongoDB appear on your machine at that address.

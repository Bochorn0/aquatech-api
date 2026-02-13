# 502 when API gets stuck – proxy & SSL configuration

When the API process is **stuck or slow** (not only Tuya quota), the reverse proxy can close the connection and return **502 Bad Gateway**. This often comes from how the proxy was set up, especially with SSL.

**This project uses Apache** (see `Aquatech_front/.env-example`: "production uses Apache reverse proxy"). The Apache section below is the one to use for www.lcc.com.mx.

## What to check on the server

Your proxy config is probably under:

- **Apache (httpd):** `/etc/httpd/conf.d/*.conf` (RHEL/CentOS) or `/etc/apache2/sites-available/` (Debian/Ubuntu). Look for `<VirtualHost *:443>` with `SSLEngine on` and `ProxyPass` to your Node API (e.g. `http://127.0.0.1:5000`).
- **Nginx:** `/etc/nginx/nginx.conf` or `/etc/nginx/conf.d/*.conf` or `/etc/nginx/sites-available/`

---

## Apache: timeouts and proxy (fix for 502)

If the proxy waits less time than the API needs, Apache closes the connection and returns 502. **Increase timeouts** in the VirtualHost that proxies to the API.

### Required modules

Ensure these are enabled (RHEL/CentOS: often already on; Debian/Ubuntu: `a2enmod proxy proxy_http ssl`):

```apache
LoadModule proxy_module modules/mod_proxy.so
LoadModule proxy_http_module modules/mod_proxy_http.so
LoadModule ssl_module modules/mod_ssl.so
```

### Timeout directives (critical)

Inside your `<VirtualHost *:443>` that has `ProxyPass /api/`:

```apache
# Time (seconds) Apache waits for the backend to respond. Default is 60 – too low when API is slow/stuck.
Timeout 120
# Apache 2.4.47+: timeout for proxy to backend only (recommended)
ProxyTimeout 120
```

If you have long-running requests (e.g. reports), use 300:

```apache
Timeout 300
ProxyTimeout 300
```

### Full Apache VirtualHost example (SSL + proxy to Node API)

Use this as a reference and compare with your current config. Typical file: `/etc/httpd/conf.d/lcc-ssl.conf` or `/etc/httpd/conf.d/ssl.conf` (RHEL/CentOS) or a file in `sites-available` (Debian/Ubuntu).

```apache
<VirtualHost *:443>
    ServerName www.lcc.com.mx

    SSLEngine on
    SSLCertificateFile      /path/to/fullchain.pem
    SSLCertificateKeyFile   /path/to/privkey.pem
    # If you use a chain file:
    # SSLCertificateChainFile /path/to/chain.pem

    # --- Timeouts: avoid 502 when API is slow or stuck ---
    Timeout 120
    ProxyTimeout 120

    # --- Proxy to Node API (PM2 on port 5000) ---
    ProxyPreserveHost On
    ProxyPass /api/ http://127.0.0.1:5000/api/
    ProxyPassReverse /api/ http://127.0.0.1:5000/api/

    # Forward client info to the API
    RequestHeader set X-Forwarded-Proto "https"
    RequestHeader set X-Forwarded-Port "443"

    # --- Optional: frontend (if served from same server) ---
    # DocumentRoot /var/www/aquatech-front/build
    # <Directory /var/www/aquatech-front/build>
    #     Options -Indexes +FollowSymLinks
    #     AllowOverride All
    #     Require all granted
    # </Directory>
</VirtualHost>
```

After editing, test and reload:

```bash
# RHEL/CentOS
sudo apachectl configtest && sudo systemctl reload httpd

# Debian/Ubuntu
sudo apache2ctl configtest && sudo systemctl reload apache2
```

### Apache quick checklist

| Item | Action |
|------|--------|
| `Timeout` | Set to 120 (or 300) in the VirtualHost |
| `ProxyTimeout` | Set to 120 (or 300) – Apache 2.4.47+ |
| `ProxyPass` / `ProxyPassReverse` | Point `/api/` to `http://127.0.0.1:5000/api/` |
| `X-Forwarded-Proto` | Set to `https` so the API knows it’s behind SSL |
| Reload | `apachectl configtest && systemctl reload httpd` (or apache2) |

If your Apache is older and doesn’t support `ProxyTimeout`, use a higher `Timeout` (e.g. `Timeout 120`) in that VirtualHost.

**Finding your current Apache SSL config on the server:**  
List vhosts and grep for SSL or proxy:  
`grep -l -r "ProxyPass\|SSLEngine\|443" /etc/httpd/conf.d/` (RHEL/CentOS) or  
`grep -l -r "ProxyPass\|SSLEngine\|443" /etc/apache2/` (Debian/Ubuntu).  
Add or adjust `Timeout` and `ProxyTimeout` in that file, then reload.

---

## Verified: your lcc.com.mx config (httpd-le-ssl.conf)

Your SSL vhost for **lcc.com.mx** proxies `/api` to `http://127.0.0.1:3009/api` (API on port 3009). There are **no timeout directives**, so Apache uses the default (60 seconds). When the API is slow or stuck, Apache closes the connection after 60s and returns **502**.

**Fix:** Add the following inside the first `<VirtualHost *:443>` (the one for lcc.com.mx), right after the `ServerAlias` line and before the `# Reverse proxy` comment:

```apache
    # Timeouts – avoid 502 when API is slow or stuck (default is 60s)
    Timeout 120
    ProxyTimeout 120
```

Optional but recommended: add the forwarded headers so the API knows it’s behind HTTPS:

```apache
    RequestHeader set X-Forwarded-Proto "https"
    RequestHeader set X-Forwarded-Port "443"
```

**Example – your VirtualHost with the fix applied:**

```apache
<IfModule mod_ssl.c>
<VirtualHost *:443>
    ServerName lcc.com.mx
    ServerAlias www.lcc.com.mx

    # Timeouts – avoid 502 when API is slow or stuck (default is 60s)
    Timeout 120
    ProxyTimeout 120

    # ===============================
    # Reverse proxy to Node.js API (3009)
    # ===============================
    ProxyPreserveHost On
    RequestHeader set X-Forwarded-Proto "https"
    RequestHeader set X-Forwarded-Port "443"
    ProxyPass /api http://127.0.0.1:3009/api
    ProxyPassReverse /api http://127.0.0.1:3009/api
    <Proxy http://127.0.0.1:3009/*>
        Require all granted
    </Proxy>

    DocumentRoot /var/www/html
    ...
```

**To apply on the server:** Edit `/etc/httpd/conf/httpd-le-ssl.conf` (or the path where this file lives, e.g. `conf.d/`), add the lines above, then run:

```bash
sudo apachectl configtest && sudo systemctl reload httpd
```

If you need to allow even longer requests (e.g. heavy reports), use `Timeout 300` and `ProxyTimeout 300` instead of 120.

---

## Does the timeout fix the API actually getting stuck?

**No.** The Apache timeout only prevents **502** when the API is slow (Apache waits 120s instead of 60s). It does **not** stop the Node process from getting stuck or make slow requests faster.

**What does help:**

1. **fetchLogsRoutine runs in the background**  
   The endpoint now returns **202 Accepted** immediately and runs the Tuya log fetch in the background. The HTTP connection is closed right away, so login and other requests are not blocked by that routine. (Tuya quota abort and this background behavior are implemented in the API.)

2. **Two PM2 instances (optional)**  
   With `instances: 1`, one long or stuck request can block all traffic. In `ecosystem.config.cjs` you can set `instances: 2` for `api-aquatech` so one stuck request doesn’t block every user. With 2GB RAM, monitor memory after changing.

3. **Find other slow code**  
   If login or other endpoints are still slow, profile with `pm2 logs` and fix slow DB queries or heavy work (or move them to background jobs).

---

## Nginx reference (optional)

If you were using Nginx instead of Apache, the following would apply.

### 1. Timeouts (most common cause of 502)

If the proxy waits less time than the API needs to respond, it closes the connection and returns 502.

**Nginx – add or adjust in the `location` that proxies to the API:**

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:5000;   # or your API URL

    # Timeouts – avoid 502 when API is slow or stuck
    proxy_connect_timeout 10s;   # time to connect to backend
    proxy_send_timeout 120s;     # time to send request to backend
    proxy_read_timeout 120s;     # time to wait for backend response (critical)

    # If you have long-running requests (e.g. reports), consider 300s:
    # proxy_read_timeout 300s;
    # proxy_send_timeout 300s;
}
```

Default `proxy_read_timeout` is often 60s; one slow request and you get 502. **120s (or 300s for long routes) is a good range.**

### 2. HTTP version and keepalive to backend

Using HTTP/1.1 and keepalive to the Node app can avoid “connection closed while API was still working” and reduce 502s when the process is briefly busy.

**Nginx – in the same `location /api/` block:**

```nginx
proxy_http_version 1.1;
proxy_set_header Connection "";
```

And define an **upstream** with keepalive (in `http` or at top of `server`):

```nginx
upstream api_backend {
    server 127.0.0.1:5000;
    keepalive 8;
}

server {
    listen 443 ssl;
    server_name www.lcc.com.mx;
    # ... ssl_certificate, ssl_certificate_key ...

    location /api/ {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 10s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }
}
```

### 3. Buffering (SSL + long responses)

With SSL, buffering can sometimes interact badly with long or streaming responses and contribute to “stuck” behavior or 502. For an API, disabling buffering is often safe:

```nginx
location /api/ {
    proxy_buffering off;
    proxy_request_buffering off;
    # ... rest of proxy_* and proxy_set_header ...
}
```

### 4. Full example (Nginx + SSL)

Use this as a reference and compare with your current SSL + proxy block:

```nginx
upstream api_backend {
    server 127.0.0.1:5000;
    keepalive 8;
}

server {
    listen 443 ssl http2;
    server_name www.lcc.com.mx;

    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key  /path/to/privkey.pem;
    # ... other ssl_* settings you already have ...

    location /api/ {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 10s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;

        proxy_buffering off;
        proxy_request_buffering off;
    }

    # If you serve the frontend from the same server:
    # location / { ... }
}
```

After editing, test and reload:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## If the API process itself is stuck

- **One PM2 instance:** With `instances: 1`, a single long or stuck request can block all traffic; the proxy then times out → 502. Increasing `proxy_read_timeout` helps, but the root cause is the stuck process.
- **Two instances (if RAM allows):** In `ecosystem.config.cjs` you can try `instances: 2` so one stuck request doesn’t block every request. With 2GB RAM this may be tight; monitor memory after changing.
- **Find what’s stuck:** Use `pm2 logs api-aquatech` and look for slow endpoints (e.g. login, fetchLogsRoutine, heavy DB queries). We already added early abort for Tuya quota; other long routes may need optimization or background jobs.

---

### Nginx quick checklist

| Item | Action |
|------|--------|
| `proxy_read_timeout` | Set to 120s (or 300s) for `/api/` |
| `proxy_send_timeout` | Set to 120s (or 300s) |
| `proxy_http_version 1.1` + `Connection ""` | Use with upstream keepalive |
| `upstream` with `keepalive 8` | Reuse connections to Node |
| `proxy_buffering off` | Optional, can help with SSL + long responses |
| Reload proxy | `nginx -t && systemctl reload nginx` |

If 502s persist, capture the exact VirtualHost (Apache) or server block (Nginx) from the server and compare it to this reference to spot missing or conflicting directives.

# Azure App Service Setup for Aquatech API

## Required Configuration

### 1. GitHub Secrets (for deployment)

In your repo: **Settings → Secrets and variables → Actions**, add:

| Secret | Value | Required |
|--------|-------|----------|
| `POSTGRES_HOST` | `tiwaterprod.postgres.database.azure.com` | Yes |
| `POSTGRES_DB` | `postgres` | **Yes** – migrations run on this DB |
| `POSTGRES_USER` | `AdminTiWater` | Yes |
| `POSTGRES_PASSWORD` | Your tiwaterprod admin password | Yes |
| `POSTGRES_PORT` | `5432` | Optional (default) |
| `POSTGRES_SSL` | Handled by workflow | No (injected automatically) |

**Important:** `POSTGRES_DB` must be `postgres` because migrations were run against that database.

### 2. Azure App Service Application Settings

In **Azure Portal → App Service (lccapp) → Configuration → Application settings**, add:

| Name | Value |
|-----|--------|
| `POSTGRES_HOST` | `tiwaterprod.postgres.database.azure.com` |
| `POSTGRES_DB` | `postgres` |
| `POSTGRES_USER` | `AdminTiWater` |
| `POSTGRES_PASSWORD` | Your tiwaterprod admin password |
| `POSTGRES_SSL` | `true` |
| `SECRET_KEY` | A random string for JWT signing (e.g. `openssl rand -base64 32`) |

These override any `.env` in the deployment and ensure the running app uses the correct database.

**Important:** `SECRET_KEY` is required for login. Without it you'll get `secretOrPrivateKey must have a value`.

### 3. Azure PostgreSQL Firewall (tiwaterprod)

The App Service must be allowed to connect to tiwaterprod:

1. **Azure Portal** → **PostgreSQL flexible servers** → **tiwaterprod**
2. **Settings** → **Networking** (or **Connection security**)
3. Enable **Allow public access from any Azure service within Azure to this server**
4. Save

Without this, the App Service will get connection timeouts.

### 4. Verify

After redeploying:

- Check App Service logs for `[PostgreSQL] ✅ Connected successfully`
- Try login at `https://<your-app>.azurewebsites.net/api/v1.0/auth/login`

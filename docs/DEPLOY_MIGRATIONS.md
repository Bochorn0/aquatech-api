# Deploy Migrations

The backend deploy workflow runs database migrations **before** deploying to Azure. Migrations are tracked in a `migrations` table; only files not yet applied are executed.

## How It Works

1. Lists all `.sql` files in `scripts/migrations/` (sorted by name)
2. Queries the `migrations` table for already-executed files
3. Runs each pending migration in a transaction
4. Inserts the filename into `migrations` after success

## Required GitHub Secrets

Add these secrets to your repository (Settings → Secrets and variables → Actions):

| Secret | Description |
|--------|-------------|
| `POSTGRES_HOST` | PostgreSQL host (e.g. `your-server.postgres.database.azure.com`) |
| `POSTGRES_PORT` | Port (default `5432`) |
| `POSTGRES_DB` | Database name (e.g. `postgres` or `tiwater_timeseries`) |
| `POSTGRES_USER` | Database user |
| `POSTGRES_PASSWORD` | Database password |
| `POSTGRES_SSL` | Set to `true` for Azure PostgreSQL |

## Migrations Table

Executed migrations are stored in the `migrations` table:

| Column      | Type        |
|-------------|-------------|
| id          | BIGSERIAL   |
| name        | VARCHAR(255) (filename) |
| executed_at | TIMESTAMPTZ |

## Excluding Migrations

For Azure (no TimescaleDB), exclude the TimescaleDB-specific sensores migration:

```
POSTGRES_EXCLUDE_MIGRATIONS=001_create_sensores_table.sql
```

## Manual Run

To run migrations locally or on a server:

```bash
cd Aquatech_api
npm run migrate:deploy
```

Or full setup (first-time):

```bash
npm run setup
```

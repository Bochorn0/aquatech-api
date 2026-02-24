# PostgreSQL Auth Migration (Users & Roles)

Auth has been migrated from MongoDB to PostgreSQL. Users and roles are now stored in Postgres.

## Prerequisites

- PostgreSQL running (local or Azure)
- `clients` table exists (migration 007)
- `.env` with `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`

## Migrations

Run in order:

```bash
# 1. Create roles table
bash scripts/migrations/run-migration.sh scripts/migrations/018_create_roles_table.sql

# 2. Create users table
bash scripts/migrations/run-migration.sh scripts/migrations/019_create_users_table.sql

# 3. Seed roles and default client
bash scripts/migrations/run-migration.sh scripts/migrations/020_seed_roles_and_admin_user.sql

# 4. Seed admin user (admin@lcc.com.mx / admin)
npm run seed:admin
```

Or run all at once:

```bash
npm run migrate:auth
npm run seed:admin
```

## Admin User

- **Email:** admin@lcc.com.mx
- **Password:** admin

## Local Testing

1. **PostgreSQL**: Ensure PostgreSQL is running. On macOS with Homebrew, the default user is your system username.
2. **Configure .env** with your local Postgres credentials:
   ```
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_DB=tiwater_timeseries
   POSTGRES_USER=luisfercordova   # or your macOS username
   POSTGRES_PASSWORD=
   ```
3. **Create database** (if needed): `createdb tiwater_timeseries`
4. **Run migrations and seed**: `npm run migrate:auth && npm run seed:admin`
5. **Start API**: `npm run dev`
6. **Login** at frontend with admin@lcc.com.mx / admin

> **Note**: If you see `role "TIWater_user" does not exist`, use your macOS username for `POSTGRES_USER` instead of `TIWater_user`.

## Azure Deployment

1. Add `POSTGRES_*` env vars to App Service (or use existing).
2. Run migrations against Azure Postgres before/after deploy:
   - Use GitHub Actions or a one-time script with Azure Postgres connection.
   - Or run locally with `POSTGRES_HOST=lccapp-server.postgres.database.azure.com` etc.
3. Run `npm run seed:admin` against the same DB.

## Tables

- **roles**: id, name, protected, permissions (TEXT[]), dashboard_version
- **users**: id, email, password, role_id, client_id, postgres_client_id, status, verified, nombre, puesto, etc.

## Code Changes

- Auth uses `UserModel` and `RoleModel` (Postgres) instead of Mongoose User/Role.
- JWT payload: `{ id: user.id, role: user.role_id }` (numeric ids).
- MongoDB User/Role models remain for reference but are no longer used for auth.

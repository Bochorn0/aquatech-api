# Production Deployment - PostgreSQL Setup

## Quick Setup on CentOS

### 1. Run Setup Script
```bash
sudo bash scripts/setup-postgres-centos.sh
```
Defaults: Database=`TIWater_timeseries`, User=`TIWater_user`, Password=`TIW4terMa1nS3rv3r`

### 2. Install Dependencies
```bash
npm install
```

### 3. Update .env
```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=TIWater_timeseries
POSTGRES_USER=TIWater_user
POSTGRES_PASSWORD=TIW4terMa1nS3rv3r
POSTGRES_SSL=false
```

### 4. Run Migration
```bash
npm run migrate:sensores
```

### 5. Test & Restart
```bash
npm run test:postgres
pm2 restart all  # or your process manager
```

## Verify
```bash
psql -U TIWater_user -d TIWater_timeseries -c "SELECT COUNT(*) FROM sensores;"
```

## Files Required
- `scripts/setup-postgres-centos.sh`
- `scripts/migrations/001_create_sensores_table.sql`
- `scripts/migrations/run-migration.sh`
- `src/config/postgres.config.js`
- `src/models/postgres/sensores.model.js`
- `src/services/postgres.service.js`
- `src/services/mqtt.service.js` (updated)
- `package.json` (with `pg` dependency)


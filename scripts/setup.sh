#!/bin/bash
#
# Aquatech API - First-time setup script
# Runs all PostgreSQL migrations and seeds the admin user.
# Use for local dev, Azure, or any fresh deployment.
#
# Prerequisites:
#   - .env with POSTGRES_HOST, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
#   - PostgreSQL accessible (local or Azure)
#
# Usage:
#   cd Aquatech_api && npm run setup
#   # or
#   bash scripts/setup.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$API_DIR"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}  Aquatech API - First-time Setup${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Load .env (optional in CI - vars can be passed via environment)
if [ -f .env ]; then
  export $(grep -E '^POSTGRES_' .env 2>/dev/null | grep -v '^#' | xargs) 2>/dev/null || true
  if [ -z "${POSTGRES_HOST:-}" ] && [ -z "${POSTGRES_DB:-}" ]; then
    export $(grep -v '^#' .env | xargs) 2>/dev/null || true
  fi
fi

if [ -z "${POSTGRES_HOST:-}" ] && [ -z "${POSTGRES_DB:-}" ]; then
  echo -e "${RED}Error: PostgreSQL config missing${NC}"
  echo "Set POSTGRES_HOST, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD (or create .env)"
  exit 1
fi

echo "Database: ${POSTGRES_DB:-tiwater_timeseries} @ ${POSTGRES_HOST:-localhost}"
echo ""

# Migration list in dependency order
MIGRATIONS=(
  "scripts/migrations/001_create_sensores_table_basic.sql"   # Use basic (no TimescaleDB) for Azure compatibility
  "scripts/migrations/002_create_punto_venta_table.sql"
  "scripts/migrations/003_create_get_or_create_punto_venta_function.sql"
  "scripts/migrations/006_create_metrics_table.sql"
  "scripts/migrations/007_create_clients_table.sql"
  "scripts/migrations/008_create_cities_table.sql"
  "scripts/migrations/009_insert_default_cities.sql"
  "scripts/migrations/010_create_punto_venta_sensors_table.sql"
  "scripts/migrations/011_alter_metrics_table_for_configuration.sql"
  "scripts/migrations/012_remove_legacy_fields_from_metrics.sql"
  "scripts/migrations/013_create_metric_alerts_table.sql"
  "scripts/migrations/014_create_calidad_agua_table.sql"
  "scripts/migrations/015_create_metric_email_log_and_alter_alerts.sql"
  "scripts/migrations/016_metric_rules_severity_field.sql"
  "scripts/migrations/017_add_dev_mode_to_puntoventa.sql"
  "scripts/migrations/018_create_roles_table.sql"
  "scripts/migrations/019_create_users_table.sql"
  "scripts/migrations/020_seed_roles_and_admin_user.sql"
  "scripts/migrations/021_create_products_table.sql"
  "scripts/migrations/022_create_controllers_table.sql"
  "scripts/migrations/023_create_notifications_table.sql"
  "scripts/migrations/024_create_product_logs_table.sql"
  "scripts/migrations/025_create_reports_table.sql"
  "scripts/migrations/026_create_client_metrics_table.sql"
)

for migration in "${MIGRATIONS[@]}"; do
  if [ -f "$migration" ]; then
    echo -e "${YELLOW}Running: $migration${NC}"
    bash scripts/migrations/run-migration.sh "$migration"
  else
    echo -e "${RED}Missing: $migration${NC}"
    exit 1
  fi
done

echo ""
echo -e "${GREEN}✅ All migrations completed${NC}"
echo ""

# Seed admin user
echo -e "${YELLOW}Seeding admin user...${NC}"
npm run seed:admin

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Setup complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Default admin: admin@lcc.com.mx / admin"
echo ""

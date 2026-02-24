#!/bin/bash
# Setup PostgreSQL locally for Aquatech (creates user, database, and runs migrations)
# Usage: ./scripts/setup-postgres-local.sh

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Use current user if POSTGRES_USER not set (typical for Homebrew PostgreSQL on macOS)
PG_USER=${POSTGRES_USER:-$(whoami)}
PG_DB=${POSTGRES_DB:-tiwater_timeseries}
PG_HOST=${POSTGRES_HOST:-localhost}

echo -e "${YELLOW}Setting up PostgreSQL for Aquatech...${NC}"
echo "User: $PG_USER | Database: $PG_DB | Host: $PG_HOST"
echo ""

# Create database if it doesn't exist
if psql -h "$PG_HOST" -U "$PG_USER" -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$PG_DB"; then
  echo -e "${GREEN}Database $PG_DB already exists${NC}"
else
  echo "Creating database $PG_DB..."
  createdb -h "$PG_HOST" -U "$PG_USER" "$PG_DB" 2>/dev/null || psql -h "$PG_HOST" -U "$PG_USER" -d postgres -c "CREATE DATABASE $PG_DB;"
  echo -e "${GREEN}Database $PG_DB created${NC}"
fi

echo ""
echo -e "${GREEN}PostgreSQL setup complete.${NC}"
echo ""
echo "Add to your .env:"
echo "  POSTGRES_HOST=$PG_HOST"
echo "  POSTGRES_PORT=5432"
echo "  POSTGRES_DB=$PG_DB"
echo "  POSTGRES_USER=$PG_USER"
echo "  POSTGRES_PASSWORD="
echo ""
echo "Then run: npm run migrate:auth && npm run seed:admin"

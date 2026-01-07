#!/bin/bash

# Script to test puntoventa migration with detailed output

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

# Set PostgreSQL connection parameters
PGHOST=${POSTGRES_HOST:-localhost}
PGPORT=${POSTGRES_PORT:-5432}
PGDATABASE=${POSTGRES_DB:-TIWater_timeseries}
PGUSER=${POSTGRES_USER:-TIWater_user}

echo -e "${YELLOW}Testing puntoventa migration...${NC}"
echo -e "Host: $PGHOST"
echo -e "Port: $PGPORT"
echo -e "Database: $PGDATABASE"
echo -e "User: $PGUSER"
echo ""

# Use full path to psql on CentOS (PostgreSQL 15)
if [ -f /usr/pgsql-15/bin/psql ]; then
    PSQL_CMD="/usr/pgsql-15/bin/psql"
elif command -v psql &> /dev/null; then
    PSQL_CMD="psql"
else
    echo -e "${RED}Error: psql command not found${NC}"
    exit 1
fi

# Test connection first
echo -e "${YELLOW}Testing connection...${NC}"
if [ -n "$POSTGRES_PASSWORD" ]; then
    export PGPASSWORD=$POSTGRES_PASSWORD
    $PSQL_CMD -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -c "SELECT version();" 2>&1
else
    $PSQL_CMD -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -c "SELECT version();" 2>&1
fi

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Connection failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Connection successful${NC}"
echo ""

# Check if table exists
echo -e "${YELLOW}Checking if puntoventa table exists...${NC}"
if [ -n "$POSTGRES_PASSWORD" ]; then
    export PGPASSWORD=$POSTGRES_PASSWORD
    $PSQL_CMD -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'puntoventa');" 2>&1
else
    $PSQL_CMD -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'puntoventa');" 2>&1
fi

echo ""

# Try to create table directly
echo -e "${YELLOW}Attempting to create puntoventa table...${NC}"
MIGRATION_FILE="scripts/migrations/002_create_punto_venta_table.sql"

if [ -n "$POSTGRES_PASSWORD" ]; then
    export PGPASSWORD=$POSTGRES_PASSWORD
    $PSQL_CMD -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -f $MIGRATION_FILE -v ON_ERROR_STOP=1 2>&1
    EXIT_CODE=$?
else
    $PSQL_CMD -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -f $MIGRATION_FILE -v ON_ERROR_STOP=1 2>&1
    EXIT_CODE=$?
fi

echo ""

if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Migration completed successfully!${NC}"
    
    # Verify table was created
    echo -e "${YELLOW}Verifying table creation...${NC}"
    if [ -n "$POSTGRES_PASSWORD" ]; then
        export PGPASSWORD=$POSTGRES_PASSWORD
        $PSQL_CMD -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" 2>&1
    else
        $PSQL_CMD -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" 2>&1
    fi
else
    echo -e "${RED}❌ Migration failed with exit code: $EXIT_CODE${NC}"
    exit 1
fi


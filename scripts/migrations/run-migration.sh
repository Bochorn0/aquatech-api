#!/bin/bash

# Script to run PostgreSQL migrations
# Usage: ./scripts/migrations/run-migration.sh [migration_file.sql]

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Function to find and add PostgreSQL to PATH (for macOS)
setup_postgresql_path() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        BREW_PREFIX=$(brew --prefix 2>/dev/null || echo "/usr/local")
        
        # Try to find PostgreSQL installation
        for version in 17 16 15 14 13; do
            if [ -d "$BREW_PREFIX/opt/postgresql@${version}/bin" ]; then
                export PATH="$BREW_PREFIX/opt/postgresql@${version}/bin:$PATH"
                return 0
            fi
        done
        
        # Try generic postgresql
        if [ -d "$BREW_PREFIX/opt/postgresql/bin" ]; then
            export PATH="$BREW_PREFIX/opt/postgresql/bin:$PATH"
            return 0
        fi
        
        # Try Cellar locations
        for version in 17 16 15 14 13; do
            CELLAR_PATH=$(find "$BREW_PREFIX/Cellar/postgresql@${version}" -name "psql" -type f 2>/dev/null | head -1)
            if [ -n "$CELLAR_PATH" ]; then
                export PATH="$(dirname "$CELLAR_PATH"):$PATH"
                return 0
            fi
        done
    fi
    return 1
}

# Setup PostgreSQL PATH if on macOS
setup_postgresql_path

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

# Default migration file
DEFAULT_MIGRATION="scripts/migrations/001_create_sensores_table.sql"

MIGRATION_FILE=${1:-$DEFAULT_MIGRATION}

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}Error: Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi

# Set PostgreSQL connection parameters
PGHOST=${POSTGRES_HOST:-localhost}
PGPORT=${POSTGRES_PORT:-5432}
PGDATABASE=${POSTGRES_DB:-TIWater_timeseries}
PGUSER=${POSTGRES_USER:-TIWater_user}

echo -e "${YELLOW}Running migration: $MIGRATION_FILE${NC}"
echo -e "Host: $PGHOST"
echo -e "Port: $PGPORT"
echo -e "Database: $PGDATABASE"
echo -e "User: $PGUSER"
echo ""

# Verify psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}Error: psql command not found${NC}"
    echo -e "${YELLOW}Please ensure PostgreSQL is installed and in your PATH${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo -e "${YELLOW}On macOS, you may need to add PostgreSQL to PATH:${NC}"
        echo -e "${YELLOW}  export PATH=\"\$(brew --prefix)/opt/postgresql@17/bin:\$PATH\"${NC}"
    fi
    exit 1
fi

# Run migration
# Use full path to psql on CentOS (PostgreSQL 15)
if [ -f /usr/pgsql-15/bin/psql ]; then
    PSQL_CMD="/usr/pgsql-15/bin/psql"
elif command -v psql &> /dev/null; then
    PSQL_CMD="psql"
else
    echo -e "${RED}Error: psql command not found${NC}"
    exit 1
fi

if [ -n "$POSTGRES_PASSWORD" ]; then
    export PGPASSWORD=$POSTGRES_PASSWORD
    $PSQL_CMD -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -f $MIGRATION_FILE -v ON_ERROR_STOP=1 2>&1
    MIGRATION_EXIT_CODE=$?
else
    $PSQL_CMD -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -f $MIGRATION_FILE -v ON_ERROR_STOP=1 2>&1
    MIGRATION_EXIT_CODE=$?
fi

if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
    echo -e "\n${GREEN}✅ Migration completed successfully!${NC}"
else
    echo -e "\n${RED}❌ Migration failed with exit code: $MIGRATION_EXIT_CODE${NC}"
    exit 1
fi


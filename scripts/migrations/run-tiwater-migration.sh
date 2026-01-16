#!/bin/bash

# Script to run TI Water PostgreSQL migrations
# Usage: ./scripts/migrations/run-tiwater-migration.sh [migration_file.sql]

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

# Load environment variables (handle multi-line values safely)
# Only load POSTGRES variables to avoid issues with certificates/keys
if [ -f .env ]; then
    # Extract only PostgreSQL related variables (one line per variable)
    # This avoids issues with multi-line certificates/keys in .env
    grep -E '^(POSTGRES|TIWATER).*=' .env | grep -v '^#' | while IFS='=' read -r key value; do
        # Remove leading/trailing whitespace
        key=$(echo "$key" | xargs)
        value=$(echo "$value" | sed 's/^"//;s/"$//' | xargs)
        
        # Export the variable (only if key is not empty)
        if [ -n "$key" ]; then
            export "$key"="$value"
        fi
    done
else
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

# Default migration file
DEFAULT_MIGRATION="scripts/migrations/004_create_tiwater_products_table.sql"

MIGRATION_FILE=${1:-$DEFAULT_MIGRATION}

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}Error: Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi

# Set PostgreSQL connection parameters for TI Water database
# Use TI Water specific variables, fallback to regular ones if not set
PGHOST=${POSTGRES_TIWATER_HOST:-${POSTGRES_HOST:-localhost}}
PGPORT=${POSTGRES_TIWATER_PORT:-${POSTGRES_PORT:-5432}}
PGDATABASE=${POSTGRES_TIWATER_DB:-ti_water}
PGUSER=${POSTGRES_TIWATER_USER:-${POSTGRES_USER:-tiwater_user}}
PGPASSWORD=${POSTGRES_TIWATER_PASSWORD:-${POSTGRES_PASSWORD:-}}

echo -e "${YELLOW}Running TI Water migration: $MIGRATION_FILE${NC}"
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
# Detect psql location - try CentOS paths first, then system PATH
PSQL_CMD=""

# Try CentOS/RedHat PostgreSQL locations (common versions)
for version in 17 16 15 14 13 12 11; do
    if [ -f "/usr/pgsql-${version}/bin/psql" ]; then
        PSQL_CMD="/usr/pgsql-${version}/bin/psql"
        echo -e "${YELLOW}Found PostgreSQL ${version} at: $PSQL_CMD${NC}"
        break
    fi
done

# If not found, try system PATH
if [ -z "$PSQL_CMD" ] && command -v psql &> /dev/null; then
    PSQL_CMD="psql"
    echo -e "${YELLOW}Using psql from system PATH${NC}"
fi

# If still not found, error
if [ -z "$PSQL_CMD" ]; then
    echo -e "${RED}Error: psql command not found${NC}"
    echo -e "${YELLOW}Please ensure PostgreSQL is installed or add it to PATH${NC}"
    echo -e "${YELLOW}Common CentOS locations: /usr/pgsql-15/bin/psql, /usr/pgsql-16/bin/psql${NC}"
    exit 1
fi

echo ""

# Run migration with output
if [ -n "$PGPASSWORD" ]; then
    export PGPASSWORD=$PGPASSWORD
    echo -e "${YELLOW}Executing migration...${NC}"
    $PSQL_CMD -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -f $MIGRATION_FILE -v ON_ERROR_STOP=1
    MIGRATION_EXIT_CODE=$?
else
    echo -e "${YELLOW}Executing migration...${NC}"
    $PSQL_CMD -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -f $MIGRATION_FILE -v ON_ERROR_STOP=1
    MIGRATION_EXIT_CODE=$?
fi

if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
    echo -e "\n${GREEN}✅ TI Water migration completed successfully!${NC}"
else
    echo -e "\n${RED}❌ TI Water migration failed with exit code: $MIGRATION_EXIT_CODE${NC}"
    exit 1
fi

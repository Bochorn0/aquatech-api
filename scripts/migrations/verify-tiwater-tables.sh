#!/bin/bash

# Script to verify TI Water tables exist
# Usage: ./scripts/migrations/verify-tiwater-tables.sh

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Load environment variables (handle multi-line values safely)
# Only load POSTGRES variables to avoid issues with certificates/keys
if [ -f .env ]; then
    # Extract only PostgreSQL related variables (one line per variable)
    # This avoids issues with multi-line certificates/keys in .env
    # Use a temporary file to avoid subshell issues with while loops
    TEMP_ENV=$(mktemp)
    grep -E '^(POSTGRES|TIWATER).*=' .env | grep -v '^#' > "$TEMP_ENV"
    
    # Read from temp file (not pipe) to avoid subshell issues
    while IFS='=' read -r key value; do
        # Skip empty lines
        [ -z "$key" ] && continue
        
        # Remove leading/trailing whitespace and quotes
        key=$(echo "$key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        value=$(echo "$value" | sed 's/^[[:space:]]*"//;s/"[[:space:]]*$//;s/^[[:space:]]*//;s/[[:space:]]*$//')
        
        # Export the variable (only if key is not empty)
        if [ -n "$key" ]; then
            export "$key"="$value"
        fi
    done < "$TEMP_ENV"
    rm -f "$TEMP_ENV"
else
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

# Set PostgreSQL connection parameters for TI Water database
PGHOST=${POSTGRES_TIWATER_HOST:-${POSTGRES_HOST:-localhost}}
PGPORT=${POSTGRES_TIWATER_PORT:-${POSTGRES_PORT:-5432}}
PGDATABASE=${POSTGRES_TIWATER_DB:-ti_water}
PGUSER=${POSTGRES_TIWATER_USER:-${POSTGRES_USER:-tiwater_user}}
PGPASSWORD=${POSTGRES_TIWATER_PASSWORD:-${POSTGRES_PASSWORD:-}}

echo -e "${YELLOW}Verifying TI Water tables in database: $PGDATABASE${NC}"
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

# Check if tables exist
if [ -n "$PGPASSWORD" ]; then
    export PGPASSWORD=$PGPASSWORD
fi

echo -e "${YELLOW}Checking for tiwater_products table...${NC}"
TABLE_EXISTS=$($PSQL_CMD -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tiwater_products');" 2>&1)

if [ "$TABLE_EXISTS" = "t" ]; then
    echo -e "${GREEN}✅ tiwater_products table exists${NC}"
    
    # Get row count
    ROW_COUNT=$($PSQL_CMD -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -tAc "SELECT COUNT(*) FROM tiwater_products;" 2>&1)
    echo -e "   Rows: $ROW_COUNT"
else
    echo -e "${RED}❌ tiwater_products table does NOT exist${NC}"
fi

echo ""

echo -e "${YELLOW}Checking for tiwater_quotes table...${NC}"
TABLE_EXISTS=$($PSQL_CMD -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tiwater_quotes');" 2>&1)

if [ "$TABLE_EXISTS" = "t" ]; then
    echo -e "${GREEN}✅ tiwater_quotes table exists${NC}"
    
    # Get row count
    ROW_COUNT=$($PSQL_CMD -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -tAc "SELECT COUNT(*) FROM tiwater_quotes;" 2>&1)
    echo -e "   Rows: $ROW_COUNT"
else
    echo -e "${RED}❌ tiwater_quotes table does NOT exist${NC}"
fi

echo ""

echo -e "${YELLOW}Checking for tiwater_quote_items table...${NC}"
TABLE_EXISTS=$($PSQL_CMD -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tiwater_quote_items');" 2>&1)

if [ "$TABLE_EXISTS" = "t" ]; then
    echo -e "${GREEN}✅ tiwater_quote_items table exists${NC}"
    
    # Get row count
    ROW_COUNT=$($PSQL_CMD -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -tAc "SELECT COUNT(*) FROM tiwater_quote_items;" 2>&1)
    echo -e "   Rows: $ROW_COUNT"
else
    echo -e "${RED}❌ tiwater_quote_items table does NOT exist${NC}"
fi

echo ""
echo -e "${YELLOW}Listing all tables in database...${NC}"
$PSQL_CMD -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -c "\dt" 2>&1

echo ""
echo -e "${GREEN}Verification complete!${NC}"

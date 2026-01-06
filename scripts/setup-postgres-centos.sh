#!/bin/bash

# PostgreSQL + TimescaleDB Setup Script for CentOS
# Run this script on your CentOS server as root or with sudo

set -e

echo "🚀 Starting PostgreSQL + TimescaleDB setup for CentOS..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root or with sudo${NC}"
    exit 1
fi

# Detect CentOS version
if [ -f /etc/centos-release ]; then
    CENTOS_VERSION=$(cat /etc/centos-release | grep -oE '[0-9]+' | head -1)
    echo -e "${GREEN}Detected CentOS version: ${CENTOS_VERSION}${NC}"
else
    echo -e "${RED}This script is designed for CentOS${NC}"
    exit 1
fi

# Step 1: Install PostgreSQL
echo -e "\n${YELLOW}Step 1: Installing PostgreSQL...${NC}"

# Detect installed PostgreSQL version
if command -v psql &> /dev/null; then
    PG_VERSION=$(psql --version | awk '{print $3}' | cut -d. -f1)
    PG_MAJOR_VERSION=$(psql --version | awk '{print $3}' | cut -d. -f1-2)
    echo -e "${GREEN}✅ PostgreSQL already installed (version ${PG_VERSION})${NC}"
    
    # Check if PostgreSQL is running
    if ! systemctl is-active --quiet postgresql-${PG_VERSION} 2>/dev/null && ! systemctl is-active --quiet postgresql 2>/dev/null; then
        echo -e "${YELLOW}Starting PostgreSQL...${NC}"
        systemctl start postgresql-${PG_VERSION} 2>/dev/null || systemctl start postgresql 2>/dev/null || true
    fi
else
    # Install PostgreSQL repository
    dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-${CENTOS_VERSION}-x86_64/pgdg-redhat-repo-latest.noarch.rpm
    
    # Install PostgreSQL 15
    dnf install -y postgresql15-server postgresql15 postgresql15-contrib
    
    # Initialize database
    /usr/pgsql-15/bin/postgresql-15-setup initdb
    
    # Enable and start PostgreSQL
    systemctl enable postgresql-15
    systemctl start postgresql-15
    
    PG_VERSION="15"
    PG_MAJOR_VERSION="15"
    echo -e "${GREEN}✅ PostgreSQL 15 installed and started${NC}"
fi

# Step 2: Install TimescaleDB
echo -e "\n${YELLOW}Step 2: Installing TimescaleDB...${NC}"

# Check if PostgreSQL 15 is installed, if not, install it first
if [ "$PG_VERSION" != "15" ]; then
    echo -e "${YELLOW}⚠️  PostgreSQL ${PG_VERSION} detected, but TimescaleDB requires PostgreSQL 15${NC}"
    echo -e "${YELLOW}   Installing PostgreSQL 15 alongside existing version...${NC}"
    
    # Install PostgreSQL 15
    dnf install -y postgresql15-server postgresql15 postgresql15-contrib
    
    # Initialize if not already done
    if [ ! -d /var/lib/pgsql/15/data ]; then
        /usr/pgsql-15/bin/postgresql-15-setup initdb
    fi
    
    # Enable and start PostgreSQL 15
    systemctl enable postgresql-15
    systemctl start postgresql-15
    
    PG_VERSION="15"
    PG_MAJOR_VERSION="15"
    echo -e "${GREEN}✅ PostgreSQL 15 installed and started${NC}"
fi

if ! command -v timescaledb-tune &> /dev/null; then
    # Add TimescaleDB repository
    tee /etc/yum.repos.d/timescale_timescaledb.repo <<EOF
[timescale_timescaledb]
name=timescale_timescaledb
baseurl=https://packagecloud.io/timescale/timescaledb/el/${CENTOS_VERSION}/\$basearch
repo_gpgcheck=1
gpgcheck=0
enabled=1
gpgkey=https://packagecloud.io/timescale/timescaledb/gpgkey
sslverify=1
sslcacert=/etc/pki/tls/certs/ca-bundle.crt
metadata_expire=300
EOF
    
    # Install TimescaleDB for PostgreSQL 15
    echo -e "${BLUE}Installing TimescaleDB for PostgreSQL 15...${NC}"
    dnf install -y timescaledb-2-postgresql-15
    
    echo -e "${GREEN}✅ TimescaleDB installed${NC}"
else
    echo -e "${GREEN}✅ TimescaleDB already installed${NC}"
fi

# Step 3: Configure PostgreSQL
echo -e "\n${YELLOW}Step 3: Configuring PostgreSQL...${NC}"

# Find PostgreSQL 15 data directory
PG_DATA_DIR=/var/lib/pgsql/15/data
if [ ! -d "$PG_DATA_DIR" ]; then
    # Try alternative location
    PG_DATA_DIR=$(sudo -u postgres /usr/pgsql-15/bin/pg_config --sharedir 2>/dev/null)/../data || PG_DATA_DIR=/var/lib/pgsql/15/data
fi

# Tune TimescaleDB
echo -e "${YELLOW}Running timescaledb-tune...${NC}"
timescaledb-tune --quiet --yes

# Edit postgresql.conf to add TimescaleDB
PG_CONF="$PG_DATA_DIR/postgresql.conf"
if ! grep -q "timescaledb" "$PG_CONF"; then
    echo "shared_preload_libraries = 'timescaledb'" >> "$PG_CONF"
    echo -e "${GREEN}✅ Added TimescaleDB to shared_preload_libraries${NC}"
fi

# Configure PostgreSQL for better performance
if ! grep -q "# TIWater Configuration" "$PG_CONF"; then
    cat >> "$PG_CONF" <<EOF

# TIWater Configuration
max_connections = 200
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
EOF
    echo -e "${GREEN}✅ Added performance tuning to postgresql.conf${NC}"
fi

# Configure pg_hba.conf for remote connections (optional)
PG_HBA="$PG_DATA_DIR/pg_hba.conf"
if ! grep -q "# TIWater remote access" "$PG_HBA"; then
    cat >> "$PG_HBA" <<EOF

# TIWater remote access
# host    all             all             0.0.0.0/0               md5
EOF
    echo -e "${YELLOW}⚠️  Remote access commented out. Uncomment if needed.${NC}"
fi

# Restart PostgreSQL
systemctl restart postgresql-15
sleep 3

# Step 4: Create database and user
echo -e "\n${YELLOW}Step 4: Creating database and user...${NC}"

# Default credentials
DB_NAME=${DB_NAME:-TIWater_timeseries}
DB_USER=${DB_USER:-TIWater_user}
DB_PASSWORD=${DB_PASSWORD:-TIW4terMa1nS3rv3r}

# Prompt for database credentials (or use defaults)
read -p "Enter PostgreSQL database name [${DB_NAME}]: " INPUT_DB_NAME
DB_NAME=${INPUT_DB_NAME:-$DB_NAME}

read -p "Enter PostgreSQL username [${DB_USER}]: " INPUT_DB_USER
DB_USER=${INPUT_DB_USER:-$DB_USER}

read -sp "Enter PostgreSQL password [using default]: " INPUT_DB_PASSWORD
echo ""
if [ -n "$INPUT_DB_PASSWORD" ]; then
    DB_PASSWORD=$INPUT_DB_PASSWORD
fi

# Create database and user (using PostgreSQL 15)
/usr/pgsql-15/bin/psql -U postgres <<EOF
-- Create user
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';

-- Create database
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};

-- Connect to database and enable TimescaleDB
\c ${DB_NAME}
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};

\q
EOF

echo -e "${GREEN}✅ Database and user created${NC}"

# Step 5: Test connection
echo -e "\n${YELLOW}Step 5: Testing connection...${NC}"
# Use PostgreSQL 15 psql
/usr/pgsql-15/bin/psql -U postgres -d ${DB_NAME} -c "SELECT timescaledb_version();" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ TimescaleDB extension enabled successfully${NC}"
else
    echo -e "${YELLOW}⚠️  TimescaleDB extension test failed, but continuing...${NC}"
    echo -e "${YELLOW}   You can enable it manually after setup${NC}"
fi

# Step 6: Display connection information
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✅ PostgreSQL + TimescaleDB Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\n${YELLOW}Connection Details:${NC}"
echo -e "Host: localhost (or your server IP)"
echo -e "Port: 5432"
echo -e "Database: ${DB_NAME}"
echo -e "Username: ${DB_USER}"
echo -e "Password: [the password you entered]"
echo -e "\n${YELLOW}Add these to your .env file:${NC}"
echo -e "POSTGRES_HOST=localhost"
echo -e "POSTGRES_PORT=5432"
echo -e "POSTGRES_DB=${DB_NAME}"
echo -e "POSTGRES_USER=${DB_USER}"
echo -e "POSTGRES_PASSWORD=${DB_PASSWORD}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "1. Run the SQL migration: scripts/migrations/001_create_sensores_table.sql"
echo -e "2. Update your .env file with the connection details"
echo -e "3. Run: npm install (to install pg package)"
echo -e "4. Test connection with: npm run test:postgres"

echo -e "\n${GREEN}Setup complete! 🎉${NC}"


-- Migration: Create products table (replaces MongoDB Product)
-- Requires: clients (007)

CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(255) UNIQUE NOT NULL,
    active_time BIGINT,
    last_time_active BIGINT,
    product_type VARCHAR(50) DEFAULT 'Osmosis',
    biz_type INTEGER,
    category VARCHAR(255),
    create_time BIGINT,
    icon VARCHAR(255),
    ip VARCHAR(45),
    city VARCHAR(255),
    state VARCHAR(255),
    client_id BIGINT NOT NULL REFERENCES clients(id),
    drive VARCHAR(255),
    lat VARCHAR(50),
    local_key VARCHAR(255),
    lon VARCHAR(50),
    model VARCHAR(255),
    name VARCHAR(255),
    online BOOLEAN DEFAULT FALSE,
    owner_id VARCHAR(255),
    product_id VARCHAR(255),
    product_name VARCHAR(255),
    status JSONB DEFAULT '[]',
    sub BOOLEAN DEFAULT FALSE,
    time_zone VARCHAR(50),
    uid VARCHAR(255),
    update_time BIGINT,
    uuid VARCHAR(255),
    tuya_logs_routine_enabled BOOLEAN DEFAULT FALSE,
    createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_device_id ON products(device_id);
CREATE INDEX IF NOT EXISTS idx_products_client_id ON products(client_id);
CREATE INDEX IF NOT EXISTS idx_products_online ON products(online);

-- Migration: Create controllers table (replaces MongoDB Controller)
-- Requires: clients (007), products (021)

CREATE TABLE IF NOT EXISTS controllers (
    id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(255) UNIQUE NOT NULL,
    active_time BIGINT,
    last_time_active BIGINT,
    product_type VARCHAR(50),
    create_time BIGINT,
    kfactor_tds NUMERIC,
    kfactor_flujo NUMERIC,
    icon VARCHAR(255),
    ip VARCHAR(45) NOT NULL,
    city VARCHAR(255),
    state VARCHAR(255),
    client_id BIGINT NOT NULL REFERENCES clients(id),
    product_id BIGINT NOT NULL REFERENCES products(id),
    drive VARCHAR(255),
    lat VARCHAR(50),
    lon VARCHAR(50),
    model VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    online BOOLEAN DEFAULT FALSE,
    owner_id VARCHAR(255),
    product_device_id VARCHAR(255),
    product_name VARCHAR(255),
    sub BOOLEAN DEFAULT FALSE,
    time_zone VARCHAR(50) DEFAULT '-07:00',
    reset_pending BOOLEAN DEFAULT FALSE,
    update_controller_time INTEGER DEFAULT 10000,
    loop_time INTEGER DEFAULT 1000,
    flush_time INTEGER DEFAULT 20000,
    flush_pending BOOLEAN DEFAULT FALSE,
    tipo_sensor INTEGER DEFAULT 1,
    sensor_factor NUMERIC,
    createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_controllers_device_id ON controllers(device_id);
CREATE INDEX IF NOT EXISTS idx_controllers_client_id ON controllers(client_id);
CREATE INDEX IF NOT EXISTS idx_controllers_product_id ON controllers(product_id);

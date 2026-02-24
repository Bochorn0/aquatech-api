-- Migration: Create product_logs table (replaces MongoDB ProductLog)
-- Requires: products (021)

CREATE TABLE IF NOT EXISTS product_logs (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    product_device_id VARCHAR(255) NOT NULL,
    tds NUMERIC,
    production_volume NUMERIC,
    rejected_volume NUMERIC,
    temperature NUMERIC,
    flujo_produccion NUMERIC,
    flujo_rechazo NUMERIC,
    tiempo_inicio BIGINT,
    tiempo_fin BIGINT,
    source VARCHAR(50) DEFAULT 'esp32',
    date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_logs_product_id ON product_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_product_logs_product_device_id_date ON product_logs(product_device_id, date);
CREATE INDEX IF NOT EXISTS idx_product_logs_date ON product_logs(date DESC);

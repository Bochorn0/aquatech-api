-- Migration: Create client_metrics table (legacy one-per-client config, replaces MongoDB Metric)
-- Used by metric.controller and dashboard.controller

CREATE TABLE IF NOT EXISTS client_metrics (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES clients(id),
    product_type VARCHAR(100),
    tds_range NUMERIC NOT NULL DEFAULT 0,
    production_volume_range NUMERIC NOT NULL DEFAULT 0,
    temperature_range NUMERIC NOT NULL DEFAULT 0,
    rejected_volume_range NUMERIC NOT NULL DEFAULT 0,
    flow_rate_speed_range NUMERIC NOT NULL DEFAULT 0,
    filter_only_online BOOLEAN DEFAULT TRUE,
    active_time NUMERIC,
    metrics_description TEXT,
    createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_metrics_client_id ON client_metrics(client_id);
COMMENT ON TABLE client_metrics IS 'Legacy metric config per client (replaces MongoDB Metric)';

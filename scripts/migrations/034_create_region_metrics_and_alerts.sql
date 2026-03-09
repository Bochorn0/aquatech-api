-- Migration: Create region_metrics and region_metric_alerts tables
-- Metrics by region act as fallback when no punto-venta-specific metrics exist.
-- Usage: psql -U TIWater_user -d TIWater_timeseries -f scripts/migrations/034_create_region_metrics_and_alerts.sql

-- =============================================================================
-- 1. REGION_METRICS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS region_metrics (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    region_id BIGINT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    metric_name VARCHAR(255) DEFAULT NULL,
    metric_type VARCHAR(100) DEFAULT NULL,
    sensor_type VARCHAR(100) DEFAULT NULL,
    sensor_unit VARCHAR(50) DEFAULT NULL,
    rules JSONB DEFAULT NULL,
    conditions JSONB DEFAULT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    read_only BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_region_metrics_client_id ON region_metrics(client_id);
CREATE INDEX IF NOT EXISTS idx_region_metrics_region_id ON region_metrics(region_id);
CREATE INDEX IF NOT EXISTS idx_region_metrics_client_region ON region_metrics(client_id, region_id);
CREATE INDEX IF NOT EXISTS idx_region_metrics_sensor_type ON region_metrics(sensor_type);
CREATE INDEX IF NOT EXISTS idx_region_metrics_enabled ON region_metrics(enabled) WHERE enabled = TRUE;

COMMENT ON TABLE region_metrics IS 'Metric configurations by region; used as fallback when no punto-venta metrics exist';
COMMENT ON COLUMN region_metrics.client_id IS 'Client (cliente) this region metric belongs to';
COMMENT ON COLUMN region_metrics.region_id IS 'Region this metric applies to';

CREATE OR REPLACE FUNCTION update_region_metrics_updatedat_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedat = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_region_metrics_updatedat ON region_metrics;
CREATE TRIGGER update_region_metrics_updatedat
    BEFORE UPDATE ON region_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_region_metrics_updatedat_column();

-- =============================================================================
-- 2. REGION_METRIC_ALERTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS region_metric_alerts (
    id BIGSERIAL PRIMARY KEY,
    region_metric_id BIGINT NOT NULL REFERENCES region_metrics(id) ON DELETE CASCADE,
    usuario VARCHAR(255) NOT NULL,
    correo VARCHAR(255) NOT NULL,
    celular VARCHAR(50) DEFAULT NULL,
    celular_alert BOOLEAN DEFAULT FALSE,
    dashboard_alert BOOLEAN DEFAULT FALSE,
    email_alert BOOLEAN DEFAULT FALSE,
    preventivo BOOLEAN DEFAULT FALSE,
    correctivo BOOLEAN DEFAULT FALSE,
    email_cooldown_minutes INTEGER DEFAULT 10,
    email_max_per_day INTEGER DEFAULT 5,
    createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_region_metric_alerts_region_metric_id ON region_metric_alerts(region_metric_id);
CREATE INDEX IF NOT EXISTS idx_region_metric_alerts_correo ON region_metric_alerts(correo);

COMMENT ON TABLE region_metric_alerts IS 'Alert/notification configurations for region metrics';

CREATE OR REPLACE FUNCTION update_region_metric_alerts_updatedat_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedat = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_region_metric_alerts_updatedat ON region_metric_alerts;
CREATE TRIGGER update_region_metric_alerts_updatedat
    BEFORE UPDATE ON region_metric_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_region_metric_alerts_updatedat_column();

DO $$
BEGIN
    RAISE NOTICE '✅ region_metrics and region_metric_alerts tables created successfully';
END $$;

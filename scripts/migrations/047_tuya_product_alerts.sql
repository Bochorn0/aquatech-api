-- Tuya product alert configs + contacts (API v1 / Tuya only — separate from MQTT metric_alerts v2)
-- Requires: clients (007), products (021)

CREATE TABLE IF NOT EXISTS tuya_product_alert_configs (
    id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(255) NOT NULL,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    sensor_code VARCHAR(100) NOT NULL,
    display_name VARCHAR(255),
    rules JSONB NOT NULL DEFAULT '[]',
    enabled BOOLEAN DEFAULT TRUE,
    createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tuya_alert_config_device_sensor UNIQUE (device_id, sensor_code)
);

CREATE INDEX IF NOT EXISTS idx_tuya_product_alert_configs_device ON tuya_product_alert_configs(device_id);
CREATE INDEX IF NOT EXISTS idx_tuya_product_alert_configs_client ON tuya_product_alert_configs(client_id);
CREATE INDEX IF NOT EXISTS idx_tuya_product_alert_configs_enabled ON tuya_product_alert_configs(enabled) WHERE enabled = TRUE;

COMMENT ON TABLE tuya_product_alert_configs IS 'Per Tuya device + status code: min/max rules (JSONB same shape as metrics.rules)';
COMMENT ON COLUMN tuya_product_alert_configs.device_id IS 'Live Tuya device_id (same as products.device_id for the row users configure)';

CREATE TABLE IF NOT EXISTS tuya_product_alert_contacts (
    id BIGSERIAL PRIMARY KEY,
    config_id BIGINT NOT NULL REFERENCES tuya_product_alert_configs(id) ON DELETE CASCADE,
    usuario VARCHAR(255) NOT NULL,
    correo VARCHAR(255) NOT NULL,
    celular VARCHAR(50),
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

CREATE INDEX IF NOT EXISTS idx_tuya_product_alert_contacts_config ON tuya_product_alert_contacts(config_id);
CREATE INDEX IF NOT EXISTS idx_tuya_product_alert_contacts_correo ON tuya_product_alert_contacts(correo);

CREATE TABLE IF NOT EXISTS tuya_product_alert_email_log (
    id BIGSERIAL PRIMARY KEY,
    contact_id BIGINT NOT NULL REFERENCES tuya_product_alert_contacts(id) ON DELETE CASCADE,
    config_id BIGINT NOT NULL REFERENCES tuya_product_alert_configs(id) ON DELETE CASCADE,
    correo VARCHAR(255) NOT NULL,
    alert_level VARCHAR(50) NOT NULL,
    sensor_code VARCHAR(100),
    sensor_value NUMERIC(14, 4),
    sent_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tuya_product_alert_email_log_throttle
  ON tuya_product_alert_email_log(contact_id, alert_level, sent_at DESC);

DO $$
BEGIN
    RAISE NOTICE '047_tuya_product_alerts: tables created';
END $$;

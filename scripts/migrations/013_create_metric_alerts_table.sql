-- Migration: Create metric_alerts table
-- This table stores alert/notification configurations for metrics
-- Run this migration after 011_alter_metrics_table_for_configuration.sql
-- Usage: psql -U TIWater_user -d TIWater_timeseries -f scripts/migrations/013_create_metric_alerts_table.sql

CREATE TABLE IF NOT EXISTS metric_alerts (
    id BIGSERIAL PRIMARY KEY,
    
    -- Metric reference (foreign key to metrics table)
    metric_id BIGINT NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
    
    -- User information
    usuario VARCHAR(255) NOT NULL,
    correo VARCHAR(255) NOT NULL,
    celular VARCHAR(50) DEFAULT NULL,
    
    -- Alert preferences
    celular_alert BOOLEAN DEFAULT FALSE,
    dashboard_alert BOOLEAN DEFAULT FALSE,
    email_alert BOOLEAN DEFAULT FALSE,
    
    -- Alert type preferences
    preventivo BOOLEAN DEFAULT FALSE,
    correctivo BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    createdat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_metric_alerts_metric_id ON metric_alerts(metric_id);
CREATE INDEX IF NOT EXISTS idx_metric_alerts_correo ON metric_alerts(correo);
CREATE INDEX IF NOT EXISTS idx_metric_alerts_celular_alert ON metric_alerts(celular_alert) WHERE celular_alert = TRUE;
CREATE INDEX IF NOT EXISTS idx_metric_alerts_email_alert ON metric_alerts(email_alert) WHERE email_alert = TRUE;
CREATE INDEX IF NOT EXISTS idx_metric_alerts_preventivo ON metric_alerts(preventivo) WHERE preventivo = TRUE;
CREATE INDEX IF NOT EXISTS idx_metric_alerts_correctivo ON metric_alerts(correctivo) WHERE correctivo = TRUE;

-- Create function to automatically update updatedat timestamp
CREATE OR REPLACE FUNCTION update_metric_alerts_updatedat_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedat = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updatedat
DROP TRIGGER IF EXISTS update_metric_alerts_updatedat ON metric_alerts;
CREATE TRIGGER update_metric_alerts_updatedat
    BEFORE UPDATE ON metric_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_metric_alerts_updatedat_column();

-- Add comments for documentation
COMMENT ON TABLE metric_alerts IS 'Alert/notification configurations for metrics';
COMMENT ON COLUMN metric_alerts.metric_id IS 'Foreign key to metrics table';
COMMENT ON COLUMN metric_alerts.usuario IS 'User name';
COMMENT ON COLUMN metric_alerts.correo IS 'User email address';
COMMENT ON COLUMN metric_alerts.celular IS 'User phone number (optional, only needed if celular_alert is true)';
COMMENT ON COLUMN metric_alerts.celular_alert IS 'Enable SMS/cellular alerts for this user';
COMMENT ON COLUMN metric_alerts.dashboard_alert IS 'Enable dashboard notifications for this user';
COMMENT ON COLUMN metric_alerts.email_alert IS 'Enable email alerts for this user';
COMMENT ON COLUMN metric_alerts.preventivo IS 'Receive alerts for preventive (yellow/warning) conditions';
COMMENT ON COLUMN metric_alerts.correctivo IS 'Receive alerts for corrective (red/critical) conditions';

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ metric_alerts table created successfully';
    RAISE NOTICE '✅ Indexes created for optimized queries';
    RAISE NOTICE '✅ Auto-update trigger for updated_at created';
END $$;

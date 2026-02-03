-- Migration: Create metric_email_log table and add email config to metric_alerts
-- Run after 013_create_metric_alerts_table.sql
-- Usage: psql -U TIWater_user -d TIWater_timeseries -f scripts/migrations/015_create_metric_email_log_and_alter_alerts.sql

-- ============================================
-- 1. Add email throttling config to metric_alerts
-- ============================================
ALTER TABLE metric_alerts
  ADD COLUMN IF NOT EXISTS email_cooldown_minutes INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS email_max_per_day INTEGER DEFAULT 5;

COMMENT ON COLUMN metric_alerts.email_cooldown_minutes IS 'Minimum minutes between email alerts (prevents spam)';
COMMENT ON COLUMN metric_alerts.email_max_per_day IS 'Maximum email alerts per day per alert+level';

-- ============================================
-- 2. Create metric_email_log table
-- ============================================
CREATE TABLE IF NOT EXISTS metric_email_log (
    id BIGSERIAL PRIMARY KEY,
    
    -- Alert and metric reference
    metric_alert_id BIGINT NOT NULL REFERENCES metric_alerts(id) ON DELETE CASCADE,
    metric_id BIGINT NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
    
    -- Recipient and alert details
    correo VARCHAR(255) NOT NULL,
    alert_level VARCHAR(50) NOT NULL,  -- 'preventivo' or 'critico'
    metric_name VARCHAR(255),
    codigo_tienda VARCHAR(255),
    sensor_value DECIMAL(12, 4),
    
    -- Timestamp (used for throttling: cooldown and daily limit)
    sent_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for throttling queries
CREATE INDEX IF NOT EXISTS idx_metric_email_log_alert_level_sent 
  ON metric_email_log(metric_alert_id, alert_level, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_metric_email_log_sent_at 
  ON metric_email_log(sent_at);

COMMENT ON TABLE metric_email_log IS 'Log of metric alert emails sent - used for throttling and audit';
COMMENT ON COLUMN metric_email_log.alert_level IS 'preventivo (warning) or critico (critical)';
COMMENT ON COLUMN metric_email_log.sent_at IS 'When email was sent - used for cooldown and daily limit checks';

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ metric_email_log table created';
    RAISE NOTICE '✅ metric_alerts updated with email_cooldown_minutes, email_max_per_day';
END $$;

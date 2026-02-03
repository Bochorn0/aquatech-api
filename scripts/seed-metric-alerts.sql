-- Seed metric alerts for testing
-- This will create alert configurations for existing metrics
-- Run this with: psql -U TIWater_user -d TIWater_timeseries -f scripts/seed-metric-alerts.sql

-- First, let's see what metrics exist
DO $$
DECLARE
    metric_record RECORD;
BEGIN
    RAISE NOTICE '📊 Current metrics in database:';
    FOR metric_record IN 
        SELECT id, metric_name, sensor_type, "clientId", "puntoVentaId"
        FROM metrics 
        WHERE enabled = TRUE
        ORDER BY id
    LOOP
        RAISE NOTICE '  Metric ID: %, Name: %, Type: %, Client: %, PuntoVenta: %', 
            metric_record.id, 
            metric_record.metric_name, 
            metric_record.sensor_type,
            metric_record."clientId",
            metric_record."puntoVentaId";
    END LOOP;
END $$;

-- Insert alert configuration for luis.cordova@lcc.com.mx
-- This will create alerts for ALL enabled metrics for the test user
INSERT INTO metric_alerts (
    metric_id,
    usuario,
    correo,
    celular,
    celular_alert,
    dashboard_alert,
    email_alert,
    preventivo,
    correctivo
)
SELECT 
    m.id,
    'Luis Fernando Cordova',
    'luis.cordova@lcc.com.mx',
    NULL,
    FALSE,  -- celular_alert (SMS disabled for now)
    TRUE,   -- dashboard_alert (ENABLED)
    FALSE,  -- email_alert (disabled for now)
    TRUE,   -- preventivo (receive warning alerts)
    TRUE    -- correctivo (receive critical alerts)
FROM metrics m
WHERE m.enabled = TRUE
AND NOT EXISTS (
    -- Don't create duplicates
    SELECT 1 FROM metric_alerts ma 
    WHERE ma.metric_id = m.id 
    AND ma.correo = 'luis.cordova@lcc.com.mx'
)
ON CONFLICT DO NOTHING;

-- Show what was created
DO $$
DECLARE
    alert_record RECORD;
    alert_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO alert_count FROM metric_alerts WHERE correo = 'luis.cordova@lcc.com.mx';
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ Alert configurations created/verified for luis.cordova@lcc.com.mx';
    RAISE NOTICE '📧 Total alerts configured: %', alert_count;
    RAISE NOTICE '';
    RAISE NOTICE '📋 Alert details:';
    
    FOR alert_record IN 
        SELECT 
            ma.id as alert_id,
            ma.metric_id,
            m.metric_name,
            m.sensor_type,
            ma.dashboard_alert,
            ma.email_alert,
            ma.preventivo,
            ma.correctivo
        FROM metric_alerts ma
        JOIN metrics m ON m.id = ma.metric_id
        WHERE ma.correo = 'luis.cordova@lcc.com.mx'
        ORDER BY ma.metric_id
    LOOP
        RAISE NOTICE '  Alert ID: %, Metric: % (%), Dashboard: %, Email: %, Preventivo: %, Correctivo: %',
            alert_record.alert_id,
            alert_record.metric_name,
            alert_record.sensor_type,
            alert_record.dashboard_alert,
            alert_record.email_alert,
            alert_record.preventivo,
            alert_record.correctivo;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Next step: Trigger a sensor reading to test notifications!';
    RAISE NOTICE '   Example: Send sensor data with value that triggers preventivo or correctivo thresholds';
END $$;

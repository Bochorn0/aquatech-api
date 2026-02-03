-- Diagnostic script to check metric alerts configuration
-- Run with: psql -U TIWater_user -d TIWater_timeseries -f scripts/check-metric-alerts.sql

\echo '=== METRIC ALERTS DIAGNOSTIC ==='
\echo ''

-- Check metrics table
\echo '📊 METRICS TABLE:'
SELECT 
    id,
    metric_name,
    sensor_type,
    "clientId",
    "puntoVentaId",
    enabled,
    preventivo_min,
    preventivo_max,
    correctivo_min,
    correctivo_max
FROM metrics
WHERE enabled = TRUE
ORDER BY id;

\echo ''
\echo '🔔 METRIC ALERTS TABLE:'
SELECT 
    ma.id as alert_id,
    ma.metric_id,
    m.metric_name,
    m.sensor_type,
    ma.usuario,
    ma.correo,
    ma.dashboard_alert,
    ma.email_alert,
    ma.preventivo,
    ma.correctivo
FROM metric_alerts ma
JOIN metrics m ON m.id = ma.metric_id
ORDER BY ma.metric_id;

\echo ''
\echo '📈 SUMMARY:'
SELECT 
    COUNT(DISTINCT m.id) as total_metrics,
    COUNT(DISTINCT ma.id) as total_alerts,
    COUNT(DISTINCT ma.correo) as unique_users
FROM metrics m
LEFT JOIN metric_alerts ma ON ma.metric_id = m.id
WHERE m.enabled = TRUE;

\echo ''
\echo '⚠️  METRICS WITHOUT ALERTS:'
SELECT 
    m.id,
    m.metric_name,
    m.sensor_type,
    m."clientId",
    m."puntoVentaId"
FROM metrics m
LEFT JOIN metric_alerts ma ON ma.metric_id = m.id
WHERE m.enabled = TRUE
AND ma.id IS NULL
ORDER BY m.id;

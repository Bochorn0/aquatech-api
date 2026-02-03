/**
 * Check and Seed Metric Alerts
 * This script checks the PostgreSQL database for metrics and metric_alerts
 * and seeds alerts for testing if needed
 * 
 * Run: node scripts/check-and-seed-metric-alerts.js
 */

import pg from 'pg';
const { Pool } = pg;

// PostgreSQL connection
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'TIWater_timeseries',
  user: process.env.POSTGRES_USER || 'TIWater_user',
  password: process.env.POSTGRES_PASSWORD,
});

async function checkMetrics() {
  console.log('\n📊 === CHECKING METRICS TABLE (PostgreSQL) ===\n');
  
  const result = await pool.query(`
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
    ORDER BY id
  `);

  console.log(`Found ${result.rows.length} enabled metrics:\n`);
  
  result.rows.forEach(metric => {
    console.log(`  ✓ Metric ID: ${metric.id}`);
    console.log(`    Name: ${metric.metric_name}`);
    console.log(`    Sensor Type: ${metric.sensor_type}`);
    console.log(`    Client ID: ${metric.clientId}`);
    console.log(`    Punto Venta ID: ${metric.puntoVentaId}`);
    console.log(`    Preventivo: ${metric.preventivo_min} - ${metric.preventivo_max}`);
    console.log(`    Correctivo: ${metric.correctivo_min} - ${metric.correctivo_max}`);
    console.log('');
  });

  return result.rows;
}

async function checkMetricAlerts() {
  console.log('\n🔔 === CHECKING METRIC_ALERTS TABLE (PostgreSQL) ===\n');
  
  const result = await pool.query(`
    SELECT 
      ma.id as alert_id,
      ma.metric_id,
      m.metric_name,
      m.sensor_type,
      ma.usuario,
      ma.correo,
      ma.celular,
      ma.celular_alert,
      ma.dashboard_alert,
      ma.email_alert,
      ma.preventivo,
      ma.correctivo
    FROM metric_alerts ma
    JOIN metrics m ON m.id = ma.metric_id
    ORDER BY ma.metric_id
  `);

  console.log(`Found ${result.rows.length} metric alerts configured:\n`);
  
  if (result.rows.length === 0) {
    console.log('  ⚠️  NO ALERTS CONFIGURED! This is why notifications are not being created.\n');
  } else {
    result.rows.forEach(alert => {
      console.log(`  ✓ Alert ID: ${alert.alert_id} for Metric: ${alert.metric_name} (${alert.sensor_type})`);
      console.log(`    User: ${alert.usuario} (${alert.correo})`);
      console.log(`    Dashboard: ${alert.dashboard_alert}, Email: ${alert.email_alert}, SMS: ${alert.celular_alert}`);
      console.log(`    Preventivo: ${alert.preventivo}, Correctivo: ${alert.correctivo}`);
      console.log('');
    });
  }

  return result.rows;
}

async function checkMetricsWithoutAlerts() {
  console.log('\n⚠️  === METRICS WITHOUT ALERTS ===\n');
  
  const result = await pool.query(`
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
    ORDER BY m.id
  `);

  if (result.rows.length === 0) {
    console.log('  ✓ All metrics have alerts configured!\n');
  } else {
    console.log(`  Found ${result.rows.length} metrics WITHOUT alerts:\n`);
    result.rows.forEach(metric => {
      console.log(`  ⚠️  Metric ID: ${metric.id} - ${metric.metric_name} (${metric.sensor_type})`);
    });
    console.log('');
  }

  return result.rows;
}

async function seedMetricAlerts(userEmail = 'luis.cordova@lcc.com.mx', userName = 'Luis Fernando Cordova') {
  console.log(`\n🌱 === SEEDING METRIC ALERTS FOR ${userEmail} ===\n`);
  
  const result = await pool.query(`
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
      $1,
      $2,
      NULL,
      FALSE,  -- celular_alert (SMS disabled)
      TRUE,   -- dashboard_alert (ENABLED)
      FALSE,  -- email_alert (disabled for now)
      TRUE,   -- preventivo (receive warning alerts)
      TRUE    -- correctivo (receive critical alerts)
    FROM metrics m
    WHERE m.enabled = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM metric_alerts ma 
      WHERE ma.metric_id = m.id 
      AND ma.correo = $2
    )
    RETURNING *
  `, [userName, userEmail]);

  if (result.rows.length === 0) {
    console.log('  ℹ️  No new alerts created (already exist)\n');
  } else {
    console.log(`  ✅ Created ${result.rows.length} new alert configurations:\n`);
    result.rows.forEach(alert => {
      console.log(`  ✓ Alert ID: ${alert.id} for Metric ID: ${alert.metric_id}`);
    });
    console.log('');
  }

  return result.rows;
}

async function main() {
  try {
    console.log('\n🚀 Starting Metric Alerts Diagnostic and Seed Script...\n');
    console.log('📍 Database:', process.env.POSTGRES_DB || 'TIWater_timeseries');
    console.log('📍 Host:', process.env.POSTGRES_HOST || 'localhost');
    
    // Step 1: Check metrics
    const metrics = await checkMetrics();
    
    if (metrics.length === 0) {
      console.log('❌ No metrics found in database. Please create metrics first.');
      process.exit(1);
    }

    // Step 2: Check existing alerts
    const alerts = await checkMetricAlerts();

    // Step 3: Check metrics without alerts
    const metricsWithoutAlerts = await checkMetricsWithoutAlerts();

    // Step 4: Seed alerts if needed
    if (metricsWithoutAlerts.length > 0) {
      console.log('🔧 Would you like to seed alerts for these metrics?');
      console.log('   Running seed now...\n');
      
      await seedMetricAlerts();
      
      // Re-check after seeding
      console.log('\n📊 === FINAL STATE ===\n');
      await checkMetricAlerts();
      await checkMetricsWithoutAlerts();
    }

    console.log('\n✅ === DIAGNOSTIC COMPLETE ===\n');
    console.log('📝 Summary:');
    console.log(`   - Total Metrics: ${metrics.length}`);
    console.log(`   - Total Alerts: ${alerts.length + metricsWithoutAlerts.length}`);
    console.log(`   - Metrics Without Alerts: ${metricsWithoutAlerts.length}`);
    
    if (metricsWithoutAlerts.length === 0 && alerts.length > 0) {
      console.log('\n🎯 Next Steps:');
      console.log('   1. Trigger a sensor reading that exceeds thresholds');
      console.log('   2. Check logs for: [MetricNotification] ✅ Dashboard notification created');
      console.log('   3. Check MongoDB notifications collection for new records');
      console.log('   4. Refresh frontend to see notifications\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
main();

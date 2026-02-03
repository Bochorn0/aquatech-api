#!/usr/bin/env node
// Test script to verify notification system is working
// Run with: node scripts/test-notification-system.js

import mongoose from 'mongoose';
import { query } from '../src/config/postgres.config.js';
import User from '../src/models/user.model.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/aquatech';
const TEST_CODIGO_TIENDA = 'CODIGO_TIENDA_TEST_TIWATER';
const TEST_CLIENT_ID = '2';

async function testNotificationSystem() {
  console.log('\n🔍 Testing Notification System Configuration\n');
  console.log('='.repeat(60));

  try {
    // 1. Connect to MongoDB
    console.log('\n1️⃣  Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // 2. Check puntoVenta has clientId
    console.log('\n2️⃣  Checking puntoVenta configuration...');
    const pvResult = await query(
      `SELECT id, code, codigo_tienda, clientid, name 
       FROM puntoventa 
       WHERE codigo_tienda = $1`,
      [TEST_CODIGO_TIENDA]
    );

    if (pvResult.rows.length === 0) {
      console.log('❌ PuntoVenta not found for codigo_tienda:', TEST_CODIGO_TIENDA);
      console.log('   Create it first or update TEST_CODIGO_TIENDA in this script');
    } else {
      const pv = pvResult.rows[0];
      console.log('✅ PuntoVenta found:');
      console.log(`   ID: ${pv.id}`);
      console.log(`   Code: ${pv.code}`);
      console.log(`   Name: ${pv.name}`);
      console.log(`   ClientId: ${pv.clientid || '⚠️  NOT SET'}`);
      
      if (!pv.clientid) {
        console.log('\n   ⚠️  ISSUE: PuntoVenta does not have clientId set!');
        console.log('   Fix with:');
        console.log(`   UPDATE puntoventa SET clientid = ${TEST_CLIENT_ID} WHERE id = ${pv.id};`);
      }
    }

    // 3. Check if users exist with postgresClientId
    console.log('\n3️⃣  Checking users with postgresClientId...');
    const users = await User.find({
      postgresClientId: TEST_CLIENT_ID,
      status: 'active',
      verified: true
    }).select('email nombre postgresClientId status verified');

    if (users.length === 0) {
      console.log(`❌ No active users found with postgresClientId: ${TEST_CLIENT_ID}`);
      console.log('\n   Checking all users with this postgresClientId (any status)...');
      
      const allUsers = await User.find({
        postgresClientId: TEST_CLIENT_ID
      }).select('email nombre postgresClientId status verified');

      if (allUsers.length === 0) {
        console.log(`   ❌ No users at all with postgresClientId: ${TEST_CLIENT_ID}`);
        console.log('\n   Fix options:');
        console.log('   A) Create a new user with postgresClientId = "2"');
        console.log('   B) Update existing users:');
        console.log(`      db.users.updateMany({ cliente: ObjectId("MONGO_CLIENT_ID") }, { $set: { postgresClientId: "${TEST_CLIENT_ID}" } })`);
      } else {
        console.log(`   ⚠️  Found ${allUsers.length} users but they are not active/verified:`);
        allUsers.forEach(u => {
          console.log(`   - ${u.email} (status: ${u.status}, verified: ${u.verified})`);
        });
      }
    } else {
      console.log(`✅ Found ${users.length} active users with postgresClientId: ${TEST_CLIENT_ID}`);
      users.forEach(u => {
        console.log(`   - ${u.email} (${u.nombre})`);
      });
    }

    // 4. Check metrics and alerts
    console.log('\n4️⃣  Checking metrics and alerts...');
    const metricsResult = await query(
      `SELECT m.id, m.metric_name, m.metric_type, m.enabled, m.cliente,
              COUNT(ma.id) as alert_count
       FROM metrics m
       LEFT JOIN metric_alerts ma ON m.id = ma.metric_id
       WHERE m.cliente = $1 AND m.enabled = true
       GROUP BY m.id
       ORDER BY m.id`,
      [TEST_CLIENT_ID]
    );

    if (metricsResult.rows.length === 0) {
      console.log(`❌ No enabled metrics found for client: ${TEST_CLIENT_ID}`);
    } else {
      console.log(`✅ Found ${metricsResult.rows.length} enabled metrics:`);
      metricsResult.rows.forEach(m => {
        console.log(`   - Metric ${m.id}: ${m.metric_name} (${m.metric_type}) - ${m.alert_count} alerts`);
      });

      // Check alerts with dashboard_alert enabled
      const alertsResult = await query(
        `SELECT ma.id, ma.metric_id, ma.dashboard_alert, ma.email_alert, 
                ma.correo, ma.usuario, m.metric_name
         FROM metric_alerts ma
         JOIN metrics m ON ma.metric_id = m.id
         WHERE m.cliente = $1 AND ma.dashboard_alert = true`,
        [TEST_CLIENT_ID]
      );

      if (alertsResult.rows.length === 0) {
        console.log('   ⚠️  No alerts with dashboard_alert enabled');
      } else {
        console.log(`\n   Found ${alertsResult.rows.length} alerts with dashboard notifications enabled:`);
        alertsResult.rows.forEach(a => {
          console.log(`   - Alert ${a.id} for ${a.metric_name}:`);
          console.log(`     Email: ${a.correo || 'not set'}`);
          console.log(`     Usuario: ${a.usuario || 'not set'}`);
        });
      }
    }

    // 5. Check recent notifications
    console.log('\n5️⃣  Checking recent notifications...');
    const Notification = mongoose.model('Notification');
    const recentNotifications = await Notification.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', 'email nombre');

    if (recentNotifications.length === 0) {
      console.log('⚠️  No notifications found in database');
    } else {
      console.log(`✅ Found ${recentNotifications.length} recent notifications:`);
      recentNotifications.forEach(n => {
        console.log(`   - ${n.createdAt.toISOString()}: ${n.title}`);
        console.log(`     User: ${n.user?.email || 'unknown'}`);
        console.log(`     Type: ${n.type}, Unread: ${n.isUnRead}`);
      });
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 SUMMARY\n');
    
    const pvHasClient = pvResult.rows.length > 0 && pvResult.rows[0].clientid;
    const hasUsers = users.length > 0;
    const hasMetrics = metricsResult.rows.length > 0;
    
    if (pvHasClient && hasUsers && hasMetrics) {
      console.log('✅ System is properly configured!');
      console.log('\nNext steps:');
      console.log('1. Restart the API service to load updated code');
      console.log('2. Trigger a sensor alert (simulate or real MQTT)');
      console.log('3. Check logs for notification creation');
      console.log('4. Verify notification appears in frontend');
    } else {
      console.log('⚠️  Configuration issues found:');
      if (!pvHasClient) console.log('   - PuntoVenta missing clientId');
      if (!hasUsers) console.log('   - No active users with postgresClientId');
      if (!hasMetrics) console.log('   - No enabled metrics configured');
      console.log('\nFix the issues above and run this script again.');
    }

    console.log('\n');

  } catch (error) {
    console.error('\n❌ Error running tests:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

// Run tests
testNotificationSystem();

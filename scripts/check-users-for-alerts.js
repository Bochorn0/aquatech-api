#!/usr/bin/env node
// Check which users exist for metric alerts
// Run with: node scripts/check-users-for-alerts.js

import mongoose from 'mongoose';
import { query } from '../src/config/postgres.config.js';
import User from '../src/models/user.model.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/aquatech';

async function checkUsersForAlerts() {
  console.log('\n🔍 Checking Users for Metric Alerts\n');
  console.log('='.repeat(60));

  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all metric alerts with emails
    console.log('1️⃣  Fetching metric alerts from PostgreSQL...');
    const alertsResult = await query(`
      SELECT ma.id, ma.metric_id, ma.correo, ma.usuario, 
             ma.dashboard_alert, m.metric_name, m.cliente
      FROM metric_alerts ma
      JOIN metrics m ON ma.metric_id = m.id
      WHERE ma.dashboard_alert = true
      ORDER BY m.cliente, m.metric_name
    `);

    console.log(`   Found ${alertsResult.rows.length} alerts with dashboard notifications enabled\n`);

    if (alertsResult.rows.length === 0) {
      console.log('⚠️  No metric alerts found with dashboard_alert = true');
      console.log('   Enable dashboard alerts in your metrics configuration\n');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Check each alert's email
    console.log('2️⃣  Checking if users exist for each alert:\n');
    
    const results = [];
    for (const alert of alertsResult.rows) {
      const email = alert.correo;
      const metricName = alert.metric_name;
      const clientId = alert.cliente;

      if (!email) {
        results.push({
          metric: metricName,
          clientId,
          email: 'NOT SET',
          userExists: false,
          status: '❌ NO EMAIL'
        });
        continue;
      }

      // Check if user exists
      const user = await User.findOne({ email: email });
      
      results.push({
        metric: metricName,
        clientId,
        email: email,
        userExists: !!user,
        status: user ? `✅ ${user.status}` : '❌ NOT FOUND',
        userName: user ? user.nombre : null
      });
    }

    // Display results
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│ Metric Alert → User Status                             │');
    console.log('├─────────────────────────────────────────────────────────┤');
    
    results.forEach(r => {
      const metric = r.metric.padEnd(25);
      const email = r.email.padEnd(30);
      console.log(`│ ${metric} │`);
      console.log(`│   Email: ${email}        │`);
      console.log(`│   Status: ${r.status.padEnd(20)} Client: ${r.clientId}       │`);
      if (r.userName) {
        console.log(`│   User: ${r.userName.padEnd(30)}      │`);
      }
      console.log('├─────────────────────────────────────────────────────────┤');
    });
    console.log('└─────────────────────────────────────────────────────────┘\n');

    // Summary
    const usersFound = results.filter(r => r.userExists).length;
    const usersNotFound = results.filter(r => !r.userExists).length;

    console.log('📊 SUMMARY\n');
    console.log(`   Total alerts: ${results.length}`);
    console.log(`   ✅ Users found: ${usersFound}`);
    console.log(`   ❌ Users NOT found: ${usersNotFound}\n`);

    if (usersNotFound > 0) {
      console.log('⚠️  ACTION REQUIRED:\n');
      console.log('   Some alerts have emails that don\'t match any users.');
      console.log('   You need to either:\n');
      console.log('   A) Create users with these emails:');
      results.filter(r => !r.userExists && r.email !== 'NOT SET').forEach(r => {
        console.log(`      - ${r.email}`);
      });
      console.log('\n   B) Update the metric alerts to use existing user emails\n');
      
      // Show existing users
      console.log('   Existing users in database:');
      const allUsers = await User.find({}).select('email nombre status').limit(10);
      allUsers.forEach(u => {
        console.log(`      - ${u.email} (${u.nombre}, ${u.status})`);
      });
      console.log('');
    } else {
      console.log('✅ All metric alerts have valid user emails!\n');
      console.log('   Notifications should be created successfully.\n');
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

// Run check
checkUsersForAlerts();

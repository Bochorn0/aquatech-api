// scripts/test-postgres-connection.js
// Test script to verify PostgreSQL connection and TimescaleDB setup

import dotenv from 'dotenv';
dotenv.config();

import pool from '../src/config/postgres.config.js';

async function testConnection() {
  console.log('🧪 Testing PostgreSQL connection...\n');

  try {
    // Test 1: Basic connection
    console.log('Test 1: Basic connection...');
    const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Connected successfully');
    console.log('   Current time:', result.rows[0].current_time);
    console.log('   PostgreSQL version:', result.rows[0].pg_version.split(',')[0]);
    console.log('');

    // Test 2: TimescaleDB extension
    console.log('Test 2: TimescaleDB extension...');
    const timescaleResult = await pool.query('SELECT timescaledb_version() as version');
    console.log('✅ TimescaleDB is enabled');
    console.log('   TimescaleDB version:', timescaleResult.rows[0].version);
    console.log('');

    // Test 3: Check if sensores table exists
    console.log('Test 3: Checking sensores table...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sensores'
      ) as exists
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ sensores table exists');
      
      // Check if it's a hypertable
      const hypertableCheck = await pool.query(`
        SELECT * FROM timescaledb_information.hypertables 
        WHERE hypertable_name = 'sensores'
      `);
      
      if (hypertableCheck.rows.length > 0) {
        console.log('✅ sensores table is a TimescaleDB hypertable');
        console.log('   Chunk interval:', hypertableCheck.rows[0].chunk_interval);
      } else {
        console.log('⚠️  sensores table exists but is not a hypertable');
        console.log('   Run the migration to convert it to a hypertable');
      }
      
      // Count records
      const countResult = await pool.query('SELECT COUNT(*) as count FROM sensores');
      console.log('   Total records:', countResult.rows[0].count);
    } else {
      console.log('⚠️  sensores table does not exist');
      console.log('   Run the migration: npm run migrate');
    }
    console.log('');

    // Test 4: Test insert (if table exists)
    if (tableCheck.rows[0].exists) {
      console.log('Test 4: Testing insert...');
      const insertResult = await pool.query(`
        INSERT INTO sensores (name, type, value, timestamp)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, type, value, timestamp
      `, ['test_sensor', 'test', 123.45, new Date()]);
      
      console.log('✅ Insert test successful');
      console.log('   Inserted record:', insertResult.rows[0]);
      
      // Clean up test record
      await pool.query('DELETE FROM sensores WHERE id = $1', [insertResult.rows[0].id]);
      console.log('   Test record cleaned up');
      console.log('');
    }

    // Test 5: Connection pool info
    console.log('Test 5: Connection pool status...');
    console.log('   Total connections:', pool.totalCount);
    console.log('   Idle connections:', pool.idleCount);
    console.log('   Waiting clients:', pool.waitingCount);
    console.log('');

    console.log('✅ All tests passed!');
    console.log('\n🎉 PostgreSQL + TimescaleDB is ready to use!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('   Error details:', error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

testConnection();


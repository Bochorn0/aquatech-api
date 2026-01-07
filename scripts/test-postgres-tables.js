// scripts/test-postgres-tables.js
// Script to list all tables in PostgreSQL database

import { query } from '../src/config/postgres.config.js';

async function listTables() {
  try {
    console.log('🔍 Checking PostgreSQL tables...\n');

    // Query to list all tables in the public schema
    const result = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    if (result.rows && result.rows.length > 0) {
      console.log('✅ Tables found in PostgreSQL:\n');
      result.rows.forEach((row, index) => {
        console.log(`  ${index + 1}. ${row.table_name}`);
      });
      console.log(`\n📊 Total tables: ${result.rows.length}`);
    } else {
      console.log('⚠️  No tables found in PostgreSQL database');
    }

    // Check for specific tables
    console.log('\n🔍 Checking for specific tables:\n');
    
    const specificTables = ['sensores', 'puntoventa'];
    for (const tableName of specificTables) {
      const checkResult = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [tableName]);
      
      const exists = checkResult.rows[0]?.exists || false;
      console.log(`  ${exists ? '✅' : '❌'} ${tableName}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking tables:', error.message);
    process.exit(1);
  }
}

listTables();


#!/usr/bin/env node
/**
 * Run a PostgreSQL migration using Node.js pg client.
 * Use this when psql fails (e.g. Azure PostgreSQL with SSL).
 * Usage: node scripts/migrations/run-migration-node.js <migration_file.sql>
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pkg from 'pg';
const { Client } = pkg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_DIR = join(__dirname, '../..');

async function runMigration(migrationFile) {
  const client = new Client({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'tiwater_timeseries',
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    const sql = readFileSync(migrationFile, 'utf8');
    await client.connect();
    await client.query(sql);
    console.log('\n✅ Migration completed successfully!');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node run-migration-node.js <migration_file.sql>');
  process.exit(1);
}

const fullPath = migrationFile.startsWith('/') ? migrationFile : join(API_DIR, migrationFile);
runMigration(fullPath);

#!/usr/bin/env node
/**
 * Run PostgreSQL migrations from scripts/migrations/ directory.
 * Tracks executed migrations in a `migrations` table; runs only missing ones.
 * Usage: node scripts/migrations/run-all-migrations.js
 * Env: POSTGRES_HOST, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_SSL
 */

import 'dotenv/config';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pkg from 'pg';
const { Client } = pkg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_DIR = join(__dirname, '../..');
const MIGRATIONS_DIR = join(API_DIR, 'scripts/migrations');

const CREATE_MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS migrations (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  executed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_migrations_name ON migrations (name);
`;

function listMigrationFiles() {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  const exclude = (process.env.POSTGRES_EXCLUDE_MIGRATIONS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql') && !exclude.includes(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return files;
}

async function runAllMigrations() {
  const client = new Client({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'tiwater_timeseries',
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    console.log(`[migrate] Connected to ${process.env.POSTGRES_DB || 'tiwater_timeseries'} @ ${process.env.POSTGRES_HOST || 'localhost'}`);

    // Ensure migrations table exists
    await client.query(CREATE_MIGRATIONS_TABLE);

    const files = listMigrationFiles();
    if (files.length === 0) {
      console.log('[migrate] No migration files found');
      return;
    }

    const { rows } = await client.query('SELECT name FROM migrations');
    const executed = new Set(rows.map((r) => r.name));
    const pending = files.filter((f) => !executed.has(f));

    if (pending.length === 0) {
      console.log(`[migrate] All ${files.length} migrations already applied`);
      return;
    }

    console.log(`[migrate] ${pending.length} migration(s) to run (${executed.size} already applied)\n`);

    for (const filename of pending) {
      const fullPath = join(MIGRATIONS_DIR, filename);
      try {
        const sql = readFileSync(fullPath, 'utf8');
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO migrations (name) VALUES ($1)', [filename]);
        await client.query('COMMIT');
        console.log(`[migrate] ✅ ${filename}`);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error(`[migrate] ❌ ${filename}:`, err.message);
        process.exit(1);
      }
    }

    console.log(`\n[migrate] ✅ ${pending.length} migration(s) completed`);
  } catch (err) {
    console.error('[migrate] ❌ Connection failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runAllMigrations();

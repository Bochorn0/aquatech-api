#!/usr/bin/env node
// scripts/run-dev-mode-data-generator.js
// Standalone script to run the dev mode random data generator.
// Use from system crontab: */5 * * * * cd /path/to/Aquatech_api && node scripts/run-dev-mode-data-generator.js

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (Aquatech_api)
dotenv.config({ path: join(__dirname, '..', '.env') });

import pool from '../src/config/postgres.config.js';
import { generateRandomDataForDevModePuntos } from '../src/services/devModeDataGenerator.service.js';

async function main() {
  try {
    const result = await generateRandomDataForDevModePuntos();
    console.log(`[run-dev-mode-data-generator] ${result.puntosProcessed} puntos, ${result.readingsCreated} readings`);
    if (result.errors.length > 0) {
      result.errors.forEach((e) => console.warn('[run-dev-mode-data-generator]', e));
    }
  } catch (error) {
    console.error('[run-dev-mode-data-generator] Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();

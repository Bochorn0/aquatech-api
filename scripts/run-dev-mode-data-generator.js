#!/usr/bin/env node
// scripts/run-dev-mode-data-generator.js
// Calls the API single endpoint (generate-mock-data-now) for each punto with dev_mode enabled.
// Use from crontab: */5 * * * * cd /path/to/Aquatech_api && node scripts/run-dev-mode-data-generator.js
//
// Requires in .env:
//   API_BASE_URL - e.g. http://127.0.0.1:3009 (default)
//   One of: CRON_DEV_MODE_SECRET or TIWATER_API_KEY (sent in X-Cron-Secret header)

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const API_BASE_URL = (process.env.API_BASE_URL || 'http://127.0.0.1:3009').replace(/\/$/, '');
const CRON_SECRET = process.env.CRON_DEV_MODE_SECRET || process.env.TIWATER_API_KEY;

async function main() {
  if (!CRON_SECRET) {
    console.error('[run-dev-mode-data-generator] Set CRON_DEV_MODE_SECRET or TIWATER_API_KEY in .env');
    process.exit(1);
  }

  let puntos;
  const pool = (await import('../src/config/postgres.config.js')).default;
  try {
    const PuntoVentaModel = (await import('../src/models/postgres/puntoVenta.model.js')).default;
    puntos = await PuntoVentaModel.findAllWithDevModeEnabled();
  } catch (err) {
    console.error('[run-dev-mode-data-generator] Failed to load dev_mode puntos:', err.message);
    await pool.end();
    process.exit(1);
  }

  if (puntos.length === 0) {
    console.log('[run-dev-mode-data-generator] 0 puntos with dev_mode enabled');
    await pool.end();
    process.exit(0);
  }

  const url = `${API_BASE_URL}/api/v1.0/puntoVentas`;
  const headers = {
    'Content-Type': 'application/json',
    'X-Cron-Secret': CRON_SECRET
  };

  let ok = 0;
  let fail = 0;

  for (const punto of puntos) {
    const id = punto.id;
    const codigo = punto.codigo_tienda || punto.code || id;
    try {
      const res = await fetch(`${url}/${id}/generate-mock-data-now`, {
        method: 'POST',
        headers
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.success) {
        ok += 1;
        console.log(`[run-dev-mode-data-generator] OK ${codigo}`);
      } else {
        fail += 1;
        console.warn(`[run-dev-mode-data-generator] FAIL ${codigo}: ${res.status} ${body.message || res.statusText}`);
      }
    } catch (err) {
      fail += 1;
      console.warn(`[run-dev-mode-data-generator] FAIL ${codigo}:`, err.message);
    }
    if (puntos.length > 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  console.log(`[run-dev-mode-data-generator] Done: ${ok} ok, ${fail} failed (${puntos.length} dev_mode puntos)`);
  await pool.end();
  process.exit(fail > 0 ? 1 : 0);
}

main();

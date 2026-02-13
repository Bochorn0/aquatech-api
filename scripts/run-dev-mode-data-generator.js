#!/usr/bin/env node
// scripts/run-dev-mode-data-generator.js
// Calls the API single endpoint (generate-mock-data-now) for each punto with dev_mode enabled.
// Use from crontab: */5 * * * * cd /path/to/Aquatech_api && node scripts/run-dev-mode-data-generator.js
//
// Auth options (one required, tried in order):
//   1. CRON_DEV_MODE_SECRET or TIWATER_API_KEY -> sent as X-Cron-Secret and X-TIWater-API-Key
//   2. DEV_MODE_LOGIN_EMAIL + DEV_MODE_LOGIN_PASSWORD -> login to get JWT token
//
// Requires in .env:
//   API_BASE_URL - e.g. http://127.0.0.1:3009 (default)
//   One of: CRON_DEV_MODE_SECRET, TIWATER_API_KEY, or (DEV_MODE_LOGIN_EMAIL + DEV_MODE_LOGIN_PASSWORD)

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const API_BASE_URL = (process.env.API_BASE_URL || 'http://127.0.0.1:3009').replace(/\/$/, '');
const CRON_SECRET = process.env.CRON_DEV_MODE_SECRET || process.env.TIWATER_API_KEY;
const LOGIN_EMAIL = process.env.DEV_MODE_LOGIN_EMAIL || 'esp32@lcc.com.mx';
const LOGIN_PASSWORD = process.env.DEV_MODE_LOGIN_PASSWORD || 'Esp32*';

async function fetchAuthHeaders() {
  if (CRON_SECRET) {
    return {
      'Content-Type': 'application/json',
      'X-Cron-Secret': CRON_SECRET,
      'X-TIWater-API-Key': CRON_SECRET
    };
  }
  // Login to get JWT token
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1.0/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.token) {
      return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.token}`
      };
    }
    throw new Error(data.message || `Login failed: ${res.status}`);
  } catch (err) {
    throw new Error(`Cannot authenticate: ${err.message}`);
  }
}

async function main() {
  let headers;
  try {
    headers = await fetchAuthHeaders();
  } catch (err) {
    console.error('[run-dev-mode-data-generator]', err.message);
    console.error('[run-dev-mode-data-generator] Set CRON_DEV_MODE_SECRET or TIWATER_API_KEY, or DEV_MODE_LOGIN_EMAIL + DEV_MODE_LOGIN_PASSWORD in .env');
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

  let ok = 0;
  let fail = 0;

  for (const punto of puntos) {
    const id = punto.id;
    const codigo = punto.codigo_tienda || punto.code || id;
    try {
      const res = await fetch(`${url}/${id}/generate-mock-data-now`, {
        method: 'POST',
        headers: { ...headers }
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

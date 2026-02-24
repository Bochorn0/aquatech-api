#!/usr/bin/env node
/**
 * Seed admin user (admin@lcc.com.mx / admin)
 * Run after migrations 018, 019, 020
 * Usage: node scripts/seed-admin-user.js
 */

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { query } from '../src/config/postgres.config.js';

const ADMIN_EMAIL = 'admin@lcc.com.mx';
const ADMIN_PASSWORD = 'admin';

async function seedAdminUser() {
  try {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    const roleRes = await query('SELECT id FROM roles WHERE LOWER(name) = $1', ['admin']);
    const clientRes = await query('SELECT id FROM clients ORDER BY id LIMIT 1');

    const roleId = roleRes.rows[0]?.id;
    const clientId = clientRes.rows[0]?.id;

    if (!roleId) {
      console.error('❌ Admin role not found. Run migration 020 first.');
      process.exit(1);
    }
    if (!clientId) {
      console.error('❌ No client found. Run migration 020 first.');
      process.exit(1);
    }

    const existing = await query('SELECT id FROM users WHERE LOWER(email) = $1', [ADMIN_EMAIL.toLowerCase()]);
    if (existing.rows.length > 0) {
      console.log('✅ Admin user already exists');
      process.exit(0);
    }

    await query(
      `INSERT INTO users (email, password, role_id, client_id, postgres_client_id, status, verified, nombre, puesto)
       VALUES ($1, $2, $3, $4, $5, 'active', TRUE, 'Admin', 'Administrator')`,
      [ADMIN_EMAIL, passwordHash, roleId, clientId, clientId]
    );

    console.log('✅ Admin user created: admin@lcc.com.mx / admin');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seedAdminUser();

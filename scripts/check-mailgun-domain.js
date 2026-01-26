#!/usr/bin/env node
/**
 * Check which Mailgun domain is configured
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

console.log('📋 Mailgun Configuration Check:');
console.log('='.repeat(60));
console.log(`EMAIL_PROVIDER: ${process.env.EMAIL_PROVIDER || 'NOT SET'}`);
console.log(`MAILGUN_DOMAIN: ${process.env.MAILGUN_DOMAIN || 'NOT SET'}`);
console.log(`MAILGUN_FROM_EMAIL: ${process.env.MAILGUN_FROM_EMAIL || 'NOT SET'}`);
console.log();

if (process.env.MAILGUN_DOMAIN) {
  if (process.env.MAILGUN_DOMAIN.includes('sandbox')) {
    console.log('⚠️  WARNING: Using SANDBOX domain!');
    console.log('   This requires adding recipients to authorized list.');
    console.log('   Change MAILGUN_DOMAIN to your verified domain (e.g., lcc.com.mx)');
  } else {
    console.log('✅ Using VERIFIED domain!');
    console.log('   You can send to any email address.');
  }
} else {
  console.log('❌ MAILGUN_DOMAIN is not set!');
}

console.log();
console.log('💡 To fix:');
console.log('   1. Edit .env file');
console.log('   2. Change: MAILGUN_DOMAIN=lcc.com.mx');
console.log('   3. Restart PM2: pm2 restart 0 --update-env');

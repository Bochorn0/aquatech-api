#!/usr/bin/env node
/**
 * Quick script to check email-related environment variables
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

console.log('📋 Current Email Configuration in .env:');
console.log('='.repeat(60));
console.log(`EMAIL_PROVIDER: ${process.env.EMAIL_PROVIDER || 'NOT SET'}`);
console.log();

if (process.env.EMAIL_PROVIDER === 'smtp') {
  console.log('SMTP Configuration:');
  console.log(`  SMTP_HOST: ${process.env.SMTP_HOST || 'NOT SET'}`);
  console.log(`  SMTP_PORT: ${process.env.SMTP_PORT || 'NOT SET'}`);
  console.log(`  SMTP_SECURE: ${process.env.SMTP_SECURE || 'NOT SET'}`);
  console.log(`  SMTP_USER: ${process.env.SMTP_USER || 'NOT SET'}`);
  console.log(`  SMTP_PASSWORD: ${process.env.SMTP_PASSWORD ? '*** SET ***' : 'NOT SET'}`);
} else if (process.env.EMAIL_PROVIDER === 'mailgun') {
  console.log('Mailgun Configuration:');
  console.log(`  MAILGUN_API_KEY: ${process.env.MAILGUN_API_KEY ? '*** SET ***' : 'NOT SET'}`);
  console.log(`  MAILGUN_DOMAIN: ${process.env.MAILGUN_DOMAIN || 'NOT SET'}`);
  console.log(`  MAILGUN_FROM_EMAIL: ${process.env.MAILGUN_FROM_EMAIL || 'NOT SET'}`);
} else {
  console.log('⚠️  EMAIL_PROVIDER is not set or invalid');
  console.log('   Should be: smtp, mailgun, sendgrid, or resend');
}

console.log();
console.log('💡 To test SMTP, make sure:');
console.log('   EMAIL_PROVIDER=smtp');
console.log('   SMTP_HOST=smtp.gmail.com');
console.log('   SMTP_PORT=587');
console.log('   SMTP_USER=soporte@lcc.com.mx');
console.log('   SMTP_PASSWORD=your-app-password');

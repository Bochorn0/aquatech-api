#!/usr/bin/env node
/**
 * Simple Email Sending Example
 * 
 * This is a minimal example showing how to send emails using the email helper.
 * 
 * Usage:
 *   node scripts/simple-email-example.js
 *   node scripts/simple-email-example.js --to=recipient@example.com
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import emailHelper from '../src/utils/email.helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

// Parse command line arguments
const args = process.argv.slice(2);
const toArg = args.find(arg => arg.startsWith('--to='));
const recipientEmail = toArg ? toArg.split('=')[1] : process.env.SMTP_USER || 'soporte@lcc.com.mx';

console.log('📧 Simple Email Sending Example');
console.log('='.repeat(60));
console.log();

// Example 1: Simple text email
console.log('Example 1: Sending simple text email...');
const result1 = await emailHelper.sendEmail({
  to: recipientEmail,
  subject: 'Simple Test Email from Aquatech',
  text: 'This is a simple text email. If you received this, your email configuration is working!',
});

if (result1.success) {
  console.log('✅ Email sent successfully!');
  console.log('   Message ID:', result1.messageId);
} else {
  console.log('❌ Failed to send email:', result1.error);
}
console.log();

// Example 2: HTML email
console.log('Example 2: Sending HTML email...');
const result2 = await emailHelper.sendEmail({
  to: recipientEmail,
  subject: 'HTML Test Email from Aquatech',
  html: `
    <h2>Hello from Aquatech!</h2>
    <p>This is an <strong>HTML email</strong> with formatting.</p>
    <ul>
      <li>Email configuration is working</li>
      <li>HTML rendering is supported</li>
      <li>You can use this for notifications</li>
    </ul>
    <p style="color: #1976d2;">This text is blue!</p>
  `,
});

if (result2.success) {
  console.log('✅ HTML email sent successfully!');
  console.log('   Message ID:', result2.messageId);
} else {
  console.log('❌ Failed to send HTML email:', result2.error);
}
console.log();

// Example 3: Using helper methods
console.log('Example 3: Using sendNotificationEmail helper...');
const result3 = await emailHelper.sendNotificationEmail({
  to: recipientEmail,
  subject: 'Notification Test',
  title: 'System Notification',
  message: 'This is a notification email using the helper method. Perfect for system alerts and updates!',
});

if (result3.success) {
  console.log('✅ Notification email sent successfully!');
  console.log('   Message ID:', result3.messageId);
} else {
  console.log('❌ Failed to send notification email:', result3.error);
}
console.log();

console.log('='.repeat(60));
console.log('📝 Summary:');
console.log(`   Recipient: ${recipientEmail}`);
console.log(`   Provider: ${process.env.EMAIL_PROVIDER || 'smtp'}`);
console.log(`   SMTP Host: ${process.env.SMTP_HOST || 'smtp.office365.com'}`);
console.log();
console.log('💡 Tips:');
console.log('   - Check your inbox (and spam folder) for the test emails');
console.log('   - Use emailHelper.sendEmail() for custom emails');
console.log('   - Use emailHelper.sendPasswordResetEmail() for password resets');
console.log('   - Use emailHelper.sendAlertEmail() for system alerts');
console.log('   - Use emailHelper.sendNotificationEmail() for general notifications');
console.log();

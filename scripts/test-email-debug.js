#!/usr/bin/env node
/**
 * Email Configuration Debug Script
 * 
 * This script helps diagnose nodemailer configuration issues:
 * - Tests SMTP connection
 * - Checks if Google Workspace/Office365 configuration is needed
 * - Validates credentials
 * - Provides step-by-step debugging
 * 
 * Usage:
 *   node scripts/test-email-debug.js
 *   node scripts/test-email-debug.js --test-send
 */

import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import emailHelper from '../src/utils/email.helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const args = process.argv.slice(2);
const testSend = args.includes('--test-send');

console.log('='.repeat(60));
console.log('📧 Email Configuration Debug Tool');
console.log('='.repeat(60));
console.log();

// Step 1: Check Environment Variables
console.log('📋 Step 1: Checking Environment Variables');
console.log('-'.repeat(60));

const emailProvider = process.env.EMAIL_PROVIDER || 'smtp';

// Check variables based on provider
const requiredVars = {
  EMAIL_PROVIDER: emailProvider,
};

// Add provider-specific variables
if (emailProvider === 'mailgun') {
  requiredVars.MAILGUN_API_KEY = process.env.MAILGUN_API_KEY ? '***' : undefined;
  requiredVars.MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
  requiredVars.MAILGUN_FROM_EMAIL = process.env.MAILGUN_FROM_EMAIL || process.env.SMTP_USER;
} else if (emailProvider === 'sendgrid') {
  requiredVars.SENDGRID_API_KEY = process.env.SENDGRID_API_KEY ? '***' : undefined;
  requiredVars.SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER;
} else if (emailProvider === 'resend') {
  requiredVars.RESEND_API_KEY = process.env.RESEND_API_KEY ? '***' : undefined;
  requiredVars.RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || process.env.SMTP_USER;
} else {
  // SMTP provider
  requiredVars.SMTP_HOST = process.env.SMTP_HOST;
  requiredVars.SMTP_PORT = process.env.SMTP_PORT;
  requiredVars.SMTP_USER = process.env.SMTP_USER;
  requiredVars.SMTP_PASSWORD = process.env.SMTP_PASSWORD ? '***' : undefined;
  requiredVars.SMTP_SECURE = process.env.SMTP_SECURE;
}

let configValid = true;

Object.entries(requiredVars).forEach(([key, value]) => {
  const status = value !== undefined && value !== '' ? '✅' : '❌';
  console.log(`${status} ${key}: ${value || 'NOT SET'}`);
  // Don't mark as invalid for optional fields
  const optionalFields = ['SMTP_SECURE', 'EMAIL_PROVIDER', 'MAILGUN_FROM_EMAIL', 'SENDGRID_FROM_EMAIL', 'RESEND_FROM_EMAIL'];
  if (!value && !optionalFields.includes(key)) {
    configValid = false;
  }
});

console.log();

// Step 2: Detect Email Provider Type
console.log('🔍 Step 2: Detecting Email Provider Type');
console.log('-'.repeat(60));

const smtpUser = process.env.SMTP_USER || '';
const smtpHost = process.env.SMTP_HOST || '';

let detectedProvider = 'unknown';
let recommendedConfig = {};

if (smtpUser.includes('@gmail.com')) {
  detectedProvider = 'Gmail';
  recommendedConfig = {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    notes: [
      'If 2FA is enabled, use App Password instead of regular password',
      'App Password: Google Account > Security > 2-Step Verification > App passwords'
    ]
  };
} else if (smtpUser.includes('@outlook.com') || smtpUser.includes('@hotmail.com') || smtpUser.includes('@office365.com')) {
  detectedProvider = 'Microsoft 365/Outlook';
  recommendedConfig = {
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    notes: [
      'Use your account password (not app password unless 2FA is enabled)',
      'For 2FA: May need OAuth 2.0 authentication'
    ]
  };
} else if (smtpUser.includes('@')) {
  // Custom domain - need to determine if Google Workspace or Office365
  detectedProvider = `Custom Domain (${smtpUser.split('@')[1]})`;
  recommendedConfig = {
    googleWorkspace: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      notes: [
        'If using Google Workspace (G Suite):',
        '  - Use smtp.gmail.com with port 587',
        '  - Enable "Less secure app access" OR use App Password',
        '  - Check: Admin Console > Security > Less secure app access'
      ]
    },
    office365: {
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      notes: [
        'If using Microsoft 365/Office365:',
        '  - Use smtp.office365.com with port 587',
        '  - Use account password or OAuth 2.0 for 2FA'
      ]
    },
    customServer: {
      host: `smtp.${smtpUser.split('@')[1]}`,
      port: 587,
      secure: false,
      notes: [
        'If using custom mail server:',
        `  - Try: smtp.${smtpUser.split('@')[1]} or mail.${smtpUser.split('@')[1]}`,
        '  - Ports: 587 (STARTTLS) or 465 (SSL)',
        '  - Contact your email administrator for correct settings'
      ]
    }
  };
} else {
  detectedProvider = 'Cannot detect (no email address found)';
}

console.log(`Detected Provider: ${detectedProvider}`);
console.log();
console.log('Recommended Configuration:');
if (detectedProvider.includes('Custom Domain')) {
  console.log('\n🔵 Google Workspace Option:');
  console.log(JSON.stringify(recommendedConfig.googleWorkspace, null, 2));
  console.log('\n🔵 Microsoft 365 Option:');
  console.log(JSON.stringify(recommendedConfig.office365, null, 2));
  console.log('\n🔵 Custom Server Option:');
  console.log(JSON.stringify(recommendedConfig.customServer, null, 2));
  console.log('\n💡 TIP: Check your email account settings or contact your email administrator');
  console.log('   to determine which provider you are using.');
} else {
  console.log(JSON.stringify(recommendedConfig, null, 2));
}
console.log();

// Step 3: Validate Current Configuration
console.log('✅ Step 3: Validating Current Configuration');
console.log('-'.repeat(60));

const currentConfig = {
  host: smtpHost || recommendedConfig.host || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || recommendedConfig.port || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: smtpUser,
    pass: process.env.SMTP_PASSWORD || '',
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
  tls: {
    rejectUnauthorized: false
  }
};

// Check for configuration mismatches
const hostMatch = currentConfig.host && smtpUser.includes('@');
let hostIssue = null;

if (smtpUser.includes('@gmail.com') && !currentConfig.host.includes('gmail')) {
  hostIssue = `⚠️  Mismatch: Using ${smtpUser} but SMTP_HOST is ${currentConfig.host}. Should be smtp.gmail.com`;
} else if ((smtpUser.includes('@outlook.com') || smtpUser.includes('@office365.com')) && !currentConfig.host.includes('office365')) {
  hostIssue = `⚠️  Mismatch: Using ${smtpUser} but SMTP_HOST is ${currentConfig.host}. Should be smtp.office365.com`;
} else if (smtpUser.includes('@') && !smtpUser.includes('gmail.com') && !smtpUser.includes('outlook.com') && !smtpUser.includes('office365.com')) {
  // Custom domain
  if (currentConfig.host.includes('gmail.com')) {
    hostIssue = `ℹ️  Using smtp.gmail.com with custom domain - OK if using Google Workspace`;
  } else if (currentConfig.host.includes('office365.com')) {
    hostIssue = `ℹ️  Using smtp.office365.com with custom domain - OK if using Microsoft 365`;
  } else if (!currentConfig.host.includes(smtpUser.split('@')[1])) {
    hostIssue = `⚠️  Custom domain detected but SMTP_HOST (${currentConfig.host}) may not match your email provider`;
  }
}

console.log(`Host: ${currentConfig.host}`);
console.log(`Port: ${currentConfig.port}`);
console.log(`Secure: ${currentConfig.secure}`);
console.log(`User: ${currentConfig.auth.user}`);
console.log(`Password: ${currentConfig.auth.pass ? '✅ Set' : '❌ Not Set'}`);
if (hostIssue) {
  console.log(hostIssue);
}
console.log();

// Step 4: Test Email Connection
if (configValid) {
  const emailProvider = process.env.EMAIL_PROVIDER || 'smtp';
  
  // Check if using API provider (not SMTP)
  if (emailProvider === 'mailgun' || emailProvider === 'sendgrid' || emailProvider === 'resend') {
    console.log(`🔌 Step 4: Testing ${emailProvider.toUpperCase()} API Connection`);
    console.log('-'.repeat(60));
    
    // Check API provider configuration
    if (emailProvider === 'mailgun') {
      const mailgunApiKey = process.env.MAILGUN_API_KEY || '';
      const mailgunDomain = process.env.MAILGUN_DOMAIN || '';
      if (!mailgunApiKey || !mailgunDomain) {
        console.log('❌ Mailgun Configuration: INCOMPLETE');
        console.log('   Missing MAILGUN_API_KEY or MAILGUN_DOMAIN');
        console.log('   Please set these in your .env file');
        console.log();
      } else {
        console.log('✅ Mailgun Configuration: Complete');
        console.log(`   Domain: ${mailgunDomain}`);
        console.log('   API Key: Set');
        console.log();
        
        // Test connection by sending email
        if (testSend) {
          console.log('📤 Step 5: Sending Test Email via Mailgun');
          console.log('-'.repeat(60));
          
          const result = await emailHelper.sendEmail({
            to: smtpUser,
            subject: 'Test Email from Aquatech Debug Script',
            html: `
              <h2>✅ Email Configuration Test</h2>
              <p>This is a test email to verify your Mailgun configuration is working correctly.</p>
              <p><strong>Configuration Details:</strong></p>
              <ul>
                <li>Provider: Mailgun</li>
                <li>Domain: ${mailgunDomain}</li>
                <li>Sent at: ${new Date().toISOString()}</li>
              </ul>
              <p>If you received this email, your configuration is correct! 🎉</p>
            `,
          });
          
          if (result.success) {
            console.log('✅ Test Email Sent Successfully!');
            console.log('   Message ID:', result.messageId);
            console.log('   Provider:', result.provider);
            console.log('   Check your inbox:', smtpUser);
            console.log('   ⚠️  Note: Sandbox domain can only send to verified recipients!');
            console.log('   Make sure you verified the recipient in Mailgun Dashboard.');
          } else {
            console.log('❌ Test Email Failed');
            console.log('   Error:', result.error);
            if (result.error.includes('unverified')) {
              console.log('   💡 Solution: Verify recipient email in Mailgun Dashboard → Authorized Recipients');
            }
          }
          console.log();
        } else {
          console.log('💡 To send a test email, run: node scripts/test-email-debug.js --test-send');
          console.log('   ⚠️  Remember: Sandbox domain requires verified recipients!');
          console.log();
        }
      }
    } else if (emailProvider === 'sendgrid') {
      const sendGridApiKey = process.env.SENDGRID_API_KEY || '';
      if (!sendGridApiKey) {
        console.log('❌ SendGrid Configuration: INCOMPLETE');
        console.log('   Missing SENDGRID_API_KEY');
        console.log();
      } else {
        console.log('✅ SendGrid Configuration: Complete');
        console.log('   API Key: Set');
        console.log();
        
        if (testSend) {
          console.log('📤 Step 5: Sending Test Email via SendGrid');
          console.log('-'.repeat(60));
          const result = await emailHelper.sendEmail({
            to: smtpUser,
            subject: 'Test Email from Aquatech Debug Script',
            html: '<h2>✅ Email Configuration Test</h2><p>This is a test email via SendGrid.</p>',
          });
          
          if (result.success) {
            console.log('✅ Test Email Sent Successfully!');
            console.log('   Message ID:', result.messageId);
            console.log('   Provider:', result.provider);
          } else {
            console.log('❌ Test Email Failed:', result.error);
          }
          console.log();
        }
      }
    } else if (emailProvider === 'resend') {
      const resendApiKey = process.env.RESEND_API_KEY || '';
      if (!resendApiKey) {
        console.log('❌ Resend Configuration: INCOMPLETE');
        console.log('   Missing RESEND_API_KEY');
        console.log();
      } else {
        console.log('✅ Resend Configuration: Complete');
        console.log('   API Key: Set');
        console.log();
        
        if (testSend) {
          console.log('📤 Step 5: Sending Test Email via Resend');
          console.log('-'.repeat(60));
          const result = await emailHelper.sendEmail({
            to: smtpUser,
            subject: 'Test Email from Aquatech Debug Script',
            html: '<h2>✅ Email Configuration Test</h2><p>This is a test email via Resend.</p>',
          });
          
          if (result.success) {
            console.log('✅ Test Email Sent Successfully!');
            console.log('   Message ID:', result.messageId);
            console.log('   Provider:', result.provider);
          } else {
            console.log('❌ Test Email Failed:', result.error);
          }
          console.log();
        }
      }
    }
  } else {
    // SMTP provider
    console.log('🔌 Step 4: Testing SMTP Connection');
    console.log('-'.repeat(60));
    
    try {
      const transporter = nodemailer.createTransport(currentConfig);
      
      // Test connection
      console.log('Testing connection to', currentConfig.host, ':', currentConfig.port);
      await transporter.verify();
      console.log('✅ SMTP Connection: SUCCESS');
      console.log('   Server is ready to accept messages');
      console.log();
      
      // Step 5: Send Test Email (if requested)
      if (testSend) {
        console.log('📤 Step 5: Sending Test Email');
        console.log('-'.repeat(60));
        
        const testEmail = {
          from: `"Aquatech Test" <${smtpUser}>`,
          to: smtpUser, // Send to self
          subject: 'Test Email from Aquatech Debug Script',
          html: `
            <h2>✅ Email Configuration Test</h2>
            <p>This is a test email to verify your SMTP configuration is working correctly.</p>
            <p><strong>Configuration Details:</strong></p>
            <ul>
              <li>Host: ${currentConfig.host}</li>
              <li>Port: ${currentConfig.port}</li>
              <li>Secure: ${currentConfig.secure}</li>
              <li>Provider: ${detectedProvider}</li>
            </ul>
            <p>If you received this email, your configuration is correct! 🎉</p>
            <p><small>Sent at ${new Date().toISOString()}</small></p>
          `,
          text: `
Email Configuration Test

This is a test email to verify your SMTP configuration is working correctly.

Configuration Details:
- Host: ${currentConfig.host}
- Port: ${currentConfig.port}
- Secure: ${currentConfig.secure}
- Provider: ${detectedProvider}

If you received this email, your configuration is correct! 🎉

Sent at ${new Date().toISOString()}
          `
        };
        
        const info = await transporter.sendMail(testEmail);
        console.log('✅ Test Email Sent Successfully!');
        console.log('   Message ID:', info.messageId);
        console.log('   Check your inbox:', smtpUser);
        console.log();
      } else {
        console.log('💡 To send a test email, run: node scripts/test-email-debug.js --test-send');
        console.log();
      }
    
  } catch (error) {
    console.log('❌ SMTP Connection: FAILED');
    console.log();
    console.log('Error Details:');
    console.log('-'.repeat(60));
    console.log(`Error Type: ${error.code || error.name}`);
    console.log(`Error Message: ${error.message}`);
    console.log();
    
    // Provide specific troubleshooting based on error
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.log('🔧 Troubleshooting Steps for Connection Timeout:');
      console.log('   1. Check if firewall is blocking outbound SMTP ports');
      console.log('   2. Verify SMTP_HOST and SMTP_PORT are correct');
      console.log('   3. Test network connectivity:');
      console.log(`      nc -zv ${currentConfig.host} ${currentConfig.port}`);
      console.log('   4. Try port 465 with SSL instead:');
      console.log('      SMTP_PORT=465');
      console.log('      SMTP_SECURE=true');
      console.log('   5. If ports are blocked, consider using SendGrid API:');
      console.log('      EMAIL_PROVIDER=sendgrid');
      console.log('      SENDGRID_API_KEY=your-api-key');
      console.log();
    } else if (error.code === 'EAUTH' || error.message.includes('Invalid login') || error.message.includes('authentication')) {
      console.log('🔧 Troubleshooting Steps for Authentication Error:');
      console.log('   1. Verify SMTP_USER and SMTP_PASSWORD are correct');
      console.log('   2. For Gmail with 2FA: Use App Password instead of regular password');
      console.log('   3. For Google Workspace: Check Admin Console > Security settings');
      console.log('   4. For Office365 with 2FA: May need OAuth 2.0 authentication');
      console.log('   5. Try enabling "Less secure app access" (not recommended for Gmail)');
      console.log();
    } else if (error.message.includes('certificate') || error.code === 'CERT_HAS_EXPIRED') {
      console.log('🔧 Troubleshooting Steps for Certificate Error:');
      console.log('   1. Try setting SMTP_SECURE=false (uses STARTTLS)');
      console.log('   2. Check if server certificate is valid');
      console.log('   3. Contact email provider for certificate issues');
      console.log();
    } else {
      console.log('🔧 General Troubleshooting:');
      console.log('   1. Check all environment variables are set correctly');
      console.log('   2. Verify SMTP_HOST matches your email provider');
      console.log('   3. Check server logs for more details');
      console.log('   4. Try different SMTP configuration (port, secure, etc.)');
      console.log();
    }
    
    // Check if it's a custom domain and suggest Google Workspace setup
    if (smtpUser.includes('@') && !smtpUser.includes('gmail.com') && !smtpUser.includes('outlook.com')) {
      console.log('💡 Google Workspace Custom Domain Setup:');
      console.log('   If you are using Google Workspace:');
      console.log('   1. Admin Console: https://admin.google.com');
      console.log('   2. Security > Less secure app access (if available)');
      console.log('   3. Or use App Passwords for 2FA-enabled accounts');
      console.log('   4. Verify SMTP_HOST=smtp.gmail.com');
      console.log('   5. Use your full email address (not just username)');
      console.log();
      
      console.log('💡 Microsoft 365 Custom Domain Setup:');
      console.log('   If you are using Microsoft 365:');
      console.log('   1. Admin Center: https://admin.microsoft.com');
      console.log('   2. Use SMTP_HOST=smtp.office365.com');
      console.log('   3. Use your account password or OAuth 2.0');
      console.log('   4. Check if SMTP is enabled for your organization');
      console.log();
    }
  }
} else {
  console.log('❌ Step 4: Skipped - Configuration incomplete');
  console.log('   Please set all required environment variables in .env file');
  console.log();
}

// Step 6: Summary and Recommendations
console.log('📝 Step 6: Summary and Recommendations');
console.log('='.repeat(60));

if (configValid && smtpUser) {
  console.log('✅ Configuration looks complete');
  console.log();
  console.log('Next Steps:');
  console.log('1. Run with --test-send flag to send a test email');
  console.log('2. Check your email inbox for the test email');
  console.log('3. If successful, your email configuration is ready!');
  console.log();
  console.log('If you still have issues:');
  console.log('- Check firewall settings on your server');
  console.log('- Verify email provider allows SMTP access');
  console.log('- Consider using SendGrid API (already implemented in email.helper.js)');
  console.log('  Set EMAIL_PROVIDER=sendgrid in .env');
} else {
  console.log('⚠️  Configuration needs attention');
  console.log();
  console.log('Required Environment Variables:');
  console.log('  SMTP_HOST - Your SMTP server (e.g., smtp.gmail.com, smtp.office365.com)');
  console.log('  SMTP_PORT - SMTP port (587 for STARTTLS, 465 for SSL)');
  console.log('  SMTP_USER - Your email address');
  console.log('  SMTP_PASSWORD - Your email password or app password');
  console.log('  SMTP_SECURE - true for SSL (port 465), false for STARTTLS (port 587)');
  console.log();
  console.log('Example .env configuration:');
  console.log('  SMTP_HOST=smtp.gmail.com');
  console.log('  SMTP_PORT=587');
  console.log('  SMTP_SECURE=false');
  console.log('  SMTP_USER=your-email@gmail.com');
  console.log('  SMTP_PASSWORD=your-app-password');
}

console.log();
console.log('='.repeat(60));

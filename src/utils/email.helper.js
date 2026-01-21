// src/utils/email.helper.js
// Reusable email helper module for sending emails
// Can be used for password recovery, alerts, notifications, etc.
// Supports both SMTP (nodemailer) and SendGrid API

import nodemailer from 'nodemailer';
import axios from 'axios';
import config from '../config/config.js';

/**
 * Email Helper Class
 * Provides reusable methods for sending emails
 */
class EmailHelper {
  constructor() {
    // Email provider: 'smtp' or 'sendgrid'
    // Use SendGrid if SMTP ports are blocked by network
    this.emailProvider = process.env.EMAIL_PROVIDER || 'smtp'; // 'smtp' or 'sendgrid'
    
    // SendGrid configuration
    this.sendGridApiKey = process.env.SENDGRID_API_KEY || '';
    this.sendGridFromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_USER || 'soporte@lcc.com.mx';
    this.sendGridFromName = process.env.SENDGRID_FROM_NAME || 'Aquatech';
    
    // SMTP configuration (fallback if SendGrid not configured)
    // Email configuration from environment variables
    // All SMTP settings must be configured in .env file
    // For lcc.com.mx, you might need to use a different SMTP server
    // Common options:
    // - smtp.office365.com (Microsoft 365/Outlook) - MOST LIKELY for lcc.com.mx
    // - mail.lcc.com.mx or smtp.lcc.com.mx (if they have their own mail server)
    // - smtp.gmail.com (if using Gmail/Google Workspace)
    // IMPORTANT: Set SMTP_HOST in .env file to match your email provider!
    // 
    // If port 587 is blocked, try port 465 with SSL:
    // SMTP_PORT=465
    // SMTP_SECURE=true
    //
    // OAuth 2.0 Support (required for accounts with 2FA enabled):
    // Set SMTP_AUTH_TYPE=oauth2 and provide OAuth credentials
    const authType = process.env.SMTP_AUTH_TYPE || 'password'; // 'password' or 'oauth2'
    
    let authConfig;
    if (authType === 'oauth2') {
      // OAuth 2.0 authentication (required for 2FA-enabled accounts)
      // For Office365, you need: clientId, clientSecret, refreshToken
      authConfig = {
        type: 'OAuth2',
        user: process.env.SMTP_USER || '',
        clientId: process.env.OAUTH_CLIENT_ID || '',
        clientSecret: process.env.OAUTH_CLIENT_SECRET || '',
        refreshToken: process.env.OAUTH_REFRESH_TOKEN || '',
        accessToken: process.env.OAUTH_ACCESS_TOKEN || '', // Optional, will be refreshed automatically
        expires: parseInt(process.env.OAUTH_ACCESS_TOKEN_EXPIRES || '0', 10), // Token expiration timestamp
      };
    } else {
      // Password authentication (traditional)
      authConfig = {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASSWORD || '',
      };
    }

    this.smtpConfig = {
      host: process.env.SMTP_HOST || 'smtp.office365.com', // Default to Office365 (most common for business emails)
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: authConfig,
      // Add connection timeout settings
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 10000,
      // Try to bypass some network restrictions
      tls: {
        rejectUnauthorized: false // Only set to false if you trust the SMTP server
      }
    };

    // Default sender email
    this.defaultFrom = process.env.SMTP_FROM || process.env.SMTP_USER || '';

    // Create transporter (reused for all emails) - only if using SMTP
    this.transporter = null;
    if (this.emailProvider === 'smtp') {
      this.initializeTransporter();
    } else if (this.emailProvider === 'sendgrid') {
      console.log('[EmailHelper] Using SendGrid API (HTTP/HTTPS, not SMTP ports)');
      if (!this.sendGridApiKey) {
        console.warn('[EmailHelper] SENDGRID_API_KEY not set. Email sending will fail.');
      }
    }
  }

  /**
   * Initialize the email transporter
   */
  initializeTransporter() {
    try {
      const authType = this.smtpConfig.auth.type || (this.smtpConfig.auth.pass ? 'password' : 'oauth2');
      
      if (authType === 'oauth2') {
        // OAuth 2.0 validation
        if (!this.smtpConfig.auth.user || !this.smtpConfig.auth.clientId || !this.smtpConfig.auth.clientSecret || !this.smtpConfig.auth.refreshToken) {
          console.warn('[EmailHelper] OAuth 2.0 credentials not fully configured.');
          console.warn('[EmailHelper] Required: SMTP_USER, OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_REFRESH_TOKEN');
        }
        console.log('[EmailHelper] SMTP Configuration (OAuth 2.0):', {
          host: this.smtpConfig.host,
          port: this.smtpConfig.port,
          secure: this.smtpConfig.secure,
          user: this.smtpConfig.auth.user,
          authType: 'OAuth2',
          hasClientId: !!this.smtpConfig.auth.clientId,
          hasRefreshToken: !!this.smtpConfig.auth.refreshToken
        });
      } else {
        // Password authentication validation
        if (!this.smtpConfig.auth.user || !this.smtpConfig.auth.pass) {
          console.warn('[EmailHelper] SMTP credentials not configured. Email sending will fail.');
          console.warn('[EmailHelper] Please set SMTP_USER and SMTP_PASSWORD in .env file');
        }
        console.log('[EmailHelper] SMTP Configuration (Password):', {
          host: this.smtpConfig.host,
          port: this.smtpConfig.port,
          secure: this.smtpConfig.secure,
          user: this.smtpConfig.auth.user,
          hasPassword: !!this.smtpConfig.auth.pass
        });
      }
      
      this.transporter = nodemailer.createTransport(this.smtpConfig);
      console.log('[EmailHelper] Email transporter initialized');
    } catch (error) {
      console.error('[EmailHelper] Error initializing transporter:', error);
      this.transporter = null;
    }
  }

  /**
   * Test SMTP connection and configuration
   * @returns {Promise<Object>} Test result with diagnostics
   */
  async testConnection() {
    const diagnostics = {
      configValid: true,
      errors: [],
      warnings: [],
      info: {},
    };

    // Check configuration
    if (!this.smtpConfig.auth.user) {
      diagnostics.configValid = false;
      diagnostics.errors.push('SMTP_USER is not set');
    }
    if (!this.smtpConfig.auth.pass && this.emailProvider === 'smtp') {
      diagnostics.configValid = false;
      diagnostics.errors.push('SMTP_PASSWORD is not set');
    }

    // Check for common configuration issues
    const emailDomain = this.smtpConfig.auth.user?.split('@')[1] || '';
    
    if (emailDomain.includes('gmail.com') && !this.smtpConfig.host.includes('gmail')) {
      diagnostics.warnings.push(`Using Gmail address but SMTP_HOST is ${this.smtpConfig.host}. Should be smtp.gmail.com`);
    }
    
    if ((emailDomain.includes('outlook.com') || emailDomain.includes('office365.com')) && !this.smtpConfig.host.includes('office365')) {
      diagnostics.warnings.push(`Using Outlook/Office365 address but SMTP_HOST is ${this.smtpConfig.host}. Should be smtp.office365.com`);
    }

    // If using custom domain, check if it might need Google Workspace or Office365
    if (emailDomain && !emailDomain.includes('gmail.com') && !emailDomain.includes('outlook.com') && !emailDomain.includes('office365.com')) {
      if (this.smtpConfig.host.includes('gmail.com')) {
        diagnostics.info.googleWorkspace = 'Using smtp.gmail.com with custom domain - verify you are using Google Workspace';
      } else if (this.smtpConfig.host.includes('office365.com')) {
        diagnostics.info.microsoft365 = 'Using smtp.office365.com with custom domain - verify you are using Microsoft 365';
      }
    }

    diagnostics.info.config = {
      host: this.smtpConfig.host,
      port: this.smtpConfig.port,
      secure: this.smtpConfig.secure,
      user: this.smtpConfig.auth.user,
      emailProvider: this.emailProvider,
    };

    // Test actual connection if using SMTP
    if (this.emailProvider === 'smtp' && diagnostics.configValid && this.transporter) {
      try {
        await this.transporter.verify();
        diagnostics.info.connection = 'SUCCESS';
        diagnostics.info.message = 'SMTP server is ready to accept messages';
      } catch (error) {
        diagnostics.info.connection = 'FAILED';
        diagnostics.errors.push(`Connection test failed: ${error.message}`);
        diagnostics.info.errorCode = error.code;
        diagnostics.info.errorDetails = {
          message: error.message,
          code: error.code,
        };
      }
    } else if (this.emailProvider === 'sendgrid') {
      diagnostics.info.connection = 'SKIPPED';
      diagnostics.info.message = 'Using SendGrid API (no SMTP connection test needed)';
    }

    return {
      success: diagnostics.configValid && diagnostics.info.connection === 'SUCCESS',
      diagnostics,
    };
  }

  /**
   * Send email using SendGrid API
   * @param {Object} options - Email options
   * @returns {Promise<Object>} Result object
   */
  async sendEmailViaSendGrid(options) {
    const {
      to,
      subject,
      html,
      text,
      from = this.sendGridFromEmail,
      fromName = this.sendGridFromName,
    } = options;

    if (!this.sendGridApiKey) {
      return {
        success: false,
        error: 'SENDGRID_API_KEY not configured',
      };
    }

    try {
      const emailData = {
        personalizations: [{
          to: Array.isArray(to) ? to.map(email => ({ email })) : [{ email: to }],
          subject,
        }],
        from: {
          email: from,
          name: fromName,
        },
        content: [
          {
            type: 'text/html',
            value: html || text,
          },
        ],
      };

      // Add plain text if provided
      if (text && html) {
        emailData.content.push({
          type: 'text/plain',
          value: text,
        });
      }

      const response = await axios.post(
        'https://api.sendgrid.com/v3/mail/send',
        emailData,
        {
          headers: {
            'Authorization': `Bearer ${this.sendGridApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      console.log('[EmailHelper] Email sent via SendGrid:', {
        to,
        subject,
        statusCode: response.status,
      });

      return {
        success: true,
        messageId: response.headers['x-message-id'] || 'sendgrid-sent',
        provider: 'sendgrid',
      };
    } catch (error) {
      console.error('[EmailHelper] Error sending email via SendGrid:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errors?.[0]?.message || error.message || 'Unknown error sending email via SendGrid',
        details: error.response?.data || error,
      };
    }
  }

  /**
   * Send email
   * @param {Object} options - Email options
   * @param {string|Array} options.to - Recipient email(s)
   * @param {string} options.subject - Email subject
   * @param {string} options.html - HTML content
   * @param {string} options.text - Plain text content (optional)
   * @param {string} options.from - Sender email (optional, uses default if not provided)
   * @param {Array} options.attachments - Email attachments (optional)
   * @returns {Promise<Object>} Result object with success status and message/info
   */
  async sendEmail(options) {
    const {
      to,
      subject,
      html,
      text,
      from = this.defaultFrom,
      attachments = [],
    } = options;

    // Validate required fields
    if (!to || !subject || (!html && !text)) {
      return {
        success: false,
        error: 'Missing required email fields: to, subject, and html/text are required',
      };
    }

    // Use SendGrid if configured
    if (this.emailProvider === 'sendgrid') {
      return this.sendEmailViaSendGrid({ to, subject, html, text, from });
    }

    // Fallback to SMTP
    // Check if transporter is initialized
    if (!this.transporter) {
      console.error('[EmailHelper] Transporter not initialized');
      return {
        success: false,
        error: 'Email transporter not initialized. Check SMTP configuration.',
      };
    }

    try {
      const mailOptions = {
        from: `"Aquatech" <${from}>`,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html: html || text,
        text: text || html?.replace(/<[^>]*>/g, ''), // Strip HTML if only html provided
        attachments,
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('[EmailHelper] Email sent successfully:', {
        to,
        subject,
        messageId: info.messageId,
      });

      return {
        success: true,
        messageId: info.messageId,
        info,
      };
    } catch (error) {
      console.error('[EmailHelper] Error sending email:', error);
      return {
        success: false,
        error: error.message || 'Unknown error sending email',
        details: error,
      };
    }
  }

  /**
   * Send password reset email
   * @param {Object} options - Password reset options
   * @param {string} options.to - Recipient email
   * @param {string} options.resetToken - Password reset token
   * @param {string} options.userName - User's name (optional)
   * @param {string} options.resetUrl - Full URL for password reset (optional, will generate if not provided)
   * @returns {Promise<Object>} Result object
   */
  async sendPasswordResetEmail(options) {
    const {
      to,
      resetToken,
      userName = 'Usuario',
      resetUrl,
    } = options;

    // Generate reset URL if not provided
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const finalResetUrl = resetUrl || `${frontendUrl}/reset-password?token=${resetToken}`;

    const subject = 'Recuperación de Contraseña - Aquatech';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #f9f9f9;
            padding: 30px;
            border-radius: 8px;
            border: 1px solid #e0e0e0;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #1976d2;
            margin: 0;
          }
          .content {
            background-color: white;
            padding: 25px;
            border-radius: 5px;
            margin-bottom: 20px;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            background-color: #1976d2;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
            font-weight: bold;
          }
          .button:hover {
            background-color: #1565c0;
          }
          .footer {
            text-align: center;
            color: #666;
            font-size: 12px;
            margin-top: 20px;
          }
          .warning {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Aquatech</h1>
          </div>
          <div class="content">
            <p>Hola ${userName},</p>
            <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.</p>
            <p>Para continuar con el proceso, haz clic en el siguiente botón:</p>
            <div style="text-align: center;">
              <a href="${finalResetUrl}" class="button">Restablecer Contraseña</a>
            </div>
            <p>O copia y pega el siguiente enlace en tu navegador:</p>
            <p style="word-break: break-all; color: #1976d2;">${finalResetUrl}</p>
            <div class="warning">
              <strong>⚠️ Importante:</strong>
              <ul>
                <li>Este enlace expirará en 1 hora</li>
                <li>Si no solicitaste este cambio, ignora este correo</li>
                <li>Tu contraseña no cambiará hasta que completes el proceso</li>
              </ul>
            </div>
          </div>
          <div class="footer">
            <p>Este es un correo automático, por favor no respondas.</p>
            <p>&copy; ${new Date().getFullYear()} Aquatech. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject,
      html,
    });
  }

  /**
   * Send alert notification email
   * @param {Object} options - Alert notification options
   * @param {string|Array} options.to - Recipient email(s)
   * @param {string} options.alertType - Type of alert (preventivo, correctivo)
   * @param {string} options.metricName - Name of the metric
   * @param {string} options.message - Alert message
   * @param {Object} options.sensorData - Sensor data (optional)
   * @returns {Promise<Object>} Result object
   */
  async sendAlertEmail(options) {
    const {
      to,
      alertType,
      metricName,
      message,
      sensorData = {},
    } = options;

    const alertTypeLabel = alertType === 'preventivo' ? 'Preventivo' : 'Correctivo';
    const alertColor = alertType === 'preventivo' ? '#FFFF00' : '#EE0000';
    const alertBgColor = alertType === 'preventivo' ? '#fff3cd' : '#f8d7da';

    const subject = `Alerta ${alertTypeLabel}: ${metricName} - Aquatech`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #f9f9f9;
            padding: 30px;
            border-radius: 8px;
            border: 1px solid #e0e0e0;
          }
          .alert-box {
            background-color: ${alertBgColor};
            border-left: 4px solid ${alertColor};
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .alert-title {
            color: ${alertColor};
            font-weight: bold;
            font-size: 18px;
            margin-bottom: 10px;
          }
          .data-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
          }
          .data-table td {
            padding: 8px;
            border-bottom: 1px solid #ddd;
          }
          .data-table td:first-child {
            font-weight: bold;
            width: 40%;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Aquatech - Alerta del Sistema</h1>
          <div class="alert-box">
            <div class="alert-title">Alerta ${alertTypeLabel}</div>
            <p><strong>Métrica:</strong> ${metricName}</p>
            <p>${message}</p>
          </div>
          ${Object.keys(sensorData).length > 0 ? `
            <h3>Datos del Sensor:</h3>
            <table class="data-table">
              ${Object.entries(sensorData).map(([key, value]) => `
                <tr>
                  <td>${key}</td>
                  <td>${value}</td>
                </tr>
              `).join('')}
            </table>
          ` : ''}
          <p style="margin-top: 20px; color: #666; font-size: 12px;">
            Este es un correo automático del sistema de alertas de Aquatech.
          </p>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject,
      html,
    });
  }

  /**
   * Send generic notification email
   * @param {Object} options - Notification options
   * @param {string|Array} options.to - Recipient email(s)
   * @param {string} options.subject - Email subject
   * @param {string} options.message - Notification message
   * @param {string} options.title - Notification title (optional)
   * @returns {Promise<Object>} Result object
   */
  async sendNotificationEmail(options) {
    const {
      to,
      subject,
      message,
      title = 'Notificación',
    } = options;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #f9f9f9;
            padding: 30px;
            border-radius: 8px;
            border: 1px solid #e0e0e0;
          }
          .content {
            background-color: white;
            padding: 25px;
            border-radius: 5px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Aquatech</h1>
          <div class="content">
            <h2>${title}</h2>
            <p>${message}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject,
      html,
    });
  }
}

// Export singleton instance
const emailHelper = new EmailHelper();
export default emailHelper;

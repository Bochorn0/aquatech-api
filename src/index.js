// src/index.js

import dotenv from 'dotenv';  // Use `import` for dotenv
dotenv.config();

import express from 'express';  // Import express
import cors from 'cors';  // Import cors
import helmet from 'helmet';  // Import helmet
import morgan from 'morgan';  // Import morgan
import mongoose from 'mongoose';  // Import mongoose
import bodyParser from 'body-parser';  // Import body-parser

import notificationRoutes from './routes/notification.routes.js';  // Use `import` for notificationRoutes
import metricRoutes from './routes/metric.routes.js';  // Use `import` for metricRoutes
import cityRoutes from './routes/city.routes.js';  // Use `import` for metricRoutes
import dashboardRoutes from './routes/dashboard.routes.js';  // Use `import` for dashboardRoutes
import productRoutes from './routes/product.routes.js';  // Use `import` for productRoutes
import userRoutes from './routes/user.routes.js';  // Use `import` for userRoutes
import roleRoutes from './routes/role.routes.js';  // Use `import` for roleRoutes
import clientRoutes from './routes/client.routes.js';  // Use `import` for clientRoutes'
import reportRoutes from './routes/report.routes.js';  // Use `import` for reportRoutes
import controllerRoutes from './routes/controller.routes.js' // Use `import` for controllerRouters
import puntoVentaRoutes from './routes/puntoVenta.routes.js' // Use `import` for PuntoVenta
import sensorDataRoutes from './routes/sensorData.routes.js';  // Use `import` for sensorDataRoutes
import sensorDataV2Routes from './routes/sensorDataV2.routes.js';  // Use `import` for sensorDataV2Routes (v2.0)
import customizationV2Routes from './routes/customizationV2.routes.js';  // Use `import` for customizationV2Routes (v2.0)
import tiwaterProductRoutes from './routes/tiwater-product.routes.js';  // Use `import` for TI Water product routes (v2.0)
import tiwaterQuoteRoutes from './routes/tiwater-quote.routes.js';  // Use `import` for TI Water quote routes (v2.0)
import authRoutes from './routes/auth.routes.js';  // Use `import` for authRoutes
import mqttRoutes from './routes/mqtt.routes.js';  // Use `import` for mqttRoutes
import { authenticate, authorizeRoles } from './middlewares/auth.middleware.js';  // Import the authentication and authorization middleware
import mqttService from './services/mqtt.service.js';  // Import MQTT service
import emailHelper from './utils/email.helper.js';  // Import email helper for test endpoint

const app = express();
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/health', (req, res) => {
  res.json({ message: 'API Working' });
});

// Test SMTP connection endpoint (for debugging) - supports both GET and POST
const testSmtpHandler = async (req, res) => {
  try {
    const sendEmail = req.query.send !== 'false' && req.body?.send !== false;
    const emailTo = req.query.to || req.body?.to || process.env.SMTP_USER || 'soporte@lcc.com.mx';
    
    console.log('[test-smtp] SMTP Config:', {
      host: process.env.SMTP_HOST || 'smtp.office365.com',
      port: process.env.SMTP_PORT || '587',
      user: process.env.SMTP_USER || 'soporte@lcc.com.mx',
      provider: process.env.EMAIL_PROVIDER || 'smtp',
      sendEmail: sendEmail
    });
    
    // First, test connection
    const connectionTest = await emailHelper.testConnection();
    
    // If connection test fails, return diagnostics without trying to send
    if (!connectionTest.success && !sendEmail) {
      const diagnostics = connectionTest.diagnostics;
      const troubleshooting = [];
      
      // Add troubleshooting tips based on error type
      if (diagnostics.info?.errorCode === 'ETIMEDOUT' || diagnostics.info?.errorCode === 'ECONNREFUSED') {
        troubleshooting.push({
          issue: 'Connection Timeout',
          steps: [
            'Check if firewall is blocking outbound SMTP ports (587, 465)',
            `Test network connectivity: nc -zv ${process.env.SMTP_HOST || 'smtp.office365.com'} ${process.env.SMTP_PORT || '587'}`,
            'Try port 465 with SSL: SMTP_PORT=465, SMTP_SECURE=true',
            'Consider using SendGrid API: EMAIL_PROVIDER=sendgrid'
          ]
        });
      } else if (diagnostics.info?.errorCode === 'EAUTH' || diagnostics.errors?.some(e => e.includes('authentication'))) {
        troubleshooting.push({
          issue: 'Authentication Error',
          steps: [
            'Verify SMTP_USER and SMTP_PASSWORD are correct',
            'For Gmail with 2FA: Use App Password instead of regular password',
            'For Google Workspace: Check Admin Console > Security settings',
            'For Office365 with 2FA: May need OAuth 2.0 authentication'
          ]
        });
      }
      
      // Check for custom domain and suggest Google Workspace/Office365 setup
      const emailDomain = process.env.SMTP_USER?.split('@')[1] || '';
      if (emailDomain && !emailDomain.includes('gmail.com') && !emailDomain.includes('outlook.com') && !emailDomain.includes('office365.com')) {
        troubleshooting.push({
          issue: 'Custom Domain Detected',
          note: `Your email domain is ${emailDomain}`,
          options: {
            googleWorkspace: {
              host: 'smtp.gmail.com',
              port: 587,
              secure: false,
              note: 'If using Google Workspace, use smtp.gmail.com. Check Admin Console for SMTP settings.'
            },
            microsoft365: {
              host: 'smtp.office365.com',
              port: 587,
              secure: false,
              note: 'If using Microsoft 365, use smtp.office365.com. Verify SMTP is enabled in Admin Center.'
            },
            customServer: {
              host: `smtp.${emailDomain}`,
              port: 587,
              secure: false,
              note: `If using custom mail server, try smtp.${emailDomain} or mail.${emailDomain}. Contact your email administrator.`
            }
          }
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        message: 'SMTP connection test failed',
        diagnostics: connectionTest.diagnostics,
        troubleshooting: troubleshooting.length > 0 ? troubleshooting : undefined,
        suggestion: 'Check configuration and try again. Use ?send=true to attempt sending anyway.'
      });
    }
    
    // If sendEmail is true, attempt to send test email
    if (sendEmail) {
      const testResult = await emailHelper.sendEmail({
        to: emailTo,
        subject: 'Test Email from Aquatech API',
        html: `
          <h2>✅ Test Email - Configuration Verified</h2>
          <p>This is a test email to verify your SMTP configuration is working correctly.</p>
          <p><strong>Configuration Details:</strong></p>
          <ul>
            <li>Host: ${process.env.SMTP_HOST || 'smtp.office365.com'}</li>
            <li>Port: ${process.env.SMTP_PORT || '587'}</li>
            <li>Secure: ${process.env.SMTP_SECURE || 'false'}</li>
            <li>Provider: ${process.env.EMAIL_PROVIDER || 'smtp'}</li>
            <li>Sent at: ${new Date().toISOString()}</li>
          </ul>
          <p>If you received this email, your configuration is correct! 🎉</p>
        `,
      });
      
      if (testResult.success) {
        return res.json({ 
          success: true, 
          message: 'SMTP connection successful! Test email sent.',
          connectionTest: connectionTest.diagnostics,
          emailResult: testResult,
          sentTo: emailTo
        });
      } else {
        const troubleshooting = [];
        if (testResult.error?.includes('timeout') || testResult.error?.includes('ETIMEDOUT')) {
          troubleshooting.push({
            issue: 'Email Send Timeout',
            steps: [
              'Connection test passed but sending timed out',
              'Check if recipient email is valid',
              'Verify SMTP server allows sending to this address',
              'Try again - may be temporary network issue'
            ]
          });
        } else if (testResult.error?.includes('authentication') || testResult.error?.includes('EAUTH')) {
          troubleshooting.push({
            issue: 'Authentication Failed During Send',
            steps: [
              'Connection test passed but authentication failed when sending',
              'Verify SMTP_PASSWORD is correct',
              'For Gmail: May need App Password if 2FA is enabled',
              'For Office365: Check if account has sending permissions'
            ]
          });
        }
        
        return res.status(500).json({ 
          success: false, 
          message: 'Connection test passed but email sending failed',
          connectionTest: connectionTest.diagnostics,
          emailError: testResult.error,
          emailDetails: testResult,
          troubleshooting: troubleshooting.length > 0 ? troubleshooting : undefined,
          config: {
            host: process.env.SMTP_HOST || 'smtp.office365.com',
            port: process.env.SMTP_PORT || '587',
            provider: process.env.EMAIL_PROVIDER || 'smtp'
          }
        });
      }
    } else {
      // Just return connection test results
      return res.json({
        success: connectionTest.success,
        message: connectionTest.success 
          ? 'SMTP connection test passed. Use ?send=true to send a test email.'
          : 'SMTP connection test failed. Check diagnostics below.',
        diagnostics: connectionTest.diagnostics
      });
    }
  } catch (error) {
    console.error('[test-smtp] Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error testing SMTP',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

app.get('/api/v1.0/test-smtp', testSmtpHandler);
app.post('/api/v1.0/test-smtp', testSmtpHandler);

// MQTT Status endpoint
// NOTA: Este endpoint solo verifica el estado, no inicia MQTT
// MQTT corre como proceso separado (mqtt-consumer.js) en PM2
app.get('/api/v1.0/mqtt/status', (req, res) => {
  const status = mqttService.getConnectionStatus();
  res.json({
    message: 'MQTT Service Status (MQTT corre como proceso separado)',
    note: 'MQTT consumer se ejecuta como instancia separada en PM2',
    ...status
  });
});

// Apply authentication middleware to any route that needs protection
// Example: Protect the `/api/v1.0/dashboard` route
app.use('/api/v1.0/dashboard', authenticate, authorizeRoles('admin', 'cliente'), dashboardRoutes);

// Example: Protect the `/api/v1.0/dashboard` route
app.use('/api/v1.0/notifications', authenticate, authorizeRoles('admin', 'cliente'), notificationRoutes);

// Example: Protect the `/api/v1.0/products` route for both 'admin' and 'manager' roles
app.use('/api/v1.0/products', authenticate, authorizeRoles('admin', 'cliente'), productRoutes);

// Example: Protect the `/api/v1.0/users` route for 'admin' only
app.use('/api/v1.0/users', authenticate, authorizeRoles('admin', 'cliente'), userRoutes);

// Example: Protect the `/api/v1.0/roles` route for 'admin' only
app.use('/api/v1.0/roles', authenticate, authorizeRoles('admin', 'cliente'), roleRoutes);

// Example: Protect the `/api/v1.0/users` route for 'admin' only
app.use('/api/v1.0/clients', authenticate, authorizeRoles('admin', 'cliente'), clientRoutes);

// Example: Protect the `/api/v1.0/reportes` route for both 'admin' and 'manager' roles
app.use('/api/v1.0/reportes', authenticate, authorizeRoles('admin', 'cliente'), reportRoutes);

// Example: Protect the `/api/v1.0/metrics` route for 'admin' only
app.use('/api/v1.0/metrics', authenticate, authorizeRoles('admin', 'cliente'), metricRoutes);

// Example: Protect the `/api/v1.0/cities` route for 'admin' only
app.use('/api/v1.0/cities', authenticate, authorizeRoles('admin', 'cliente'), cityRoutes);

// Example: Protect the `/api/v1.0/controller` route for 'admin' only
app.use('/api/v1.0/controllers', authenticate, authorizeRoles('admin', 'cliente'), controllerRoutes);

// Example: Protect the `/api/v1.0/puntoVenta` route for 'admin' only
app.use('/api/v1.0/puntoVentas', authenticate, authorizeRoles('admin', 'cliente'), puntoVentaRoutes);

// Example: Protect the `/api/v1.0/sensor-data` route for 'admin' and 'cliente'
app.use('/api/v1.0/sensor-data', authenticate, authorizeRoles('admin', 'cliente'), sensorDataRoutes);

// v2.0 API routes - PostgreSQL based
// IMPORTANT: TI Water routes must come BEFORE the generic /api/v2.0 route
// Otherwise /api/v2.0 will catch /api/v2.0/tiwater requests first
app.use('/api/v2.0/tiwater/products', tiwaterProductRoutes);
app.use('/api/v2.0/tiwater/quotes', tiwaterQuoteRoutes);

// v2.0 API routes - Customization (metrics, clients, cities, puntosVenta, sensors)
// IMPORTANT: customizationV2Routes must come before sensorDataV2Routes to handle /puntoVentas/:id/sensors
app.use('/api/v2.0', authenticate, authorizeRoles('admin', 'cliente'), customizationV2Routes);
// v2.0 API routes - PostgreSQL based (sensors - must come after customization routes)
app.use('/api/v2.0/sensors', authenticate, authorizeRoles('admin', 'cliente'), sensorDataV2Routes);
app.use('/api/v2.0', authenticate, authorizeRoles('admin', 'cliente'), sensorDataV2Routes);

// Example: Protect the `/api/v1.0/users` route for 'admin' only
app.use('/api/v1.0/auth', authRoutes);

// MQTT routes (certificado download, etc.)
app.use('/api/v1.0/mqtt', mqttRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Database connection
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('Connected to MongoDB');
    
    // NOTA: MQTT ahora corre como proceso separado (mqtt-consumer.js)
    // No iniciar MQTT aquí para evitar duplicados
    // El consumidor MQTT se ejecuta como instancia separada en PM2
    console.log('ℹ️  MQTT se ejecuta como proceso separado (mqtt-consumer)');
  })
  .catch((err) => console.error('MongoDB connection error:', err));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Manejar cierre graceful
process.on('SIGINT', () => {
  console.log('\nCerrando servidor...');
  // No desconectar MQTT aquí - corre como proceso separado
  mongoose.connection.close();
  process.exit(0);
});

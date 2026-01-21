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

// Test SMTP connection endpoint (for debugging)
app.get('/api/v1.0/test-smtp', async (req, res) => {
  try {
    const testResult = await emailHelper.sendEmail({
      to: process.env.SMTP_USER || 'soporte@lcc.com.mx',
      subject: 'Test Email from Aquatech API',
      html: '<p>This is a test email to verify SMTP configuration.</p>',
    });
    
    if (testResult.success) {
      res.json({ 
        success: true, 
        message: 'SMTP connection successful! Test email sent.',
        details: testResult 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'SMTP connection failed',
        error: testResult.error,
        details: testResult 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error testing SMTP',
      error: error.message 
    });
  }
});

// MQTT Status endpoint
app.get('/api/v1.0/mqtt/status', (req, res) => {
  const status = mqttService.getConnectionStatus();
  res.json({
    message: 'MQTT Service Status',
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
    
    // Iniciar servicio MQTT después de conectar a MongoDB
    mqttService.connect();
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
  mqttService.disconnect();
  mongoose.connection.close();
  process.exit(0);
});

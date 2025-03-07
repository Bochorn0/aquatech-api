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
import clientRoutes from './routes/client.routes.js';  // Use `import` for clientRoutes
import reportRoutes from './routes/report.routes.js';  // Use `import` for reportRoutes
import authRoutes from './routes/auth.routes.js';  // Use `import` for authRoutes
import { authenticate, authorizeRoles } from './middlewares/auth.middleware.js';  // Import the authentication and authorization middleware

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

// Apply authentication middleware to any route that needs protection
// Example: Protect the `/api/v1.0/dashboard` route
app.use('/api/v1.0/dashboard', authenticate, authorizeRoles('admin', 'user'), dashboardRoutes);

// Example: Protect the `/api/v1.0/dashboard` route
app.use('/api/v1.0/notifications', authenticate, authorizeRoles('admin', 'user'), notificationRoutes);

// Example: Protect the `/api/v1.0/products` route for both 'admin' and 'manager' roles
app.use('/api/v1.0/products', authenticate, authorizeRoles('admin', 'user'), productRoutes);

// Example: Protect the `/api/v1.0/users` route for 'admin' only
app.use('/api/v1.0/users', authenticate, authorizeRoles('admin', 'user'), userRoutes);

// Example: Protect the `/api/v1.0/users` route for 'admin' only
app.use('/api/v1.0/clients', authenticate, authorizeRoles('admin', 'user'), clientRoutes);

// Example: Protect the `/api/v1.0/reportes` route for both 'admin' and 'manager' roles
app.use('/api/v1.0/reportes', authenticate, authorizeRoles('admin', 'user'), reportRoutes);

// Example: Protect the `/api/v1.0/metrics` route for 'admin' only
app.use('/api/v1.0/metrics', authenticate, authorizeRoles('admin'), metricRoutes);

// Example: Protect the `/api/v1.0/cities` route for 'admin' only
app.use('/api/v1.0/cities', authenticate, authorizeRoles('admin'), cityRoutes);

// Example: Protect the `/api/v1.0/users` route for 'admin' only
app.use('/api/v1.0/auth', authRoutes);

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
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

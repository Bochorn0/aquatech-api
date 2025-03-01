// src/index.js

import dotenv from 'dotenv';  // Use `import` for dotenv
dotenv.config();

import express from 'express';  // Import express
import cors from 'cors';  // Import cors
import helmet from 'helmet';  // Import helmet
import morgan from 'morgan';  // Import morgan
import mongoose from 'mongoose';  // Import mongoose

import dashboardRoutes from './routes/dashboard.routes.js';  // Use `import` for dashboardRoutes
import productRoutes from './routes/product.routes.js';  // Use `import` for productRoutes
import userRoutes from './routes/user.routes.js';  // Use `import` for userRoutes
import reportRoutes from './routes/report.routes.js';  // Use `import` for reportRoutes
import authRoutes from './routes/auth.routes.js';  // Use `import` for authRoutes
import { authenticate, authorizeRoles } from './middlewares/auth.middleware.js';  // Import the authentication and authorization middleware

const app = express();

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
// Example: Protect the `/api/dashboard` route
app.use('/api/dashboard', authenticate, authorizeRoles('admin'), dashboardRoutes);

// Example: Protect the `/api/products` route for both 'admin' and 'manager' roles
app.use('/api/products', authenticate, authorizeRoles('admin', 'manager'), productRoutes);

// Example: Protect the `/api/users` route for 'admin' only
app.use('/api/users', authenticate, authorizeRoles('admin'), userRoutes);

// Example: Protect the `/api/reportes` route for both 'admin' and 'manager' roles
app.use('/api/reportes', authenticate, authorizeRoles('admin', 'manager'), reportRoutes);

// Example: Protect the `/api/users` route for 'admin' only
app.use('/api/auth', authRoutes);

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

// src/routes/product.routes.js
import { Router } from 'express';
import { getAllProducts, generateAllProducts, getProductById, getProductMetrics, getProductLogsById, sendDeviceCommands } from '../controllers/product.controller.js'; // Named imports
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = Router();

// Get all products
router.get('/', authenticate, getAllProducts);

// get multiple mocked
router.get('/mocked', authenticate, generateAllProducts);

// Get specific product by ID
router.get('/:id', authenticate, getProductById);

// Get specific product logs by ID
router.get('/:id/logs', authenticate, getProductLogsById);

// Get product metrics
router.get('/:id/metrics', authenticate, getProductMetrics);

// Get product metrics
router.get('/sendCommand', authenticate, authorizeRoles('admin'), sendDeviceCommands);

export default router;

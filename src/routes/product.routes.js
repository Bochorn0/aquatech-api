// src/routes/product.routes.js
import { Router } from 'express';
import { getAllProducts, generateAllProducts, getProductById, getProductMetrics, getProductLogsById, sendDeviceCommands } from '../controllers/product.controller.js'; // Named imports

const router = Router();

// Get all products
router.get('/', getAllProducts);

// get multiple mocked
router.get('/mocked', generateAllProducts);

// Get specific product by ID
router.get('/:id', getProductById);

// Get specific product logs by ID
router.get('/:id/logs', getProductLogsById);

// Get product metrics
router.get('/:id/metrics', getProductMetrics);

// Get product metrics
router.post('/sendCommand', sendDeviceCommands);

export default router;

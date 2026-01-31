// src/routes/product.routes.js
import { Router } from 'express';
import { getAllProducts, generateAllProducts, getProductById, getProductMetrics, getProductLogsById, sendDeviceCommands, saveAllProducts, componentInput, fetchLogsRoutine, generarLogsPorFecha, updateProduct } from '../controllers/product.controller.js'; // Named imports
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = Router();

// Get all products
router.get('/', authenticate, getAllProducts);

// get multiple mocked
router.get('/mocked', authenticate, generateAllProducts);

// Get specific product by ID
router.get('/:id', authenticate, getProductById);

// Update product (cliente, city, product_type) - for Equipos / personalización
router.patch('/:id', authenticate, authorizeRoles('admin', 'cliente'), updateProduct);

// Get specific product logs by ID
router.get('/:id/logs', authenticate, getProductLogsById);

// Get product metrics
router.get('/:id/metrics', authenticate, getProductMetrics);

// Get product metrics
router.post('/sendCommand', authenticate, authorizeRoles('admin'), sendDeviceCommands);

// storage All products
router.post('/saveAllProducts', authenticate, authorizeRoles('admin'), saveAllProducts);

// Test ESP32 DAta
router.post('/componentInput', authenticate, authorizeRoles('admin'), componentInput);

// Fetch logs routine - Manual trigger endpoint
router.post('/fetchLogsRoutine', authenticate, fetchLogsRoutine);

// fetch reporte por fechas 
router.post('/generarLogsPorFecha', authenticate, generarLogsPorFecha);

export default router;

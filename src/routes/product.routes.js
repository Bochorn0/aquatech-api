// src/routes/product.routes.js
import { Router } from 'express';
import { getAllProducts, generateAllProducts, getProductById, getProductMetrics, getProductLogsById, sendDeviceCommands, saveAllProducts, componentInput, fetchLogsRoutine, generarLogsPorFecha, updateProduct, deleteProduct } from '../controllers/product.controller.js'; // Named imports
import { authenticate, requirePermission, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = Router();

// Get all products
router.get('/', authenticate, getAllProducts);

// get multiple mocked
router.get('/mocked', authenticate, generateAllProducts);

// Get specific product by ID
router.get('/:id', authenticate, getProductById);

// Update product (cliente, city, product_type) - for Equipos / personalización (access by permission at mount)
router.patch('/:id', authenticate, updateProduct);

// Delete product - admin only (Personalización v1 > Equipos tab)
router.delete('/:id', authenticate, authorizeRoles('admin'), deleteProduct);

// Get specific product logs by ID
router.get('/:id/logs', authenticate, getProductLogsById);

// Get product metrics
router.get('/:id/metrics', authenticate, getProductMetrics);

// Write / commands: require /equipos
router.post('/sendCommand', authenticate, requirePermission('/equipos'), sendDeviceCommands);
router.post('/saveAllProducts', authenticate, requirePermission('/equipos'), saveAllProducts);
router.post('/componentInput', authenticate, requirePermission('/equipos'), componentInput);

// Fetch logs routine - Manual trigger endpoint
router.post('/fetchLogsRoutine', authenticate, fetchLogsRoutine);

// fetch reporte por fechas 
router.post('/generarLogsPorFecha', authenticate, generarLogsPorFecha);

export default router;

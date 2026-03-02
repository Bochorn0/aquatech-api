// src/routes/product.routes.js
import { Router } from 'express';
import { getAllProducts, generateAllProducts, getProductById, getProductMetrics, getProductLogsById, sendDeviceCommands, saveAllProducts, componentInput, fetchLogsRoutine, generarLogsPorFecha, updateProduct, deleteProduct } from '../controllers/product.controller.js'; // Named imports
import { authenticate, requirePermission, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = Router();

// Cron or JWT: allow X-Cron-Secret or X-TIWater-API-Key for scheduled jobs (e.g. Azure Logic Apps, Azure Functions, external cron)
const cronOrAuthForLogsRoutine = (req, res, next) => {
  const secret = req.headers['x-cron-secret'];
  const apiKey = req.headers['x-tiwater-api-key'] || req.headers['x-api-key'];
  const validSecret = process.env.CRON_TUYA_LOGS_SECRET || process.env.CRON_DEV_MODE_SECRET || process.env.TIWATER_API_KEY;
  const validApiKey = process.env.TIWATER_API_KEY;
  if ((secret && validSecret && secret === validSecret) || (apiKey && validApiKey && apiKey === validApiKey)) {
    return next();
  }
  authenticate(req, res, (err) => {
    if (err) return next(err);
    requirePermission('/', '/equipos')(req, res, next);
  });
};

/**
 * Mount-level middleware: for POST /fetchLogsRoutine allow X-Cron-Secret or X-TIWater-API-Key so Azure/external cron can call without JWT.
 */
export const productAuthOrCron = (req, res, next) => {
  if (req.path === '/fetchLogsRoutine' && req.method === 'POST') {
    return cronOrAuthForLogsRoutine(req, res, next);
  }
  authenticate(req, res, (err) => {
    if (err) return next(err);
    requirePermission('/', '/equipos')(req, res, next);
  });
};

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

// Fetch logs routine - Manual (JWT) or cron (X-Cron-Secret / X-TIWater-API-Key). Schedule e.g. every 30 min in Azure.
router.post('/fetchLogsRoutine', cronOrAuthForLogsRoutine, fetchLogsRoutine);

// fetch reporte por fechas 
router.post('/generarLogsPorFecha', authenticate, generarLogsPorFecha);

export default router;

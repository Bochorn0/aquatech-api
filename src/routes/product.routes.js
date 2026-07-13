// src/routes/product.routes.js
import { Router } from 'express';
import { getAllProducts, generateAllProducts, getProductById, getProductMetrics, getProductHistoricoLogs, getProductHistoricoDaysSummary, postHistoricoHubSummary, getProductLogsById, sendDeviceCommands, saveAllProducts, componentInput, fetchLogsRoutine, fetchLogsRoutine_old, getTuyaLogsRoutineConfig, updateTuyaLogsRoutineConfig, runLogsRoutineForProduct, generarLogsPorFecha, createProduct, updateProduct, deleteProduct, lockProducts, previewMergeDuplicateProducts, mergeDuplicateProducts, getMergedProductsList, getMergedProductDetail } from '../controllers/product.controller.js'; // Named imports
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
  if (
    (req.path === '/fetchLogsRoutine' || req.path === '/fetchLogsRoutine_old') &&
    req.method === 'POST'
  ) {
    return cronOrAuthForLogsRoutine(req, res, next);
  }
  authenticate(req, res, (err) => {
    if (err) return next(err);
    requirePermission('/', '/equipos')(req, res, next);
  });
};

// Get all products
router.get('/', authenticate, getAllProducts);

// Histórico Tuya hub: métricas agregadas en product_logs (POST evita URL larga con muchos ids)
router.post('/logs/historico-hub-summary', authenticate, postHistoricoHubSummary);

// Admin: lock products (archive logs, `_` device_id + merged_from_device_ids)
router.post('/lock', authenticate, authorizeRoles('admin'), lockProducts);

// Admin: merge duplicate Tuya devices (OLD absorbed into NEW)
router.post('/merge-duplicates/preview', authenticate, authorizeRoles('admin'), previewMergeDuplicateProducts);
router.post('/merge-duplicates', authenticate, authorizeRoles('admin'), mergeDuplicateProducts);

// Admin: merged canonical pairs (for Personalización V1)
router.get('/merged', authenticate, authorizeRoles('admin'), getMergedProductsList);
router.get('/merged/:liveDeviceId', authenticate, authorizeRoles('admin'), getMergedProductDetail);

// get multiple mocked
router.get('/mocked', authenticate, generateAllProducts);

// Get specific product by ID
router.get('/:id', authenticate, getProductById);

// Admin: per-product config for which Tuya log fields/rules the cron routine uses
router.get('/:id/logs-routine-config', authenticate, authorizeRoles('admin'), getTuyaLogsRoutineConfig);
router.put('/:id/logs-routine-config', authenticate, authorizeRoles('admin'), updateTuyaLogsRoutineConfig);
// Admin: run fetchLogsRoutine logic for a single product (test custom rules / campo_personalizado_*)
router.post('/:id/run-logs-routine', authenticate, authorizeRoles('admin'), runLogsRoutineForProduct);

// Create product - for Personalización V1 (add new product)
router.post('/', authenticate, createProduct);
// Update product (cliente, city, product_type) - for Equipos / personalización (access by permission at mount)
router.patch('/:id', authenticate, updateProduct);

// Delete product - admin only (Personalización v1 > Equipos tab)
router.delete('/:id', authenticate, authorizeRoles('admin'), deleteProduct);

// Historico Tuya (totales + TDS) — requires tuya_logs_routine_enabled on the product; must be registered before /:id/logs
router.get('/:id/logs/historico', authenticate, getProductHistoricoLogs);
router.get('/:id/logs/historico-days-summary', authenticate, getProductHistoricoDaysSummary);

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
// Legacy hardcoded routine (backup / rollback)
router.post('/fetchLogsRoutine_old', cronOrAuthForLogsRoutine, fetchLogsRoutine_old);

// fetch reporte por fechas 
router.post('/generarLogsPorFecha', authenticate, generarLogsPorFecha);

export default router;

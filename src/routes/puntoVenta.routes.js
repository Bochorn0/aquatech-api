import { Router } from 'express';
import {
  getPuntosVenta,
  getPuntosVentaFiltered,
  getPuntoVentaById,
  addPuntoVenta,
  updatePuntoVenta,
  deletePuntoVenta,
  generateDailyData,
  generateMockDataNow,
  generateMockDataNowAllDevMode,
  simulateBajoNivelCruda,
  simulateNivelCrudaNormalizado,
  simulateSensor
} from '../controllers/puntoVenta.controller.js';
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js';

const router = Router();

// Cron or dashboard: X-Cron-Secret, X-TIWater-API-Key (cron/script) or JWT with /puntoVenta (manual)
// Secret can be CRON_DEV_MODE_SECRET or TIWATER_API_KEY
const cronOrAuthDevMode = (req, res, next) => {
  const secret = req.headers['x-cron-secret'];
  const apiKey = req.headers['x-tiwater-api-key'] || req.headers['x-api-key'];
  const validSecret = process.env.CRON_DEV_MODE_SECRET || process.env.TIWATER_API_KEY;
  const validApiKey = process.env.TIWATER_API_KEY;
  if (secret && validSecret && secret === validSecret) return next();
  if (apiKey && validApiKey && apiKey === validApiKey) return next();
  authenticate(req, res, (err) => {
    if (err) return next(err);
    requirePermission('/puntoVenta')(req, res, next);
  });
};

/**
 * Mount-level middleware: for generate-mock-data-now routes, allow X-Cron-Secret or X-TIWater-API-Key
 * to bypass JWT auth. Must run BEFORE authenticate in index.js.
 */
export const puntoVentaAuthOrCron = (req, res, next) => {
  const isGenerateMockPath =
    req.path.includes('generate-mock-data-now') || req.originalUrl.includes('generate-mock-data-now');
  if (!isGenerateMockPath) {
    return authenticate(req, res, (err) => {
      if (err) return next(err);
      requirePermission('/puntoVenta')(req, res, next);
    });
  }
  const secret = req.headers['x-cron-secret'];
  const apiKey = req.headers['x-tiwater-api-key'] || req.headers['x-api-key'];
  const validSecret = process.env.CRON_DEV_MODE_SECRET || process.env.TIWATER_API_KEY;
  const validApiKey = process.env.TIWATER_API_KEY;
  if ((secret && validSecret && secret === validSecret) || (apiKey && validApiKey && apiKey === validApiKey)) {
    return next();
  }
  authenticate(req, res, (err) => {
    if (err) return next(err);
    requirePermission('/puntoVenta')(req, res, next);
  });
};

// Dev-mode bulk: generate mock data for all dev_mode puntos (cron calls this)
router.post('/dev-mode/generate-mock-data-now', cronOrAuthDevMode, generateMockDataNowAllDevMode);

// Read/update access by requirePermission('/puntoVenta') at mount
router.get('/all', authenticate, getPuntosVenta);
router.get('/', authenticate, getPuntosVentaFiltered);
router.get('/:id', authenticate, getPuntoVentaById);
router.patch('/:id', authenticate, updatePuntoVenta);

// Write: require /puntoVenta
router.post('/', authenticate, requirePermission('/puntoVenta'), addPuntoVenta);
router.delete('/:id', authenticate, requirePermission('/puntoVenta'), deletePuntoVenta);
router.post('/:id/generate-daily-data', authenticate, requirePermission('/puntoVenta'), generateDailyData);
// Single endpoint accepts cron secret too (script calls it per punto)
router.post('/:id/generate-mock-data-now', cronOrAuthDevMode, generateMockDataNow);
router.post('/:id/simulate-bajo-nivel-cruda', authenticate, requirePermission('/puntoVenta'), simulateBajoNivelCruda);
router.post('/:id/simulate-nivel-cruda-normalizado', authenticate, requirePermission('/puntoVenta'), simulateNivelCrudaNormalizado);
router.post('/:id/simulate-sensor', authenticate, requirePermission('/puntoVenta'), simulateSensor);

export default router;

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

// Cron or dashboard: X-Cron-Secret (cron) or JWT with /puntoVenta (manual)
// Secret can be CRON_DEV_MODE_SECRET or TIWATER_API_KEY (one less env var if you already have it)
const cronOrAuthDevMode = (req, res, next) => {
  const secret = req.headers['x-cron-secret'];
  const validSecret = process.env.CRON_DEV_MODE_SECRET || process.env.TIWATER_API_KEY;
  if (secret && validSecret && secret === validSecret) return next();
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

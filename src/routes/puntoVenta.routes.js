import { Router } from 'express';
import {
  getPuntosVenta,
  getPuntosVentaFiltered,
  getPuntoVentaById,
  addPuntoVenta,
  updatePuntoVenta,
  deletePuntoVenta,
  generateDailyData,
  simulateBajoNivelCruda,
  simulateNivelCrudaNormalizado,
  simulateSensor
} from '../controllers/puntoVenta.controller.js';
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js';

const router = Router();

// Read/update access by requirePermission('/puntoVenta') at mount
router.get('/all', authenticate, getPuntosVenta);
router.get('/', authenticate, getPuntosVentaFiltered);
router.get('/:id', authenticate, getPuntoVentaById);
router.patch('/:id', authenticate, updatePuntoVenta);

// Write: require /puntoVenta
router.post('/', authenticate, requirePermission('/puntoVenta'), addPuntoVenta);
router.delete('/:id', authenticate, requirePermission('/puntoVenta'), deletePuntoVenta);
router.post('/:id/generate-daily-data', authenticate, requirePermission('/puntoVenta'), generateDailyData);
router.post('/:id/simulate-bajo-nivel-cruda', authenticate, requirePermission('/puntoVenta'), simulateBajoNivelCruda);
router.post('/:id/simulate-nivel-cruda-normalizado', authenticate, requirePermission('/puntoVenta'), simulateNivelCrudaNormalizado);
router.post('/:id/simulate-sensor', authenticate, requirePermission('/puntoVenta'), simulateSensor);

export default router;

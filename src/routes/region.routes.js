import { Router } from 'express';
import { getRegions, getRegionById, updateRegion, getRegionPuntos, setRegionPuntos, createRegion, deleteRegion } from '../controllers/region.controller.js';
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js';

const router = Router();

const regionPermission = ['/', '/dashboard', '/dashboard/v1', '/dashboard/v2', '/puntoVenta', '/personalizacion'];

router.get('/', authenticate, requirePermission(...regionPermission), getRegions);
router.post('/', authenticate, requirePermission(...regionPermission), createRegion);
router.get('/:id/puntos', authenticate, requirePermission(...regionPermission), getRegionPuntos);
router.put('/:id/puntos', authenticate, requirePermission(...regionPermission), setRegionPuntos);
router.get('/:id', authenticate, requirePermission(...regionPermission), getRegionById);
router.patch('/:id', authenticate, requirePermission(...regionPermission), updateRegion);
router.delete('/:id', authenticate, requirePermission(...regionPermission), deleteRegion);

export default router;

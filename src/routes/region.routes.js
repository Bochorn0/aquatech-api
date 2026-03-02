import { Router } from 'express';
import { getRegions, getRegionById, updateRegion, getRegionPuntos } from '../controllers/region.controller.js';
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticate, requirePermission('/', '/dashboard', '/dashboard/v1', '/dashboard/v2', '/puntoVenta', '/personalizacion'), getRegions);
router.get('/:id/puntos', authenticate, requirePermission('/', '/dashboard', '/dashboard/v1', '/dashboard/v2', '/puntoVenta', '/personalizacion'), getRegionPuntos);
router.get('/:id', authenticate, requirePermission('/', '/dashboard', '/dashboard/v1', '/dashboard/v2', '/puntoVenta', '/personalizacion'), getRegionById);
router.patch('/:id', authenticate, requirePermission('/', '/dashboard', '/dashboard/v1', '/dashboard/v2', '/puntoVenta', '/personalizacion'), updateRegion);

export default router;

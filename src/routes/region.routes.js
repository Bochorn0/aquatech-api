import { Router } from 'express';
import { getRegions, getRegionById } from '../controllers/region.controller.js';
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticate, requirePermission('/', '/dashboard', '/dashboard/v1', '/dashboard/v2', '/puntoVenta', '/personalizacion'), getRegions);
router.get('/:id', authenticate, requirePermission('/', '/dashboard', '/dashboard/v1', '/dashboard/v2', '/puntoVenta', '/personalizacion'), getRegionById);

export default router;

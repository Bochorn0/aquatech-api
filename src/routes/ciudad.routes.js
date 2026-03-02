import { Router } from 'express';
import { getCiudades, getCiudadById } from '../controllers/ciudad.controller.js';
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticate, requirePermission('/', '/dashboard', '/dashboard/v1', '/dashboard/v2', '/puntoVenta', '/personalizacion'), getCiudades);
router.get('/:id', authenticate, requirePermission('/', '/dashboard', '/dashboard/v1', '/dashboard/v2', '/puntoVenta', '/personalizacion'), getCiudadById);

export default router;

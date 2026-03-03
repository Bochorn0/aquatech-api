// src/routes/adminEvents.routes.js
// Admin-only test events (e.g. generate mock puntos de venta via MQTT)
// Mounted at /api/v2.0/admin so path is /api/v2.0/admin/events/...

import express from 'express';
import { authorizeRoles } from '../middlewares/auth.middleware.js';
import { generateMockPuntosVenta } from '../controllers/customizationV2.controller.js';

const router = express.Router();

router.post('/events/generate-puntos-venta', authorizeRoles('admin'), generateMockPuntosVenta);

export default router;

// src/routes/adminEvents.routes.js
// Admin-only test events (e.g. generate mock puntos de venta via MQTT, stress test)
// Mounted at /api/v2.0/admin so path is /api/v2.0/admin/events/...

import express from 'express';
import { authorizeRoles } from '../middlewares/auth.middleware.js';
import { generateMockPuntosVenta, stressMqtt } from '../controllers/customizationV2.controller.js';

const router = express.Router();

router.post('/events/generate-puntos-venta', authorizeRoles('admin'), generateMockPuntosVenta);
router.post('/events/stress-mqtt', authorizeRoles('admin'), stressMqtt);

export default router;

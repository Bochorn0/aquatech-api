// src/routes/mqtt.routes.js
// Rutas para endpoints relacionados con MQTT

import express from 'express';
import { downloadCertificateZip, publishTestMessage, getMqttStatus } from '../controllers/mqtt.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = express.Router();

// MQTT status (no auth - for debugging)
router.get('/status', getMqttStatus);

// Descargar certificado CA en ZIP protegido con contraseña
router.get('/certificate/download', authenticate, downloadCertificateZip);

// Publish test message to tiwater/{codigoTienda}/data (for Event Grid / Mosquitto testing)
// Body: { codigoTienda: "TEST-001", payload?: {...} }
router.post('/publish-test', authenticate, publishTestMessage);

export default router;


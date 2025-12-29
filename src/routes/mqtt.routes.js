// src/routes/mqtt.routes.js
// Rutas para endpoints relacionados con MQTT

import express from 'express';
import { downloadCertificateZip } from '../controllers/mqtt.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Descargar certificado CA en ZIP protegido con contraseña
// Requiere autenticación
router.get('/certificate/download', authenticate, downloadCertificateZip);

export default router;


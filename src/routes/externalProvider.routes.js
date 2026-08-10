/**
 * Routes: external provider ingest webhooks (no JWT — provider secret).
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  postExternalReading,
  listExternalProviders,
} from '../controllers/externalProviderIngest.controller.js';

const router = express.Router();

const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.EXTERNAL_INGEST_RATE_LIMIT_PER_MIN || 600),
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: '429', message: 'Too many ingest requests' },
});

router.get('/', listExternalProviders);
router.post('/:providerId/readings', ingestLimiter, postExternalReading);

export default router;

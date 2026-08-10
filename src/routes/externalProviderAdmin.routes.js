/**
 * Authenticated ops routes for external providers.
 * Mounted at /api/v2.0/external-providers
 *
 * Sync endpoint also accepts X-Cron-Secret (same pattern as Tuya logs cron).
 */

import express from 'express';
import {
  getExternalProviderStatus,
  listBindings,
  upsertBinding,
  deactivateBinding,
  listIngestLog,
  syncMeterPlatform,
  testMeterPlatformLogin,
  upsertMeterBinding,
} from '../controllers/externalProviderAdmin.controller.js';

const router = express.Router();

const cronOrNext = (req, res, next) => {
  const cronHeader = req.headers['x-cron-secret'] || req.headers['x-tiwater-api-key'];
  const validSecret =
    process.env.CRON_METER_PLATFORM_SECRET
    || process.env.CRON_TUYA_LOGS_SECRET
    || process.env.CRON_DEV_MODE_SECRET
    || process.env.TIWATER_API_KEY;
  if (cronHeader && validSecret && cronHeader === validSecret) {
    return next();
  }
  // Fall through: parent mount already applied JWT authenticate for non-cron callers
  // When called via dedicated cron mount without JWT, reject here.
  if (req.externalProvidersCronOnly) {
    return res.status(401).json({ success: false, message: 'Invalid or missing X-Cron-Secret' });
  }
  return next();
};

router.get('/status', getExternalProviderStatus);
router.get('/bindings', listBindings);
router.post('/bindings', upsertBinding);
router.delete('/bindings/:id', deactivateBinding);
router.get('/ingest-log', listIngestLog);

router.get('/meter-platform/login-test', testMeterPlatformLogin);
router.post('/meter-platform/bindings', upsertMeterBinding);
router.post('/meter-platform/sync', cronOrNext, syncMeterPlatform);

export default router;

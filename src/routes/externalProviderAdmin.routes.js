/**
 * Authenticated ops routes for external providers.
 * Mounted at /api/v2.0/external-providers
 *
 * Sync endpoint also accepts X-Cron-Secret (same pattern as Tuya logs cron).
 * Meter-platform browse/sync require role permission `/meter-platform`.
 */

import express from 'express';
import { requireExplicitPermission } from '../middlewares/auth.middleware.js';
import {
  getExternalProviderStatus,
  listBindings,
  upsertBinding,
  deactivateBinding,
  listIngestLog,
  syncMeterPlatform,
  testMeterPlatformLogin,
  upsertMeterBinding,
  listMeterPlatformDevices,
  getMeterPlatformDeviceDetail,
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
  if (req.externalProvidersCronOnly) {
    return res.status(401).json({ success: false, message: 'Invalid or missing X-Cron-Secret' });
  }
  return next();
};

const requireMeterPlatform = requireExplicitPermission('/meter-platform');

router.get('/status', getExternalProviderStatus);
router.get('/bindings', listBindings);
router.post('/bindings', upsertBinding);
router.delete('/bindings/:id', deactivateBinding);
router.get('/ingest-log', listIngestLog);

router.get('/meter-platform/login-test', requireMeterPlatform, testMeterPlatformLogin);
router.post('/meter-platform/bindings', requireMeterPlatform, upsertMeterBinding);
// Cron bypasses JWT mount; when JWT is used, also require /meter-platform.
router.post('/meter-platform/sync', cronOrNext, (req, res, next) => {
  const cronHeader = req.headers['x-cron-secret'] || req.headers['x-tiwater-api-key'];
  const validSecret =
    process.env.CRON_METER_PLATFORM_SECRET
    || process.env.CRON_TUYA_LOGS_SECRET
    || process.env.CRON_DEV_MODE_SECRET
    || process.env.TIWATER_API_KEY;
  if (cronHeader && validSecret && cronHeader === validSecret) {
    return syncMeterPlatform(req, res);
  }
  return requireMeterPlatform(req, res, () => syncMeterPlatform(req, res));
});
router.get('/meter-platform/devices', requireMeterPlatform, listMeterPlatformDevices);
router.get('/meter-platform/devices/:deviceCode', requireMeterPlatform, getMeterPlatformDeviceDetail);

export default router;

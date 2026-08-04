/**
 * Authenticated ops routes for external providers.
 * Mounted at /api/v2.0/external-providers
 */

import express from 'express';
import {
  getExternalProviderStatus,
  listBindings,
  upsertBinding,
  deactivateBinding,
  listIngestLog,
} from '../controllers/externalProviderAdmin.controller.js';

const router = express.Router();

router.get('/status', getExternalProviderStatus);
router.get('/bindings', listBindings);
router.post('/bindings', upsertBinding);
router.delete('/bindings/:id', deactivateBinding);
router.get('/ingest-log', listIngestLog);

export default router;

/**
 * HTTP webhook for external meter providers (Linghu push, etc.).
 */

import { ingestPush, linghuAck } from '../services/externalProviders/ingest.service.js';
import {
  ExternalProviderAuthError,
  ExternalProviderValidationError,
} from '../services/externalProviders/types.js';
import { listProviders } from '../services/externalProviders/index.js';

/**
 * POST /api/v2.0/ingest/external/:providerId/readings
 */
export async function postExternalReading(req, res) {
  const providerId = req.params.providerId;
  try {
    const result = await ingestPush(providerId, req);
    return res.status(result.httpStatus).json(result.body);
  } catch (err) {
    if (err instanceof ExternalProviderAuthError) {
      return res.status(401).json(linghuAck(false, err.message));
    }
    if (err instanceof ExternalProviderValidationError) {
      return res.status(400).json(linghuAck(false, err.message));
    }
    if (err.statusCode === 404) {
      return res.status(404).json(linghuAck(false, err.message));
    }
    console.error('[externalProviderIngest]', err);
    // Vendor retries on non-200 — return 500 so they retry transient DB errors
    return res.status(500).json(linghuAck(false, 'Internal error'));
  }
}

/**
 * GET /api/v2.0/ingest/external (ops discovery; protect in prod if needed)
 */
export async function listExternalProviders(_req, res) {
  return res.json({ success: true, data: listProviders() });
}

export default { postExternalReading, listExternalProviders };

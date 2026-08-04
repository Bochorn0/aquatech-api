/**
 * Orchestrate external provider push ingest (sync persist for pilot / P4).
 */

import { requireProvider } from './index.js';
import { resolveBinding } from './binding.service.js';
import { saveNormalizedReading } from './persist.service.js';
import ExternalIngestLogModel from '../../models/postgres/externalIngestLog.model.js';
import {
  ExternalProviderUnmappedError,
  ExternalProviderValidationError,
  ExternalProviderAuthError,
} from './types.js';

function linghuAck(ok = true, message = '') {
  return { code: ok ? '200' : '400', message: message || '' };
}

/**
 * Full push pipeline for a registered provider.
 * @param {string} providerId
 * @param {import('express').Request} req
 */
export async function ingestPush(providerId, req) {
  const provider = requireProvider(providerId);

  provider.verifyAuth(req);

  const reading = provider.normalizePush(req.body);

  const storePayload = process.env.EXTERNAL_INGEST_STORE_PAYLOAD === 'true';
  let logBegin;
  try {
    logBegin = await ExternalIngestLogModel.tryBegin({
      provider: reading.provider,
      externalDeviceId: reading.externalDeviceId,
      idempotencyKey: reading.idempotencyKey,
      status: 'queued',
      payload: storePayload ? req.body : null,
    });
  } catch (err) {
    // Table may not exist yet in local envs — continue without idempotency
    if (err.code === '42P01') {
      logBegin = { inserted: true, row: null, skipped: true };
    } else {
      throw err;
    }
  }

  if (logBegin && logBegin.inserted === false) {
    return {
      httpStatus: 200,
      body: linghuAck(true, ''),
      duplicate: true,
      previousStatus: logBegin.row?.status || null,
    };
  }

  let binding;
  try {
    binding = await resolveBinding(reading.provider, reading);
  } catch (err) {
    if (err instanceof ExternalProviderUnmappedError) {
      if (logBegin?.row || logBegin?.inserted) {
        try {
          await ExternalIngestLogModel.markStatus(reading.idempotencyKey, 'unmapped', err.message);
        } catch { /* ignore */ }
      }
      // Still ACK 200 so vendor does not retry forever; ops see unmapped in log
      return {
        httpStatus: 200,
        body: linghuAck(true, ''),
        unmapped: true,
        externalDeviceId: reading.externalDeviceId,
      };
    }
    throw err;
  }

  const saved = await saveNormalizedReading(reading, {
    codigoTienda: binding.codigoTienda,
    clientId: binding.clientId,
    puntoventaId: binding.puntoventaId,
  });

  try {
    await ExternalIngestLogModel.markPersisted(reading.idempotencyKey, {
      codigoTienda: saved.codigoTienda,
      sensoresMessageId: saved.sensoresMessageId,
    });
  } catch (err) {
    if (err.code !== '42P01') {
      console.warn('[externalProviders.ingest] markPersisted failed:', err.message);
    }
  }

  return {
    httpStatus: 200,
    body: linghuAck(true, ''),
    saved,
  };
}

export {
  ExternalProviderValidationError,
  ExternalProviderAuthError,
  ExternalProviderUnmappedError,
  linghuAck,
};

export default { ingestPush };

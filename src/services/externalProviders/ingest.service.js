/**
 * Orchestrate external provider push ingest.
 *
 * Sync (default): auth → normalize → idempotency → bind → persist → ACK
 * Async (EXTERNAL_INGEST_ASYNC=true): auth → normalize → idempotency → ACK,
 *   then bind+persist in background (ready for 24k / swap to Service Bus later).
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

function isAsyncMode() {
  return String(process.env.EXTERNAL_INGEST_ASYNC || '').toLowerCase() === 'true';
}

async function safeMarkStatus(idempotencyKey, status, error = null) {
  try {
    await ExternalIngestLogModel.markStatus(idempotencyKey, status, error);
  } catch (err) {
    if (err.code !== '42P01') {
      console.warn('[externalProviders.ingest] markStatus failed:', err.message);
    }
  }
}

async function safeMarkPersisted(idempotencyKey, fields) {
  try {
    await ExternalIngestLogModel.markPersisted(idempotencyKey, fields);
  } catch (err) {
    if (err.code !== '42P01') {
      console.warn('[externalProviders.ingest] markPersisted failed:', err.message);
    }
  }
}

/**
 * Persist one normalized reading (bind → sensores* → log).
 * @param {import('./types.js').NormalizedReading} reading
 */
export async function processNormalizedReading(reading) {
  let binding;
  try {
    binding = await resolveBinding(reading.provider, reading);
  } catch (err) {
    if (err instanceof ExternalProviderUnmappedError) {
      await safeMarkStatus(reading.idempotencyKey, 'unmapped', err.message);
      return { unmapped: true, externalDeviceId: reading.externalDeviceId };
    }
    await safeMarkStatus(reading.idempotencyKey, 'failed', err.message);
    throw err;
  }

  try {
    const saved = await saveNormalizedReading(reading, {
      codigoTienda: binding.codigoTienda,
      clientId: binding.clientId,
      puntoventaId: binding.puntoventaId,
    });
    await safeMarkPersisted(reading.idempotencyKey, {
      codigoTienda: saved.codigoTienda,
      sensoresMessageId: saved.sensoresMessageId,
    });
    return { saved };
  } catch (err) {
    await safeMarkStatus(reading.idempotencyKey, 'failed', err.message);
    throw err;
  }
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

  if (isAsyncMode()) {
    setImmediate(() => {
      processNormalizedReading(reading).catch((err) => {
        console.error(
          `[externalProviders.ingest] async persist failed key=${reading.idempotencyKey}:`,
          err.message
        );
      });
    });
    return {
      httpStatus: 200,
      body: linghuAck(true, ''),
      async: true,
      externalDeviceId: reading.externalDeviceId,
    };
  }

  const result = await processNormalizedReading(reading);
  return {
    httpStatus: 200,
    body: linghuAck(true, ''),
    ...result,
  };
}

export {
  ExternalProviderValidationError,
  ExternalProviderAuthError,
  ExternalProviderUnmappedError,
  linghuAck,
  isAsyncMode,
};

export default { ingestPush, processNormalizedReading };

/**
 * Ops / admin endpoints for external providers (JWT).
 * Bindings CRUD + ingest log visibility (DLQ / unmapped / failed).
 */

import DeviceBindingModel from '../models/postgres/deviceBinding.model.js';
import ExternalIngestLogModel from '../models/postgres/externalIngestLog.model.js';
import { listProviders } from '../services/externalProviders/index.js';
import { isAsyncMode } from '../services/externalProviders/ingest.service.js';
import {
  syncAll,
  syncDevice,
  ensureBinding,
} from '../services/externalProviders/pullSync.service.js';
import meterPlatformClient from '../services/externalProviders/providers/meterPlatform/meterPlatform.client.js';

export async function getExternalProviderStatus(_req, res) {
  try {
    const counts = await ExternalIngestLogModel.countByStatus({});
    return res.json({
      success: true,
      data: {
        providers: listProviders(),
        asyncIngest: isAsyncMode(),
        ingestStatusCounts: counts,
      },
    });
  } catch (err) {
    console.error('[externalProviderAdmin.status]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function listBindings(req, res) {
  try {
    const { provider, active, limit, offset } = req.query;
    const activeOnly = active === 'false' || active === '0' ? false : true;
    const data = await DeviceBindingModel.list({
      provider: provider || undefined,
      activeOnly,
      limit,
      offset,
    });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[externalProviderAdmin.listBindings]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function upsertBinding(req, res) {
  try {
    const body = req.body || {};
    const provider = (body.provider || '').toString().trim();
    const externalDeviceId = (body.externalDeviceId || body.external_device_id || '').toString().trim();
    const codigoTienda = (body.codigoTienda || body.codigo_tienda || '').toString().trim();
    if (!provider || !externalDeviceId || !codigoTienda) {
      return res.status(400).json({
        success: false,
        message: 'provider, externalDeviceId and codigoTienda are required',
      });
    }
    const row = await DeviceBindingModel.upsert({
      provider,
      externalDeviceId,
      externalImei: body.externalImei || body.external_imei || null,
      puntoventaId: body.puntoventaId || body.puntoventa_id || null,
      codigoTienda,
      clientId: body.clientId || body.client_id || null,
      active: body.active !== undefined ? body.active : true,
      meta: body.meta || null,
    });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('[externalProviderAdmin.upsertBinding]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function deactivateBinding(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    const row = await DeviceBindingModel.deactivate(id);
    if (!row) return res.status(404).json({ success: false, message: 'Binding not found' });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('[externalProviderAdmin.deactivateBinding]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function listIngestLog(req, res) {
  try {
    const { provider, status, limit, offset } = req.query;
    const data = await ExternalIngestLogModel.list({
      provider: provider || undefined,
      status: status || undefined,
      limit,
      offset,
    });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[externalProviderAdmin.listIngestLog]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Pull-sync meter platform (manual JWT or cron X-Cron-Secret).
 * Body/query: { discover?: boolean, deviceCode?: string, persist?: boolean, limit?: number }
 */
export async function syncMeterPlatform(req, res) {
  try {
    const body = { ...(req.query || {}), ...(req.body || {}) };
    const deviceCode = (body.deviceCode || body.device_code || '').toString().trim();

    if (deviceCode) {
      const result = await syncDevice(deviceCode, {
        persist: body.persist !== false && body.persist !== 'false',
        volumeUnit: body.volumeUnit,
      });
      return res.status(result.success ? 200 : 502).json({ success: result.success, data: result });
    }

    const result = await syncAll({
      discover: body.discover === true || body.discover === 'true',
      persist: body.persist !== false && body.persist !== 'false',
      limit: body.limit ? Number(body.limit) : undefined,
      pageSize: body.pageSize ? Number(body.pageSize) : undefined,
      volumeUnit: body.volumeUnit,
    });
    return res.status(result.success ? 200 : 502).json({ success: result.success, data: result });
  } catch (err) {
    console.error('[externalProviderAdmin.syncMeterPlatform]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/** Dry-run login check (does not persist). */
export async function testMeterPlatformLogin(_req, res) {
  try {
    if (!meterPlatformClient.hasMeterPlatformCredentials()) {
      return res.status(400).json({
        success: false,
        message: 'Set METER_PLATFORM_USERNAME and METER_PLATFORM_PASSWORD in .env',
      });
    }
    const result = await meterPlatformClient.login({ force: true });
    return res.status(result.success ? 200 : 502).json({
      success: result.success,
      message: result.success ? 'Login OK' : result.error,
      data: result.success ? { loginPath: result.loginPath, cached: result.cached } : null,
    });
  } catch (err) {
    console.error('[externalProviderAdmin.testMeterPlatformLogin]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function upsertMeterBinding(req, res) {
  try {
    const body = req.body || {};
    const row = await ensureBinding({
      deviceCode: body.deviceCode || body.externalDeviceId || body.external_device_id,
      codigoTienda: body.codigoTienda || body.codigo_tienda,
      puntoventaId: body.puntoventaId || body.puntoventa_id,
      clientId: body.clientId || body.client_id,
      imei: body.imei || body.externalImei,
      meta: body.meta,
    });
    return res.json({ success: true, data: row });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ success: false, message: err.message });
  }
}

export default {
  getExternalProviderStatus,
  listBindings,
  upsertBinding,
  deactivateBinding,
  listIngestLog,
  syncMeterPlatform,
  testMeterPlatformLogin,
  upsertMeterBinding,
};

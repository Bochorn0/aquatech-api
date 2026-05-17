import TuyaProductAlertConfigModel from '../models/postgres/tuyaProductAlertConfig.model.js';
import TuyaProductAlertContactModel from '../models/postgres/tuyaProductAlertContact.model.js';
import ProductModel from '../models/postgres/product.model.js';
import {
  getProductAccessContext,
  isClientScopedProductAccess,
  clientIdInAllowedList,
  normalizeClientIdFromProduct,
} from '../utils/user-clients.helper.js';

function parseIntSafe(v) {
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

/** List configs (scoped by client unless admin / All). Optional ?device_id= */
export const listTuyaAlertConfigs = async (req, res) => {
  try {
    const ctx = await getProductAccessContext(req);
    const deviceId = req.query.device_id ? String(req.query.device_id) : null;

    let rows;
    if (isClientScopedProductAccess(ctx)) {
      rows = await TuyaProductAlertConfigModel.findForClientIds(ctx.allowedClientIds);
    } else {
      rows = await TuyaProductAlertConfigModel.findForClientIds([]);
    }
    if (deviceId) {
      rows = rows.filter((r) => r.device_id === deviceId);
    }
    res.json(rows);
  } catch (e) {
    console.error('[listTuyaAlertConfigs]', e);
    res.status(500).json({ success: false, message: e.message });
  }
};

export const createTuyaAlertConfig = async (req, res) => {
  try {
    const ctx = await getProductAccessContext(req);
    const { device_id, client_id, sensor_code, display_name, rules, enabled } = req.body || {};
    if (!device_id || !sensor_code) {
      return res.status(400).json({ success: false, message: 'device_id y sensor_code son requeridos' });
    }
    const cid = parseIntSafe(client_id);
    if (cid == null) return res.status(400).json({ success: false, message: 'client_id inválido' });

    if (isClientScopedProductAccess(ctx) && !clientIdInAllowedList(cid, ctx.allowedClientIds)) {
      return res.status(403).json({ success: false, message: 'Cliente no permitido' });
    }

    const prod = await ProductModel.findByDeviceId(String(device_id));
    if (!prod) {
      return res.status(404).json({ success: false, message: 'Equipo (device_id) no encontrado' });
    }
    const productClient = normalizeClientIdFromProduct(prod);
    if (productClient != null && productClient !== cid) {
      return res.status(400).json({ success: false, message: 'client_id no coincide con el equipo' });
    }

    const row = await TuyaProductAlertConfigModel.create({
      deviceId: String(device_id),
      clientId: cid,
      sensorCode: String(sensor_code),
      displayName: display_name,
      rules: Array.isArray(rules) ? rules : [],
      enabled: enabled !== false,
    });
    res.status(201).json(row);
  } catch (e) {
    if ((e.message || '').includes('unique') || (e.code || '') === '23505') {
      return res.status(409).json({ success: false, message: 'Ya existe configuración para este equipo y sensor' });
    }
    console.error('[createTuyaAlertConfig]', e);
    res.status(500).json({ success: false, message: e.message });
  }
};

export const updateTuyaAlertConfig = async (req, res) => {
  try {
    const ctx = await getProductAccessContext(req);
    const id = req.params.id;
    const existing = await TuyaProductAlertConfigModel.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'No encontrado' });

    const cfgClient = parseIntSafe(existing.client_id);
    if (isClientScopedProductAccess(ctx) && !clientIdInAllowedList(cfgClient, ctx.allowedClientIds)) {
      return res.status(403).json({ success: false, message: 'Sin acceso' });
    }

    const updated = await TuyaProductAlertConfigModel.update(id, {
      sensorCode: req.body.sensor_code,
      displayName: req.body.display_name,
      rules: req.body.rules,
      enabled: req.body.enabled,
    });
    res.json(updated);
  } catch (e) {
    console.error('[updateTuyaAlertConfig]', e);
    res.status(500).json({ success: false, message: e.message });
  }
};

export const deleteTuyaAlertConfig = async (req, res) => {
  try {
    const ctx = await getProductAccessContext(req);
    const existing = await TuyaProductAlertConfigModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'No encontrado' });
    const cfgClient = parseIntSafe(existing.client_id);
    if (isClientScopedProductAccess(ctx) && !clientIdInAllowedList(cfgClient, ctx.allowedClientIds)) {
      return res.status(403).json({ success: false, message: 'Sin acceso' });
    }
    await TuyaProductAlertConfigModel.delete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    console.error('[deleteTuyaAlertConfig]', e);
    res.status(500).json({ success: false, message: e.message });
  }
};

export const listTuyaAlertContacts = async (req, res) => {
  try {
    const ctx = await getProductAccessContext(req);
    const cfg = await TuyaProductAlertConfigModel.findById(req.params.configId);
    if (!cfg) return res.status(404).json({ success: false, message: 'Config no encontrada' });
    const cfgClient = parseIntSafe(cfg.client_id);
    if (isClientScopedProductAccess(ctx) && !clientIdInAllowedList(cfgClient, ctx.allowedClientIds)) {
      return res.status(403).json({ success: false, message: 'Sin acceso' });
    }
    const list = await TuyaProductAlertContactModel.findByConfigId(cfg.id);
    res.json(list);
  } catch (e) {
    console.error('[listTuyaAlertContacts]', e);
    res.status(500).json({ success: false, message: e.message });
  }
};

export const createTuyaAlertContact = async (req, res) => {
  try {
    const ctx = await getProductAccessContext(req);
    const cfg = await TuyaProductAlertConfigModel.findById(req.params.configId);
    if (!cfg) return res.status(404).json({ success: false, message: 'Config no encontrada' });
    const cfgClient = parseIntSafe(cfg.client_id);
    if (isClientScopedProductAccess(ctx) && !clientIdInAllowedList(cfgClient, ctx.allowedClientIds)) {
      return res.status(403).json({ success: false, message: 'Sin acceso' });
    }

    const b = req.body || {};
    if (!b.usuario || !b.correo) {
      return res.status(400).json({ success: false, message: 'usuario y correo son requeridos' });
    }
    if (!b.dashboardAlert && !b.dashboard_alert && !b.emailAlert && !b.email_alert) {
      return res.status(400).json({ success: false, message: 'Al menos un canal de alerta (dashboard / email)' });
    }
    if (!b.preventivo && !b.correctivo) {
      return res.status(400).json({ success: false, message: 'Al menos preventivo o correctivo' });
    }

    const row = await TuyaProductAlertContactModel.create({
      configId: cfg.id,
      usuario: b.usuario,
      correo: b.correo,
      celular: b.celular,
      celularAlert: b.celularAlert ?? b.celular_alert,
      dashboardAlert: b.dashboardAlert ?? b.dashboard_alert,
      emailAlert: b.emailAlert ?? b.email_alert,
      preventivo: b.preventivo,
      correctivo: b.correctivo,
      emailCooldownMinutes: b.emailCooldownMinutes ?? b.email_cooldown_minutes,
      emailMaxPerDay: b.emailMaxPerDay ?? b.email_max_per_day,
    });
    res.status(201).json(row);
  } catch (e) {
    console.error('[createTuyaAlertContact]', e);
    res.status(500).json({ success: false, message: e.message });
  }
};

export const updateTuyaAlertContact = async (req, res) => {
  try {
    const ctx = await getProductAccessContext(req);
    const contact = await TuyaProductAlertContactModel.findById(req.params.contactId);
    if (!contact) return res.status(404).json({ success: false, message: 'No encontrado' });
    const cfg = await TuyaProductAlertConfigModel.findById(contact.config_id);
    if (!cfg) return res.status(404).json({ success: false, message: 'Config no encontrada' });
    const cfgClient = parseIntSafe(cfg.client_id);
    if (isClientScopedProductAccess(ctx) && !clientIdInAllowedList(cfgClient, ctx.allowedClientIds)) {
      return res.status(403).json({ success: false, message: 'Sin acceso' });
    }
    const updated = await TuyaProductAlertContactModel.update(req.params.contactId, req.body || {});
    res.json(updated);
  } catch (e) {
    console.error('[updateTuyaAlertContact]', e);
    res.status(500).json({ success: false, message: e.message });
  }
};

export const deleteTuyaAlertContact = async (req, res) => {
  try {
    const ctx = await getProductAccessContext(req);
    const contact = await TuyaProductAlertContactModel.findById(req.params.contactId);
    if (!contact) return res.status(404).json({ success: false, message: 'No encontrado' });
    const cfg = await TuyaProductAlertConfigModel.findById(contact.config_id);
    if (!cfg) return res.status(404).json({ success: false, message: 'Config no encontrada' });
    const cfgClient = parseIntSafe(cfg.client_id);
    if (isClientScopedProductAccess(ctx) && !clientIdInAllowedList(cfgClient, ctx.allowedClientIds)) {
      return res.status(403).json({ success: false, message: 'Sin acceso' });
    }
    await TuyaProductAlertContactModel.delete(req.params.contactId);
    res.json({ success: true });
  } catch (e) {
    console.error('[deleteTuyaAlertContact]', e);
    res.status(500).json({ success: false, message: e.message });
  }
};

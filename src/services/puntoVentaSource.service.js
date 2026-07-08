/**
 * Bridge layer: V2 puntoventa can be configured with MQTT sensors and/or Tuya products.
 * V1 routes and puntoventa_v1 remain unchanged; this service links V2 ↔ V1 shadow for Tuya.
 */

import { query } from '../config/postgres.config.js';
import PuntoVentaV1Model from '../models/postgres/puntoVentaV1.model.js';
import ProductModel from '../models/postgres/product.model.js';
import { normalizeTuyaStatus } from '../utils/tuyaSensorMapping.js';

export const SOURCE_TYPES = ['mqtt', 'tuya', 'hybrid'];

export function normalizeSourceType(value) {
  const v = (value || 'mqtt').toString().toLowerCase().trim();
  return SOURCE_TYPES.includes(v) ? v : 'mqtt';
}

export function parseProductIdsFromMeta(meta) {
  if (!meta) return [];
  const metaObj = typeof meta === 'string'
    ? (() => { try { return JSON.parse(meta); } catch { return null; } })()
    : meta;
  if (!metaObj || metaObj.product_ids == null) return [];
  const raw = Array.isArray(metaObj.product_ids) ? metaObj.product_ids : [metaObj.product_ids];
  return raw
    .map((pid) => (typeof pid === 'number' ? pid : parseInt(String(pid), 10)))
    .filter((n) => !Number.isNaN(n));
}

export function normalizeProductIdsInput(productos) {
  if (!Array.isArray(productos)) return [];
  return productos
    .map((p) => (typeof p === 'object' && p != null ? (p.id ?? p._id) : p))
    .map((pid) => parseInt(String(pid), 10))
    .filter((n) => !Number.isNaN(n));
}

/**
 * Resolve Tuya products linked to a V2 punto via puntoventa_v1 shadow record.
 */
export async function resolveProductsForPunto(puntoventaId) {
  const v1 = await PuntoVentaV1Model.findByPuntoventaId(puntoventaId);
  if (!v1) return { v1: null, products: [], productIds: [] };

  const productIds = parseProductIdsFromMeta(v1.meta);
  if (productIds.length === 0) return { v1, products: [], productIds: [] };

  const resolved = await Promise.all(productIds.map(async (pid) => {
    try {
      let product = await ProductModel.findById(pid);
      if (!product) product = await ProductModel.findByDeviceId(String(pid));
      return product;
    } catch {
      return null;
    }
  }));

  const products = resolved.filter(Boolean).map((p) => ({
    _id: p._id ?? p.id,
    id: p.id ?? p._id,
    name: p.name,
    device_id: p.device_id,
    product_type: p.product_type ?? 'Osmosis',
    status: p.status ?? [],
    icon: p.icon ?? null,
    online: p.online ?? false,
    update_time: p.update_time,
    last_time_active: p.last_time_active,
  }));

  return { v1, products, productIds };
}

/**
 * Create or update puntoventa_v1 shadow linked to V2 for metrics + Tuya product_ids.
 */
export async function ensureV1Shadow(puntoventaRecord, { productIds = [] } = {}) {
  if (!puntoventaRecord?.id) return null;

  const pvId = parseInt(String(puntoventaRecord.id), 10);
  const ids = normalizeProductIdsInput(productIds);
  const codigo = (puntoventaRecord.codigo_tienda || puntoventaRecord.code || '').toString().trim().toUpperCase();
  const code = codigo || `TUYA-PV2-${pvId}`;

  let v1 = await PuntoVentaV1Model.findByPuntoventaId(pvId);
  const meta = { ...(v1?.meta && typeof v1.meta === 'object' ? v1.meta : {}), product_ids: ids };

  if (v1) {
    return PuntoVentaV1Model.update(parseInt(v1.id, 10), {
      name: puntoventaRecord.name ?? v1.name,
      clientId: puntoventaRecord.clientId ?? v1.clientId,
      codigo_tienda: codigo || v1.codigo_tienda,
      code: codigo || v1.code,
      lat: puntoventaRecord.lat ?? v1.lat,
      long: puntoventaRecord.long ?? v1.long,
      address: puntoventaRecord.address ?? v1.address,
      meta,
    });
  }

  return PuntoVentaV1Model.create({
    name: puntoventaRecord.name || null,
    code,
    codigo_tienda: codigo || code,
    clientId: puntoventaRecord.clientId || null,
    lat: puntoventaRecord.lat,
    long: puntoventaRecord.long,
    address: typeof puntoventaRecord.address === 'object'
      ? JSON.stringify(puntoventaRecord.address)
      : puntoventaRecord.address,
    status: puntoventaRecord.status || 'active',
    meta,
    puntoventaId: pvId,
  });
}

export function productToOsmosisSystem(product) {
  const resourceId = product.device_id || String(product.id ?? product._id ?? 'osmosis');
  return {
    resourceId,
    resourceType: 'osmosis',
    name: product.name || 'Osmosis',
    online: product.online === true,
    status: normalizeTuyaStatus(product.status || []),
    source: 'tuya',
    // Preserve DB identity for historico / export (id = device_id, _id = products.id)
    productDbId: product._id != null ? String(product._id) : null,
    productDeviceId: product.device_id || (typeof product.id === 'string' ? product.id : null),
    product_type: product.product_type || 'Osmosis',
  };
}

export function isTuyaOnline(products = []) {
  return products.some((p) => p && p.online === true);
}

export function usesTuyaSource(sourceType) {
  return sourceType === 'tuya' || sourceType === 'hybrid';
}

export function usesMqttSource(sourceType) {
  return sourceType === 'mqtt' || sourceType === 'hybrid';
}

/**
 * Build osmosisSystems entries from Tuya Osmosis/TIWater products.
 */
export function buildTuyaOsmosisSystems(products = []) {
  return products
    .filter((p) => {
      const t = (p.product_type || '').toString();
      return t === 'Osmosis' || t === 'TIWater';
    })
    .map((p) => productToOsmosisSystem(p));
}

/**
 * Merge Tuya osmosis into existing MQTT-built osmosisSystems (avoid duplicates by resourceId).
 */
export function mergeOsmosisSystems(mqttSystems = [], tuyaSystems = []) {
  const byKey = new Map();
  for (const s of mqttSystems) {
    const key = `${(s.resourceType || '').toLowerCase()}:${s.resourceId || ''}`;
    byKey.set(key, s);
  }
  for (const s of tuyaSystems) {
    const key = `osmosis:${s.resourceId || ''}`;
    if (!byKey.has(key)) byKey.set(key, s);
  }
  return Array.from(byKey.values());
}

/**
 * Validate and apply source config on create/update. Returns normalized fields for puntoventa row.
 */
export async function applySourceConfigOnSave(puntoventaRecord, body = {}) {
  const sourceType = normalizeSourceType(body.source_type ?? puntoventaRecord?.source_type);
  const productIds = body.productos !== undefined
    ? normalizeProductIdsInput(body.productos)
    : null;

  let codigo_tienda = (body.codigo_tienda || body.code || puntoventaRecord?.codigo_tienda || '').toString().trim();

  if (usesMqttSource(sourceType) && !codigo_tienda) {
    throw Object.assign(new Error('codigo_tienda is required for MQTT source type'), { statusCode: 400 });
  }
  if (usesTuyaSource(sourceType) && productIds !== null && productIds.length === 0) {
    throw Object.assign(new Error('At least one Tuya product is required for Tuya source type'), { statusCode: 400 });
  }
  if (sourceType === 'hybrid' && productIds !== null && productIds.length === 0) {
    throw Object.assign(new Error('Hybrid source requires at least one Tuya product'), { statusCode: 400 });
  }

  // Tuya-only: auto-generate store code when not provided (code column is NOT NULL)
  if (sourceType === 'tuya' && !codigo_tienda) {
    const pvId = puntoventaRecord?.id ? String(puntoventaRecord.id) : Date.now();
    codigo_tienda = `TUYA-${pvId}`;
  }

  if (usesTuyaSource(sourceType) && productIds !== null) {
    await ensureV1Shadow(
      { ...puntoventaRecord, codigo_tienda, code: codigo_tienda },
      { productIds }
    );
  }

  return {
    source_type: sourceType,
    codigo_tienda: codigo_tienda || undefined,
    code: codigo_tienda || undefined,
  };
}

/**
 * Enrich V2 detalle response with Tuya products when source includes tuya.
 */
export async function enrichDetalleWithTuya({ puntoFromPG, osmosisSystems = [], skipDefaultPlaceholder = false }) {
  const sourceType = normalizeSourceType(puntoFromPG.source_type);
  if (!usesTuyaSource(sourceType)) {
    return {
      source_type: sourceType,
      osmosisSystems,
      tuyaProductos: [],
      onlineFromTuya: false,
      skipDefaultPlaceholder,
    };
  }

  const { products } = await resolveProductsForPunto(puntoFromPG.id);
  const tuyaOsmosis = buildTuyaOsmosisSystems(products);
  const merged = mergeOsmosisSystems(osmosisSystems, tuyaOsmosis);
  const nivelAndOthers = products.filter((p) => {
    const t = (p.product_type || '').toString();
    return t !== 'Osmosis' && t !== 'TIWater' && t !== 'Pressure';
  });

  const shouldSkipDefault = skipDefaultPlaceholder
    || sourceType === 'tuya'
    || (sourceType === 'hybrid' && merged.length > 0);

  return {
    source_type: sourceType,
    osmosisSystems: merged,
    tuyaProductos: [...products.filter((p) => {
      const t = (p.product_type || '').toString();
      return t === 'Osmosis' || t === 'TIWater';
    }), ...nivelAndOthers],
    onlineFromTuya: isTuyaOnline(products),
    skipDefaultPlaceholder: shouldSkipDefault,
  };
}

/**
 * Batch-load V1 shadow meta for list enrichment.
 */
export async function loadV1ShadowByPuntoIds(puntoIds = []) {
  const ids = puntoIds.map((id) => parseInt(String(id), 10)).filter((n) => !Number.isNaN(n));
  if (ids.length === 0) return new Map();

  const result = await query(
    `SELECT id, puntoventa_id, meta FROM puntoventa_v1 WHERE puntoventa_id = ANY($1::bigint[])`,
    [ids]
  );
  const map = new Map();
  for (const row of result.rows || []) {
    const pvId = String(row.puntoventa_id);
    map.set(pvId, {
      v1Id: row.id,
      productIds: parseProductIdsFromMeta(row.meta),
    });
  }
  return map;
}

/**
 * Compute list fields: source_type, products_count, combined online for one PV row.
 */
export function enrichListItem(pv, { v1Shadow, mqttOnline }) {
  const sourceType = normalizeSourceType(pv.source_type);
  const productsCount = v1Shadow?.productIds?.length ?? 0;
  let online = mqttOnline;

  if (sourceType === 'tuya') {
    online = false; // resolved async in batch if needed
  } else if (sourceType === 'hybrid') {
    online = mqttOnline; // tuya online merged in batch helper
  }

  return {
    source_type: sourceType,
    products_count: productsCount,
    online,
  };
}

/**
 * Batch resolve Tuya online status for list items with tuya/hybrid source.
 */
export async function batchTuyaOnlineByPuntoIds(v1ShadowMap) {
  const allProductIds = new Set();
  for (const shadow of v1ShadowMap.values()) {
    for (const pid of shadow.productIds || []) allProductIds.add(pid);
  }
  if (allProductIds.size === 0) return new Map();

  const ids = Array.from(allProductIds);
  const result = await query(
    'SELECT id, online FROM products WHERE id = ANY($1::bigint[])',
    [ids]
  );
  const onlineByProductId = new Map();
  for (const row of result.rows || []) {
    onlineByProductId.set(parseInt(row.id, 10), row.online === true);
  }

  const onlineByPuntoId = new Map();
  for (const [pvId, shadow] of v1ShadowMap.entries()) {
    const anyOnline = (shadow.productIds || []).some((pid) => onlineByProductId.get(pid) === true);
    onlineByPuntoId.set(pvId, anyOnline);
  }
  return onlineByPuntoId;
}

export default {
  SOURCE_TYPES,
  normalizeSourceType,
  resolveProductsForPunto,
  ensureV1Shadow,
  applySourceConfigOnSave,
  enrichDetalleWithTuya,
  loadV1ShadowByPuntoIds,
  enrichListItem,
  batchTuyaOnlineByPuntoIds,
  buildTuyaOsmosisSystems,
  mergeOsmosisSystems,
  usesTuyaSource,
  usesMqttSource,
};

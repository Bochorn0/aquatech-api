// src/utils/mqttTopic.js
// Build tiwater MQTT topic: tiwater/CODIGO_REGION/CIUDAD/CODIGO_TIENDA/data
// Falls back to legacy tiwater/CODIGO_TIENDA/data when region/ciudad are missing

import PuntoVentaModel from '../models/postgres/puntoVenta.model.js';
import RegionPuntoVentaModel from '../models/postgres/regionPuntoVenta.model.js';
import CiudadModel from '../models/postgres/ciudad.model.js';

/**
 * Build MQTT topic for tiwater data.
 * New format: tiwater/CODIGO_REGION/CIUDAD/CODIGO_TIENDA/data
 * Legacy fallback: tiwater/CODIGO_TIENDA/data (when region/ciudad missing)
 * @param {string} codigoTienda - Store code (e.g. TIENDA_001)
 * @returns {Promise<string>} MQTT topic
 */
export async function buildTiwaterTopic(codigoTienda) {
  if (!codigoTienda || typeof codigoTienda !== 'string') {
    return `tiwater/${String(codigoTienda || 'UNKNOWN')}/data`;
  }
  const code = codigoTienda.trim().toUpperCase();
  try {
    const pv = await PuntoVentaModel.findByCode(code);
    if (!pv) return `tiwater/${code}/data`;

    const region = await RegionPuntoVentaModel.getRegionForPuntoVenta(pv.id);
    const ciudad = pv.ciudadId ? await CiudadModel.findById(pv.ciudadId) : null;
    const codigoRegion = region?.code || 'NoRegion';
    const ciudadName = ciudad?.name ? String(ciudad.name).replace(/\//g, '-').trim() : '';

    if (codigoRegion && ciudadName) {
      return `tiwater/${codigoRegion}/${ciudadName}/${code}/data`;
    }
    return `tiwater/${code}/data`;
  } catch (err) {
    console.warn(`[buildTiwaterTopic] Error for ${code}:`, err.message);
    return `tiwater/${code}/data`;
  }
}

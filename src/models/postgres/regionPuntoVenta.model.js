// src/models/postgres/regionPuntoVenta.model.js
// Join table: region_punto_venta

import { query } from '../../config/postgres.config.js';

class RegionPuntoVentaModel {
  static async link(regionId, puntoVentaId) {
    if (!regionId || !puntoVentaId) return null;
    try {
      const result = await query(
        `INSERT INTO region_punto_venta (region_id, punto_venta_id) VALUES ($1, $2)
         ON CONFLICT (region_id, punto_venta_id) DO NOTHING
         RETURNING *`,
        [regionId, puntoVentaId]
      );
      return result.rows?.[0] || { linked: true };
    } catch (err) {
      console.warn('[RegionPuntoVentaModel] Error linking:', err.message);
      return null;
    }
  }

  static async exists(regionId, puntoVentaId) {
    const result = await query(
      'SELECT 1 FROM region_punto_venta WHERE region_id = $1 AND punto_venta_id = $2 LIMIT 1',
      [regionId, puntoVentaId]
    );
    return result.rows?.length > 0;
  }

  /** Get region for a punto_venta (first linked region) */
  static async getRegionForPuntoVenta(puntoVentaId) {
    const result = await query(
      `SELECT r.id, r.code, r.name FROM regions r
       JOIN region_punto_venta rpv ON rpv.region_id = r.id
       WHERE rpv.punto_venta_id = $1 LIMIT 1`,
      [puntoVentaId]
    );
    return result.rows?.[0] || null;
  }

  /** Unlink a punto from a region */
  static async unlink(regionId, puntoVentaId) {
    if (!regionId || !puntoVentaId) return false;
    const result = await query(
      'DELETE FROM region_punto_venta WHERE region_id = $1 AND punto_venta_id = $2',
      [regionId, puntoVentaId]
    );
    return (result.rowCount || 0) > 0;
  }

  /** Unlink all regions for a punto (use before assigning new region) */
  static async unlinkAllForPunto(puntoVentaId) {
    if (!puntoVentaId) return false;
    const result = await query(
      'DELETE FROM region_punto_venta WHERE punto_venta_id = $1',
      [puntoVentaId]
    );
    return (result.rowCount || 0) >= 0;
  }

  /** Get puntos linked to a region (returns punto_venta_id list with pv details) */
  static async getPuntosForRegion(regionId) {
    if (!regionId) return [];
    const result = await query(
      `SELECT pv.id, pv.name, pv.codigo_tienda, pv.code
       FROM puntoventa pv
       JOIN region_punto_venta rpv ON rpv.punto_venta_id = pv.id
       WHERE rpv.region_id = $1
       ORDER BY pv.codigo_tienda, pv.name`,
      [regionId]
    );
    return (result.rows || []).map((r) => ({
      id: String(r.id),
      name: r.name || null,
      codigo_tienda: r.codigo_tienda || r.code || null
    }));
  }
}

export default RegionPuntoVentaModel;

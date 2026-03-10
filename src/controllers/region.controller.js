import RegionModel from '../models/postgres/region.model.js';
import RegionPuntoVentaModel from '../models/postgres/regionPuntoVenta.model.js';

export const getRegions = async (req, res) => {
  try {
    const regions = await RegionModel.findAll();
    res.json(regions);
  } catch (error) {
    console.error('[RegionController] Error fetching regions:', error);
    res.status(500).json({ message: 'Error al obtener regiones', error: error.message });
  }
};

export const getRegionById = async (req, res) => {
  try {
    const { id } = req.params;
    const region = await RegionModel.findById(id);
    if (!region) {
      return res.status(404).json({ message: 'Región no encontrada' });
    }
    res.json(region);
  } catch (error) {
    console.error('[RegionController] Error fetching region:', error);
    res.status(500).json({ message: 'Error al obtener región', error: error.message });
  }
};

export const updateRegion = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, color } = req.body || {};
    const region = await RegionModel.findById(id);
    if (!region) {
      return res.status(404).json({ message: 'Región no encontrada' });
    }
    const updated = await RegionModel.update(id, { code, name, color });
    res.json(updated);
  } catch (error) {
    console.error('[RegionController] Error updating region:', error);
    res.status(500).json({ message: 'Error al actualizar región', error: error.message });
  }
};

export const getRegionPuntos = async (req, res) => {
  try {
    const { id } = req.params;
    const region = await RegionModel.findById(id);
    if (!region) {
      return res.status(404).json({ message: 'Región no encontrada' });
    }
    const puntos = await RegionPuntoVentaModel.getPuntosForRegion(id);
    res.json(puntos);
  } catch (error) {
    console.error('[RegionController] Error fetching region puntos:', error);
    res.status(500).json({ message: 'Error al obtener puntos de la región', error: error.message });
  }
};

/**
 * Set the list of puntos de venta linked to this region (replaces existing).
 * Body: { punto_venta_ids: number[] }
 */
export const setRegionPuntos = async (req, res) => {
  try {
    const { id } = req.params;
    const region = await RegionModel.findById(id);
    if (!region) {
      return res.status(404).json({ message: 'Región no encontrada' });
    }
    const puntoVentaIds = req.body?.punto_venta_ids;
    const ids = Array.isArray(puntoVentaIds)
      ? puntoVentaIds.map((pv) => (typeof pv === 'number' ? pv : parseInt(String(pv), 10))).filter((n) => !isNaN(n))
      : [];
    await RegionPuntoVentaModel.setPuntosForRegion(id, ids);
    const puntos = await RegionPuntoVentaModel.getPuntosForRegion(id);
    res.json(puntos);
  } catch (error) {
    console.error('[RegionController] Error setting region puntos:', error);
    res.status(500).json({ message: 'Error al actualizar puntos de la región', error: error.message });
  }
};

export const createRegion = async (req, res) => {
  try {
    const { code, name, color } = req.body || {};
    const codeStr = (code || '').trim().toUpperCase();
    if (!codeStr) {
      return res.status(400).json({ message: 'El código de región es requerido' });
    }
    const created = await RegionModel.create({
      code: codeStr,
      name: (name || '').trim() || codeStr,
      color: color != null ? String(color).trim() || null : null,
    });
    if (!created) {
      return res.status(409).json({ message: 'Ya existe una región con ese código' });
    }
    res.status(201).json(created);
  } catch (error) {
    console.error('[RegionController] Error creating region:', error);
    res.status(500).json({ message: 'Error al crear región', error: error.message });
  }
};

export const deleteRegion = async (req, res) => {
  try {
    const { id } = req.params;
    const region = await RegionModel.findById(id);
    if (!region) {
      return res.status(404).json({ message: 'Región no encontrada' });
    }
    const deleted = await RegionModel.delete(id);
    if (!deleted) {
      return res.status(500).json({ message: 'No se pudo eliminar la región' });
    }
    res.status(200).json({ message: 'Región eliminada' });
  } catch (error) {
    console.error('[RegionController] Error deleting region:', error);
    res.status(500).json({ message: 'Error al eliminar región', error: error.message });
  }
};

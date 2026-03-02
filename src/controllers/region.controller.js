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
    const { code, name } = req.body || {};
    const region = await RegionModel.findById(id);
    if (!region) {
      return res.status(404).json({ message: 'Región no encontrada' });
    }
    const updated = await RegionModel.update(id, { code, name });
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

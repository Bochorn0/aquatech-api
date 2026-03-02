import RegionModel from '../models/postgres/region.model.js';

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

import CiudadModel from '../models/postgres/ciudad.model.js';

export const getCiudades = async (req, res) => {
  try {
    const { region_id } = req.query;
    const ciudades = region_id
      ? await CiudadModel.findByRegion(region_id)
      : await CiudadModel.findAll();
    res.json(ciudades);
  } catch (error) {
    console.error('[CiudadController] Error fetching ciudades:', error);
    res.status(500).json({ message: 'Error al obtener ciudades', error: error.message });
  }
};

export const getCiudadById = async (req, res) => {
  try {
    const { id } = req.params;
    const ciudad = await CiudadModel.findById(id);
    if (!ciudad) {
      return res.status(404).json({ message: 'Ciudad no encontrada' });
    }
    res.json(ciudad);
  } catch (error) {
    console.error('[CiudadController] Error fetching ciudad:', error);
    res.status(500).json({ message: 'Error al obtener ciudad', error: error.message });
  }
};

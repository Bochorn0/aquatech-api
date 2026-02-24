import CityModel from '../models/postgres/city.model.js';

export const saveAllCities = async (req, res) => {
  try {
    const cities = req.body;
    const created = [];
    for (const c of cities) {
      try {
        const createdCity = await CityModel.create(c);
        if (createdCity) created.push(createdCity);
      } catch (e) {
        if (e.message?.includes('already exists')) continue;
        throw e;
      }
    }
    res.status(201).json(created);
  } catch (error) {
    console.error('Error saving cities:', error);
    res.status(500).json({ message: 'Error al guardar ciudades' });
  }
};

export const getCities = async (req, res) => {
  try {
    const cities = await CityModel.findAll();
    res.status(200).json(cities);
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({ message: 'Error al obtener ciudades', error });
  }
};

export const getCityById = async (req, res) => {
  try {
    const { cityId } = req.params;
    const city = await CityModel.findById(cityId);
    if (!city) {
      return res.status(404).json({ message: 'Ciudad no encontrada' });
    }
    res.status(200).json(city);
  } catch (error) {
    console.error('Error fetching city:', error);
    res.status(500).json({ message: 'Error al obtener ciudad', error });
  }
};

export const updateCity = async (req, res) => {
  try {
    const { cityId } = req.params;
    delete req.body._id;
    const updatedCity = await CityModel.update(cityId, req.body);
    if (!updatedCity) {
      return res.status(404).json({ message: 'Ciudad no encontrada' });
    }
    res.status(200).json(updatedCity);
  } catch (error) {
    console.error('Error updating city:', error);
    res.status(500).json({ message: 'Error al actualizar ciudad', error });
  }
};

export const addCity = async (req, res) => {
  try {
    const cityData = req.body;
    delete cityData._id;
    const currentCity = await CityModel.findByName(cityData.name);
    if (currentCity) {
      return res.status(409).json({ message: 'Esta ciudad ya existe' });
    }
    const newCity = await CityModel.create(cityData);
    res.status(201).json(newCity);
  } catch (error) {
    console.error('Error adding city:', error);
    res.status(500).json({ message: 'Error al agregar ciudad', error });
  }
};

export const removeCity = async (req, res) => {
  try {
    const { cityId } = req.params;
    const deleted = await CityModel.delete(cityId);
    if (!deleted) {
      return res.status(404).json({ message: 'Ciudad no encontrada' });
    }
    res.status(200).json({ message: 'Ciudad eliminada' });
  } catch (error) {
    console.error('Error removing city:', error);
    res.status(500).json({ message: 'Error al eliminar ciudad', error });
  }
};

import City from '../models/city.model.js';

// Controller to save all cities
export const saveAllCities = async (req, res) => {
  try {
    const cities = req.body;
    await City.insertMany(cities);
    res.status(201).json(cities);
  } catch (error) {
    console.error('Error saving cities:', error);
    res.status(500).json({ message: 'Error al guardar ciudades' });
  }
};

// Controller to get all cities
export const getCities = async (req, res) => {
  try {
    const cities = await City.find();
    res.status(200).json(cities);
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({ message: 'Error al obtener ciudades', error });
  }
};

// Controller to get a specific city by its ID
export const getCityById = async (req, res) => {
  try {
    const { cityId } = req.params;
    const city = await
    City
    .findOne({ _id: cityId });
    if (!city) {
      return res.status(404).json({ message: 'Ciudad no encontrada' });
    }
    res.status(200).json(city);
  }
  catch (error) {
    console.error('Error fetching city:', error);
    res.status(500).json({ message: 'Error al obtener ciudad', error });
  }
}

// Controller to update a city by its ID
export const updateCity = async (req, res) => {
  try {
    const { cityId } = req.params;
    delete req.body._id;
    const updatedCity = await City
    .findOneAndUpdate({
      _id: cityId
    }, req.body, {
      new: true
    });
    if (!updatedCity) {
      return res.status(404).json({
        message: 'Ciudad no encontrada'
      });
    }
    res.status(200).json(updatedCity);
  }
  catch (error) {
    console.error('Error updating city:', error);
    res.status(500).json({
      message: 'Error al actualizar ciudad',
      error
    });
  }
}

// add new city
export const addCity = async (req, res) => {
  try {
    const cityData = req.body;
    delete cityData._id;
    const currentCity = await City.findOne
    ({
      name: cityData.name
    });
    if (currentCity) {
      return res.status(409).json({
        message: 'Esta ciudad ya existe'
      });
    }
    const newCity = new City(cityData);
    await newCity.save();
    res.status(201).json(newCity);
  }
  catch (error) {
    console.error('Error adding city:', error);
    res.status(500).json({
      message: 'Error al agregar ciudad',
      error
    });
  }
}

// Controller to remove a city by its ID
export const removeCity = async (req, res) => {
  try {
    const {
      cityId
    } = req.params;
    const city = await City.findOneAndDelete
    ({
      _id: cityId
    }); 
    if (!city) {
      return res.status(404).json({
        message: 'Ciudad no encontrada'
      });
    }
    res.status(200).json(city);
  } catch (error) {
    console.error('Error removing city:', error);
    res.status(500).json({
      message: 'Error al eliminar ciudad',
      error
    });
  }
}
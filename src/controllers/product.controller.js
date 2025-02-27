// src/controllers/product.controller.js
 import Product from '../models/product.model.js';
import * as tuyaService from '../services/tuya.service.js';  

const mexicoCities = [
  { state: "Aguascalientes", city: "Aguascalientes", lat: 21.8853, lon: -102.2916 },
  { state: "Baja California", city: "Tijuana", lat: 32.5149, lon: -117.0382 },
  { state: "Baja California Sur", city: "La Paz", lat: 24.1426, lon: -110.3009 },
  { state: "Campeche", city: "Campeche", lat: 19.8301, lon: -90.5349 },
  { state: "Chiapas", city: "Tuxtla Gutiérrez", lat: 16.7531, lon: -93.1167 },
  { state: "Chihuahua", city: "Chihuahua", lat: 28.6329, lon: -106.0691 },
  { state: "Coahuila", city: "Saltillo", lat: 25.4381, lon: -100.9762 },
  { state: "Colima", city: "Colima", lat: 19.2433, lon: -103.725 },
  { state: "Durango", city: "Durango", lat: 24.0277, lon: -104.6532 },
  { state: "Guanajuato", city: "León", lat: 21.1221, lon: -101.68 },
  { state: "Guerrero", city: "Acapulco", lat: 16.8531, lon: -99.8237 },
  { state: "Hidalgo", city: "Pachuca", lat: 20.125, lon: -98.7333 },
  { state: "Jalisco", city: "Guadalajara", lat: 20.6597, lon: -103.3496 },
  { state: "Mexico", city: "Toluca", lat: 19.2826, lon: -99.6557 },
  { state: "Mexico City", city: "Mexico City", lat: 19.4326, lon: -99.1332 },
  { state: "Michoacán", city: "Morelia", lat: 19.705, lon: -101.1944 },
  { state: "Morelos", city: "Cuernavaca", lat: 18.9186, lon: -99.2343 },
  { state: "Nayarit", city: "Tepic", lat: 21.5061, lon: -104.8937 },
  { state: "Nuevo León", city: "Monterrey", lat: 25.6866, lon: -100.3161 },
  { state: "Oaxaca", city: "Oaxaca de Juárez", lat: 17.0654, lon: -96.7237 },
  { state: "Puebla", city: "Puebla", lat: 19.0414, lon: -98.2063 },
  { state: "Querétaro", city: "Querétaro", lat: 20.5881, lon: -100.3881 },
  { state: "Quintana Roo", city: "Cancún", lat: 21.1619, lon: -86.8515 },
  { state: "San Luis Potosí", city: "San Luis Potosí", lat: 22.1498, lon: -100.9792 },
  { state: "Sinaloa", city: "Culiacán", lat: 24.8071, lon: -107.394 },
  { state: "Sonora", city: "Hermosillo", lat: 29.0729, lon: -110.9559 },
  { state: "Tabasco", city: "Villahermosa", lat: 17.9869, lon: -92.9303 },
  { state: "Tamaulipas", city: "Ciudad Victoria", lat: 23.7369, lon: -99.1411 },
  { state: "Tlaxcala", city: "Tlaxcala", lat: 19.3139, lon: -98.2403 },
  { state: "Veracruz", city: "Xalapa", lat: 19.5438, lon: -96.9103 },
  { state: "Yucatán", city: "Mérida", lat: 20.967, lon: -89.623 },
  { state: "Zacatecas", city: "Zacatecas", lat: 22.7709, lon: -102.5832 }
];

export const getAllProducts = async (req, res) => {
  try {
    console.log('Fetching products from MongoDB...');
    
    // Check if products exist in MongoDB
    let products = await Product.find({});

    if (products.length === 0) {
      console.log('No products found in database. Fetching from Tuya API...');
      
      // Fetch products from Tuya API
      const tuyaResponse = await tuyaService.getAllDevices();

      if (!tuyaResponse || !tuyaResponse.result) {
        return res.status(404).json({ message: 'No products found in Tuya API' });
      }

      // Store products in MongoDB
      const storedProducts = await Product.insertMany(tuyaResponse.result);
      console.log(`${storedProducts.length} products saved to database.`);

      // Return stored products
      products = storedProducts;
    }

    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Error fetching products' });
  }
};


export const generateAllProducts = async (req, res) => {
  try {
    const mapedResults = await mockedProducts();
    res.status(200).json(mapedResults);
  } catch (error) {
      console.error("Error generating product data:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
};


export const mockedProducts = async () => {
  try {
  const realProducts = await tuyaService.getAllDevices();
  realProducts.result.map((product) => {
      product.city = "Hermosillo";
      product.drive = "BochoApp";
  });
  const randomValue = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  const drives = ["Humalla", "Piaxtla", "Tierra Blanca", "Estadio", "Sarzana", "Buena vista", "Valle marquez", "Aeropuerto", "Navarrete", "Planta2", "Pinos", "Perisur"];

  const baseData = {
      id: 'eb5741b947793cb5d0ozyb',
      active_time: Date.now(),
      biz_type: 0,
      category: "js",
      create_time: Date.now(),
      icon: "smart/icon/bay17049404440506Gfw/21e41e127c1218287e740739d48af02c.png",
      owner_id: "234238561",
      product_id: "lztrcjsskc1hlltu",
      product_name: "Sample Product",
      sub: false,
      time_zone: "-07:00",
      update_time: Date.now(),
  };

  // Generate 1000 random records
  realProducts.result[0].lat  = '29.0729';
  realProducts.result[0].lon = '-110.9559';
  realProducts.result[1].lat  = '29.0729';
  realProducts.result[1].lon = '-110.9559';
  const mockedData = { result: realProducts.result };
  for (let i = 0; i < 1000; i++) {
    const { lat, lon } = getRandomCoordinateInMexico();
    const city = getClosestCity(lat, lon).city;
      mockedData.result.push({
          ...baseData,
          id: `device_${i}`,
          name: `Device CB-5 - #${i}`,
          create_time: new Date(Date.now() - randomValue(0, 365) * 1000 * 60 * 60 * 24),
          model: `model_${randomValue(100, 999)}`,
          online: Math.random() < 0.5,
          ip: `${randomValue(10, 255)}.${randomValue(10, 255)}.${randomValue(10, 255)}.${randomValue(10, 255)}`,
          lat,
          lon,
          uid: `user_${randomValue(1000, 9999)}`,
          uuid: `${randomValue(100000, 999999)}`,
          // city: cities[randomValue(0, cities.length - 1)],  // Random city
          city,
          drive: drives[randomValue(0, drives.length - 1)],  // Random drive
          status: [
            { code: "tds_out", value: randomValue(5, 20) },
            { code: "water_overflow", value: Math.random() < 0.5 },
            { code: "water_wash", value: Math.random() < 0.5 },
            { code: "filter_element_1", value: randomValue(0, 180) },
            { code: "filter_element_2", value: randomValue(0, 270) },
            { code: "filter_element_3", value: randomValue(0, 270) },
            { code: "filter_element_4", value: randomValue(0, 270) },
            { code: "flowrate_total_1", value: randomValue(10, 500) },
            { code: "flowrate_total_2", value: randomValue(10, 30) },
            { code: "flowrate_speed_1", value: randomValue(0, 200) },
            { code: "flowrate_speed_2", value: randomValue(0, 20) },
            { code: "temperature", value: randomValue(20, 40) }
        ],
      });
    }

    // Process the product status to adjust certain flowrate values
    const mapedResults = mockedData.result.map((product) => {
        product.status.map((stat) => {
            const arrayCodes = ["flowrate_total_1", "flowrate_total_2", "flowrate_speed_1", "flowrate_speed_2"];
            if (arrayCodes.includes(stat.code) && stat.value > 0) {
                stat.value = stat.value / 10;
            }
            return stat;
        });
        return product;
    });
    return mapedResults;
  } catch (error) {
    console.error("Error generating product data:", error);
    return error;
  }
}

// Fetch a single product by ID from MongoDB
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Fetching product details for:', id);
    
    
    // const product = await Product.findOne({ id });
    // if (!product) {
    //   console.log('Fetching product from Tuya API...');
    //   const { id } = req.params;
      const response = await tuyaService.getDeviceDetail(id);
    //   if (!response || !response.result) {
    //     return res.status(404).json({ message: 'Device not found in Tuya API' });
    //   }
  
    //   // Create new product object
    //   const newProduct = new Product(response.result[0]);
  
    //   // Save to MongoDB
    //   await newProduct.save();
    //   console.log(`Product ${id} saved to MongoDB.`);
    //   console.log('newProduct', newProduct);
      res.json(response.result);
    // }

    // res.json(product);
  } catch (error) {
    console.error('Error fetching product details:', error);
    res.status(500).json({ message: 'Error fetching product details' });
  }
};

// Fetch a single product by ID from MongoDB
export const getProductLogsById = async (req, res) => {
  try {
    // const product = await Product.findOne({ id });
    // if (!product) {
    //   console.log('Fetching product from Tuya API...');
    // const { id } = req.params;
    const response = await tuyaService.getDeviceLogs(req.query);
    //   if (!response || !response.result) {
    //     return res.status(404).json({ message: 'Device not found in Tuya API' });
    //   }
  
    //   // Create new product object
    //   const newProduct = new Product(response.result[0]);
  
    //   // Save to MongoDB
    //   await newProduct.save();
    //   console.log(`Product ${id} saved to MongoDB.`);
    //   console.log('newProduct', newProduct);
      res.json(response.result);
    // }

    // res.json(product);
  } catch (error) {
    console.error('Error fetching product details:', error);
    res.status(500).json({ message: 'Error fetching product details' });
  }
};

// Save a product from Tuya API to MongoDB
export const saveProduct = async (req, res) => {
  try {
    console.log('Fetching product from Tuya API...');
    const { id } = req.params;
    const response = await tuyaService.getDeviceDetail(id);

    if (!response || !response.result) {
      return res.status(404).json({ message: 'Device not found in Tuya API' });
    }

    // Create new product object
    const newProduct = new Product(response.result);

    // Save to MongoDB
    await newProduct.save();
    console.log(`Product ${id} saved to MongoDB.`);

    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Error saving product:', error);
    res.status(500).json({ message: 'Error saving product' });
  }
};

// Fetch and update product metrics
export const getProductMetrics = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findOne({ id });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    console.log('Fetching status from Tuya API...');
    const status = await tuyaService.getDeviceStatus(id);

    // Update product metrics
    product.status = status;
    product.update_time = Date.now();
    await product.save();

    res.json(product);
  } catch (error) {
    console.error('Error fetching product metrics:', error);
    res.status(500).json({ message: 'Error fetching product metrics' });
  }
};

// Execute commands on a device
export const sendDeviceCommands = async (req, res) => {
  try {
    console.log('Executing device commands...', req.body);
    const { id, commands } = req.body; // Extract from request body

    if (!id || !commands || !Array.isArray(commands)) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for 2 seconds
      return res.status(400).json({ message: "Invalid request payload" });
    }

    console.log(`Sending commands to device ${id}:`, commands);

    const response = await tuyaService.executeCommands({id, commands});
    console.log('response commands:', response);
    // await new Promise(resolve => setTimeout(resolve, 2000)); // Simulating delay
    // const response = { executed: true };
    const deviceData = await tuyaService.getDeviceDetail(id);

    res.json({executed: true, deviceData: deviceData.result});
  } catch (error) {
    console.error("Error executing device command:", error);
    res.status(500).json({ message: "Error executing device command" });
  }
};

function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (angle) => (Math.PI * angle) / 180;
  const R = 6371; // Earth's radius in km

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getClosestCity(lat, lon) {

// console.log(mexicoCities);

  let closestCity = mexicoCities[0];
  let minDistance = haversine(lat, lon, closestCity.lat, closestCity.lon);

  for (const city of mexicoCities) {
      const distance = haversine(lat, lon, city.lat, city.lon);
      if (distance < minDistance) {
          minDistance = distance;
          closestCity = city;
      }
  }

  return closestCity;
};

function getRandomCoordinateInMexico() {
  // // Select two random cities
  // const city1 = mexicoCities[Math.floor(Math.random() * mexicoCities.length)];
  // const city2 = mexicoCities[Math.floor(Math.random() * mexicoCities.length)];

  // // Ensure latitudes and longitudes are valid (lat1 < lat2 and lon1 < lon2)
  // const latMin = Math.min(city1.lat, city2.lat);
  // const latMax = Math.max(city1.lat, city2.lat);
  // const lonMin = Math.min(city1.lon, city2.lon);
  // const lonMax = Math.max(city1.lon, city2.lon);

  // // Generate random coordinates between the two cities
  // const lat = (Math.random() * (latMax - latMin) + latMin).toFixed(4);
  // const lon = (Math.random() * (lonMax - lonMin) + lonMin).toFixed(4);
    // Select a random city from the list
    const city = mexicoCities[Math.floor(Math.random() * mexicoCities.length)];
  
    // Return the coordinates of the randomly selected city
    const lat = city.lat.toFixed(4);
    const lon = city.lon.toFixed(4);
    return { lat, lon };
}
// cities detailed
// const mexicoCities = [
//   { state: "Aguascalientes", city: "Jesús María", lat: 21.9614, lon: -102.3436 },
//   { state: "Aguascalientes", city: "Calvillo", lat: 21.8456, lon: -102.7181 },
  
//   { state: "Baja California", city: "Mexicali", lat: 32.6245, lon: -115.4523 },
//   { state: "Baja California", city: "Ensenada", lat: 31.8667, lon: -116.5997 },

//   { state: "Baja California Sur", city: "Cabo San Lucas", lat: 22.8909, lon: -109.9124 },
//   { state: "Baja California Sur", city: "San José del Cabo", lat: 23.0631, lon: -109.7028 },

//   { state: "Campeche", city: "Ciudad del Carmen", lat: 18.6516, lon: -91.8078 },
//   { state: "Campeche", city: "Champotón", lat: 19.3447, lon: -90.7261 },

//   { state: "Chiapas", city: "Tapachula", lat: 14.9031, lon: -92.2575 },
//   { state: "Chiapas", city: "San Cristóbal de las Casas", lat: 16.737, lon: -92.6376 },

//   { state: "Chihuahua", city: "Ciudad Juárez", lat: 31.7398, lon: -106.485 },
//   { state: "Chihuahua", city: "Delicias", lat: 28.1915, lon: -105.4717 },

//   { state: "Coahuila", city: "Torreón", lat: 25.5428, lon: -103.4068 },
//   { state: "Coahuila", city: "Monclova", lat: 26.9007, lon: -101.4208 },

//   { state: "Colima", city: "Manzanillo", lat: 19.05, lon: -104.3333 },
//   { state: "Colima", city: "Tecomán", lat: 18.9167, lon: -103.8833 },

//   { state: "Durango", city: "Gómez Palacio", lat: 25.5647, lon: -103.4966 },
//   { state: "Durango", city: "Lerdo", lat: 25.5388, lon: -103.5248 },

//   { state: "Guanajuato", city: "Irapuato", lat: 20.6761, lon: -101.3563 },
//   { state: "Guanajuato", city: "Celaya", lat: 20.5233, lon: -100.815 },

//   { state: "Guerrero", city: "Zihuatanejo", lat: 17.6383, lon: -101.5515 },
//   { state: "Guerrero", city: "Chilpancingo", lat: 17.5514, lon: -99.5058 },

//   { state: "Hidalgo", city: "Tizayuca", lat: 19.8367, lon: -98.9808 },
//   { state: "Hidalgo", city: "Tulancingo", lat: 20.0833, lon: -98.3667 },

//   { state: "Jalisco", city: "Zapopan", lat: 20.7167, lon: -103.4 },
//   { state: "Jalisco", city: "Puerto Vallarta", lat: 20.6534, lon: -105.2253 },

//   { state: "Mexico", city: "Ecatepec", lat: 19.6097, lon: -99.06 },
//   { state: "Mexico", city: "Naucalpan", lat: 19.4785, lon: -99.2396 },

//   { state: "Michoacán", city: "Uruapan", lat: 19.4167, lon: -102.05 },
//   { state: "Michoacán", city: "Zamora", lat: 19.9856, lon: -102.2839 },

//   { state: "Morelos", city: "Jiutepec", lat: 18.8826, lon: -99.1775 },
//   { state: "Morelos", city: "Cuautla", lat: 18.8121, lon: -98.9542 },

//   { state: "Nayarit", city: "Bahía de Banderas", lat: 20.8031, lon: -105.2048 },
//   { state: "Nayarit", city: "Compostela", lat: 21.2333, lon: -104.9 },

//   { state: "Nuevo León", city: "San Nicolás de los Garza", lat: 25.7492, lon: -100.289 },
//   { state: "Nuevo León", city: "San Pedro Garza García", lat: 25.6578, lon: -100.4022 },

//   { state: "Oaxaca", city: "Salina Cruz", lat: 16.1667, lon: -95.2 },
//   { state: "Oaxaca", city: "Juchitán de Zaragoza", lat: 16.4342, lon: -95.0203 },

//   { state: "Puebla", city: "Tehuacán", lat: 18.4667, lon: -97.4 },
//   { state: "Puebla", city: "Atlixco", lat: 18.9, lon: -98.4333 },

//   { state: "Querétaro", city: "San Juan del Río", lat: 20.3833, lon: -99.9833 },
//   { state: "Querétaro", city: "El Marqués", lat: 20.5667, lon: -100.2833 },

//   { state: "Quintana Roo", city: "Playa del Carmen", lat: 20.6296, lon: -87.0739 },
//   { state: "Quintana Roo", city: "Chetumal", lat: 18.5036, lon: -88.305 },

//   { state: "San Luis Potosí", city: "Ciudad Valles", lat: 21.9833, lon: -99.0167 },
//   { state: "San Luis Potosí", city: "Matehuala", lat: 23.65, lon: -100.65 },

//   { state: "Sinaloa", city: "Mazatlán", lat: 23.2167, lon: -106.4167 },
//   { state: "Sinaloa", city: "Los Mochis", lat: 25.7903, lon: -108.99 },

//   { state: "Sonora", city: "Nogales", lat: 31.305, lon: -110.9442 },
//   { state: "Sonora", city: "Cajeme", lat: 27.4926, lon: -109.9304 },

//   { state: "Tamaulipas", city: "Reynosa", lat: 26.0922, lon: -98.2772 },
//   { state: "Tamaulipas", city: "Matamoros", lat: 25.8697, lon: -97.5025 },

//   { state: "Veracruz", city: "Coatzacoalcos", lat: 18.1333, lon: -94.45 },
//   { state: "Veracruz", city: "Orizaba", lat: 18.85, lon: -97.1 },

//   { state: "Yucatán", city: "Valladolid", lat: 20.6897, lon: -88.2011 },
//   { state: "Yucatán", city: "Tizimín", lat: 21.1422, lon: -88.1508 }
// ];
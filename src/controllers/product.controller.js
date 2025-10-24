import Product from '../models/product.model.js';
import City from '../models/city.model.js';
import User from '../models/user.model.js';
import Client from '../models/client.model.js';
import Controller from '../models/controller.model.js';
import ProductLog from '../models/product_logs.model.js';
import * as tuyaService from '../services/tuya.service.js';
import moment from 'moment';


const drives = ["Humalla", "Piaxtla", "Tierra Blanca", "Estadio", "Sarzana", "Buena vista", "Valle marquez", "Aeropuerto", "Navarrete", "Planta2", "Pinos", "Perisur"];

export const getAllProducts = async (req, res) => {
  try {
    const user = req.user;
    const query = req.query;
    const uid = 'az1739408936787MhA1Y';  // Example user ID
    // const realProducts = {data: [{}]}
    const ONLINE_THRESHOLD_MS = 5000; // 5 segundos
    const now = Date.now();
    const realProducts = await tuyaService.getAllDevices(uid);
    console.log('realProducts', realProducts);
    if (!realProducts.success) {
      return res.status(400).json({ message: realProducts.error, code: realProducts.code });
    }
    // Client List
    const clientes = await Client.find();
    // mocked products 
    if (query.mocked) {
      const mockProducts = await mockedProducts();
      return res.status(200).json(mockProducts);
    }
    const filtros = {};
    // Set cliente filter
    if (query.cliente) {
      filtros.cliente = query.cliente;
    } else {
      const id = user.id;
      const userData = await User.findById(id, { cliente: 1 });
      if (userData && userData.cliente) {
        filtros.cliente = userData.cliente;
      } else {
        return res.status(400).json({ message: 'Cliente not found for user' });
      }
    }
    const currentclient = clientes.find(cliente => cliente._id.toString() === filtros.cliente.toString());
    if (filtros.cliente && currentclient.name === 'All') {
      delete filtros.cliente;
    }

    // Set city and state filters
    if (query.city && query.city !== 'All') {
      filtros.city = query.city;
    }
    if (query.state && query.state !== 'All') {
      filtros.state = query.state;
    }
    // Set drive filter
    if (query.drive && query.drive !== 'All') {
      filtros.drive = query.drive;
    }
    // Set status filter
    if (query.status && query.status !== 'All') {
      const online = query.status === 'Online' ? true : false;
      filtros.online = online;
    }
    // Convert and filter by `create_time` (Unix timestamp)
    if (query.startDate && query.endDate && query.startDate !== 'null' && query.endDate !== 'null') {
      const startTimestamp = Math.floor(new Date(query.startDate).getTime() / 1000);
      const endTimestamp = Math.floor(new Date(query.endDate).getTime() / 1000);

      if (!isNaN(startTimestamp) && !isNaN(endTimestamp)) {
        filtros.create_time = { $gte: startTimestamp, $lte: endTimestamp };
      } else {
        return res.status(400).json({ message: 'Invalid date format' });
      }
    }

    console.log('Fetching products from MongoDB with filters:', filtros);


    let products = await Product.find(filtros);
    if (products.length === 0) {
      console.log('No products found in database. Fetching from Tuya API...');
      
      // Fetch from Tuya API (commented out but should be handled properly)
      // const tuyaResponse = await tuyaService.getAllDevices();
      // if (!tuyaResponse || !tuyaResponse.result) {
      //   return res.status(404).json({ message: 'No products found in Tuya API' });
      // }
      // const storedProducts = await Product.insertMany(tuyaResponse.result);
      // console.log(`${storedProducts.length} products saved to database.`);
      // products = storedProducts;
    }
    products.map((product) => {
      // Determinar si está online según last_time_active
      const isOnline = product.last_time_active && (now - product.last_time_active <= ONLINE_THRESHOLD_MS);
      product.online = isOnline;
      const realProduct = realProducts.data.find(realProduct => realProduct.id === product.id);
      if (realProduct) {
        product.online = realProduct.online;
        product.name = realProduct.name;
        product.ip = realProduct.ip;
        product.status = realProduct.status;
        if (product.id === 'ebe24cce942e6266b1wixy') {
          product.product_type = 'Nivel'
        }
      }
      const cliente = clientes.find(cliente => cliente._id.toString() === product.cliente.toString());
      product.cliente = cliente;
      product.status.map((stat) => {
        // "flowrate_total_1", "flowrate_total_2",
          const arrayCodes = ["flowrate_speed_1", "flowrate_speed_2"];
          if (arrayCodes.includes(stat.code) && stat.value > 0) {
              stat.value = stat.value / 10;
          }
          return stat;
      });
    });

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

export const saveAllProducts = async (req, res) => {
  try {
    const mapedResults = await mockedProducts();
    const storedProducts = await Product.insertMany(mapedResults);
    console.log(`${storedProducts.length} products saved to database.`);
    res.status(200).json(storedProducts);
  } catch (error) {
      console.error("Error generating product data:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
};

export const mockedProducts = async () => {
  try {
  const uid = 'az1739408936787MhA1Y';  // Example user ID
  const realProducts = await tuyaService.getAllDevices(iud);
  if (!realProducts.success) {
    return res.status(400).json({ message: realProducts.error, code: realProducts.code });
  }
  realProducts.data.map((product) => {
      product.city = "Hermosillo";
      product.state = "Sonora";
      product.drive = "TEST-APP";
  });
  const randomValue = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
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
  const startDate = moment('2024-01-01').unix();
  const endDate = moment('2025-01-01').unix();
  const clientes = await getClients();
  const mexicoCities = await getCities();  
  realProducts.data.map((product) => {
    product.cliente = clientes.find(cliente => cliente.name === 'Aquatech')._id;
    if(!product.lat || !product.lon) {
      product.lat = '29.0729';
      product.lon = '-110.9559';
    }
    
  });
  const mockedData = { result: realProducts.data };
  for (let i = 0; i < 1000; i++) {
    const cliente = clientes[randomValue(0, clientes.length - 1)];
    let drive = cliente.name
    if(['Caffenio', 'All'].includes(cliente.name)) {
      drive =  drives[randomValue(0, drives.length - 1)];
    } 
    const { lat, lon } =  getRandomCoordinateInMexico(mexicoCities);
    const cityData = getClosestCity(lat, lon, mexicoCities);
    const city = cityData.city;
    const state = cityData.state;
      mockedData.result.push({
          ...baseData,
          id: `device_${i}`,
          name: `Device CB-5 - #${i}`,
          create_time: startDate + Math.random() * (endDate - startDate),
          model: `model_${randomValue(100, 999)}`,
          online: Math.random() < 0.5,
          ip: `${randomValue(10, 255)}.${randomValue(10, 255)}.${randomValue(10, 255)}.${randomValue(10, 255)}`,
          lat,
          lon,
          uid: `user_${randomValue(1000, 9999)}`,
          uuid: `${randomValue(100000, 999999)}`,
          // city: cities[randomValue(0, cities.length - 1)],  // Random city
          city,  // Random client,
          state,  // Random
          cliente: cliente._id,  // Random client,
          drive,
          status: [
            { code: "tds_out", value: randomValue(50, 200) },
            { code: "water_overflow", value: Math.random() < 0.5 },
            { code: "water_wash", value: Math.random() < 0.5 },
            { code: "filter_element_1", value: randomValue(0, 180) },
            { code: "filter_element_2", value: randomValue(0, 270) },
            { code: "filter_element_3", value: randomValue(0, 270) },
            { code: "filter_element_4", value: randomValue(0, 270) },
            { code: "flowrate_total_1", value: randomValue(100, 900) },
            { code: "flowrate_total_2", value: randomValue(50, 1200) },
            { code: "flowrate_speed_1", value: randomValue(100, 1200) },
            { code: "flowrate_speed_2", value: randomValue(50, 800) },
            { code: "temperature", value: randomValue(20, 40) }
        ],
      });
    }

    // Process the product status to adjust certain flowrate values
    const mapedResults = mockedData.result.map((product) => {
        product.status.map((stat) => {
          // "flowrate_total_1", "flowrate_total_2",
            const arrayCodes = ["flowrate_speed_1", "flowrate_speed_2"];
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

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const ONLINE_THRESHOLD_MS = 5000; // 5 segundos
    const now = Date.now();
    console.log('Fetching product details for:', id);

    // Check if the product exists in MongoDB
    let product = await Product.findOne({ id });

    if (product) {
      console.log('Product found in MongoDB. Fetching latest details from Tuya API...');
      product.online = product.last_time_active && (now - product.last_time_active <= ONLINE_THRESHOLD_MS);
      
      // Fetch the latest details from Tuya API
      const response = await tuyaService.getDeviceDetail(id);
      console.log('response product detail', response)
      if (!response.success) {
        return res.status(400).json({ message: response.error, code: response.code });
      }
      if (response && response.data) {
        const updatedData = response.data; // Assuming this is the correct structure

        // Update MongoDB with the latest data from Tuya
        product = await Product.findOneAndUpdate(
          { id },
          updatedData,
          { new: true, runValidators: true }
        );

        console.log(`Product ${id} updated in MongoDB.`);
        return res.json(product);
      }

      // If Tuya API doesn't return data, return the existing MongoDB product
      console.log('Tuya API did not return data. Returning existing MongoDB product.');
      return res.json(product);
    } 

    // If product does not exist in MongoDB, fetch from Tuya API
    console.log('Product not found in MongoDB. Fetching from Tuya API...');
    const response = await tuyaService.getDeviceDetail(id);
    if (!response.success) {
      return res.status(400).json({ message: response.error, code: response.code });
    }

    if (!response || !response.result) {
      return res.status(404).json({ message: 'Device not found in Tuya API' });
    }

    // Save the new product to MongoDB
    const newProduct = new Product(response.result[0]);
    await newProduct.save();

    console.log(`Product ${id} saved to MongoDB.`);
    res.json(newProduct);
    
  } catch (error) {
    console.error('Error fetching product details:', error);
    res.status(500).json({ message: 'Error fetching product details' });
  }
};


// Fetch a single product by ID from MongoD /TUYA LOGS)
import ProductLog from '../models/ProductLog.js';
import tuyaService from '../services/tuyaService.js';

export const getProductLogsById = async (req, res) => {
  try {
    console.log('Fetching product logs for:', req.query);

    const {
      id,
      start_date,
      end_date,
      limit = 20,
      last_row_key = null,
    } = req.query.params || {};

    if (!id) {
      return res.status(400).json({ message: 'Missing required parameter: id' });
    }

    // ====== Preparar filtros para Tuya ======
    const filters = {
      id,
      start_date: start_date || Date.now() - 24 * 60 * 60 * 1000, // por defecto: últimas 24h
      end_date: end_date || Date.now(),
      fields: 'flowrate_speed_1,flowrate_speed_2,flowrate_total_1,flowrate_total_2', // hardcodeados
      size: limit,
      last_row_key,
    };

    let logs = [];
    let source = 'database';

    // ====== Intentar obtener desde Tuya ======
    try {
      const response = await tuyaService.getDeviceLogs(filters);

      if (response.success && response.data && response.data.logs?.length > 0) {
        logs = response.data.logs;
        source = 'tuya';
        console.log(`✅ Logs obtenidos desde Tuya (${logs.length})`);
      } else {
        console.warn('⚠️ No se encontraron logs en Tuya');
      }
    } catch (err) {
      console.warn('⚠️ Error al obtener logs de Tuya:', err.message);
    }

    // ====== Si Tuya no devolvió datos, usar base de datos local ======
    if (!logs.length) {
      console.log('🔁 Consultando logs desde base de datos local...');
      const query = { product_id: id };

      if (start_date && end_date) {
        query.createdAt = {
          $gte: new Date(Number(start_date)),
          $lte: new Date(Number(end_date)),
        };
      }

      logs = await ProductLog.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));

      console.log(`✅ Logs obtenidos desde DB (${logs.length})`);
    }

    const nextLastRowKey = logs.length > 0 ? logs[logs.length - 1]._id : null;

    return res.json({
      success: true,
      data: logs,
      next_last_row_key: nextLastRowKey,
      source,
    });

  } catch (error) {
    console.error('❌ Error fetching product logs:', error);
    return res.status(500).json({ message: 'Error fetching product logs' });
  }
};


// logs for products from logs table local logs
// export const getProductLogsById = async (req, res) => {
//   try {
//     console.log('Fetching product logs for:', req.query);

//     const {
//       id,
//       start_date,
//       end_date,
//       fields,
//       limit = 20,
//       last_row_key = null,
//     } = req.query.params || {};

//     if (!id) {
//       return res.status(400).json({ message: 'Missing required parameter: id' });
//     }

//     const query = {
//       product_id: id,
//     };

//     if (start_date && end_date) {
//       query.createdAt = {
//         $gte: new Date(Number(start_date)),
//         $lte: new Date(Number(end_date)),
//       };
//     }

//     const logs = await ProductLog.find(query)
//       .sort({ createdAt: -1 }) // orden descendente por fecha
//       .limit(parseInt(limit));

//     const nextLastRowKey = logs.length > 0 ? logs[logs.length - 1]._id : null;

//     return res.json({
//       success: true,
//       data: logs,
//       next_last_row_key: nextLastRowKey,
//     });

//   } catch (error) {
//     console.error('Error fetching product logs:', error);
//     return res.status(500).json({ message: 'Error fetching product logs' });
//   }
// };

// Save a product from Tuya API to MongoDB
export const saveProduct = async (req, res) => {
  try {
    console.log('Fetching product from Tuya API...');
    const { id } = req.params;
    const response = await tuyaService.getDeviceDetail(id);
    if (!response.success) {
      return res.status(400).json({ message: response.error, code: response.code });
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
    const response = await tuyaService.getDeviceStatus(id);
    if (!response.success) {
      return res.status(400).json({ message: response.error, code: response.code });
    }

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
    if (!response.success) {
      return res.status(400).json({ message: response.error, code: response.code });
    }
    console.log('response commands:', response);
    // await new Promise(resolve => setTimeout(resolve, 2000)); // Simulating delay
    // const response = { executed: true };
    const deviceData = await tuyaService.getDeviceDetail(id);
    if (!deviceData.success) {
      return res.status(400).json({ message: deviceData.error, code: deviceData.code });
    }

    res.json({executed: true, deviceData: deviceData.result});
  } catch (error) {
    console.error("Error executing device command:", error);
    res.status(500).json({ message: "Error executing device command" });
  }
};

export const componentInput = async (req, res) => {
  try {
    const { producto, real_data, tiempo_inicio, tiempo_fin } = req.body;
    console.log('body', req.body);

    if (!producto || !real_data || !tiempo_inicio || !tiempo_fin) {
      return res.status(400).json({ message: 'Faltan datos requeridos' });
    }

    const product = await Product.findById(producto);
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    // 🔹 Actualizar last_time_active en el Producto
    product.last_time_active = Date.now();

    // 🛠 Limpiar _id inválidos de status
    product.status = product.status.map(s => {
      if (s._id && typeof s._id === 'object' && '$oid' in s._id) {
        delete s._id;
      }
      return s;
    });

    await product.save(); // Guardamos cambios en producto

    // 🔹 Actualizar last_time_active en el Controller asociado
    const controller = await Controller.findOne({ product: producto });
    if (controller) {
      controller.last_time_active = Date.now();
      await controller.save();
    }

    const {
      tds = 0,
      temperature = 0,
      flujo_produccion = 0,
      flujo_rechazo = 0
    } = real_data;

    // Si no hay flujos, no se crea log
    if (flujo_produccion === 0 && flujo_rechazo === 0) {
      return res.status(204).send();
    }

    const inicio = new Date(tiempo_inicio);
    const fin = new Date(tiempo_fin);
    const duracionMin = (fin - inicio) / (1000 * 60); // en minutos

    const production_volume = flujo_produccion * duracionMin;
    const rejected_volume = flujo_rechazo * duracionMin;

    // Crear log del producto
    const log = new ProductLog({
      producto,
      product_id: product.id,
      tds,
      temperature,
      flujo_produccion,
      flujo_rechazo,
      production_volume,
      rejected_volume,
      tiempo_inicio: inicio,
      tiempo_fin: fin
    });
    await log.save();

    // Actualizar últimos valores de flujo y volúmenes acumulados
    updateStatusValue(product, 'flowrate_speed_1', flujo_produccion);
    updateStatusValue(product, 'flowrate_speed_2', flujo_rechazo);
    sumStatusValue(product, 'flowrate_total_1', production_volume);
    sumStatusValue(product, 'flowrate_total_2', rejected_volume);

    await product.save(); // Guardar cambios finales en status

    console.log('log data', log);
    res.status(201).json({
      message: 'Log creado',
      log
    });

  } catch (error) {
    console.error('Error creando log:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};


// 🔁 Actualiza o reemplaza valores
const updateStatusValue = (product, code, newValue) => {
  const index = product.status.findIndex(s => s.code === code);
  if (index !== -1) {
    product.status[index].value = newValue;
  } else {
    product.status.push({ code, value: newValue });
  }
};

// 🔼 Suma acumulativa a valores existentes
const sumStatusValue = (product, code, increment) => {
  const index = product.status.findIndex(s => s.code === code);
  if (index !== -1) {
    product.status[index].value += increment;
  } else {
    product.status.push({ code, value: increment });
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

function getClosestCity(lat, lon, mexicoCities) {
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

async function getCities() {
  try {
    const mexicoCities = await City.find();
    return mexicoCities;
  } catch (error) {
    console.error('Error fetching active users:', error);
    res.status(500).json({ message: 'Error fetching active users' });
  }
}

async function getClients() {
  try {
    const clients = await Client.find();
    return clients;
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ message: 'Error fetching clients' });
  }
}

function getRandomCoordinateInMexico(mexicoCities) {
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
//   { state: "Aguascalientes", city: "Jesus Maria", lat: 21.9614, lon: -102.3436 },
//   { state: "Aguascalientes", city: "Calvillo", lat: 21.8456, lon: -102.7181 },
  
//   { state: "Baja California", city: "Mexicali", lat: 32.6245, lon: -115.4523 },
//   { state: "Baja California", city: "Ensenada", lat: 31.8667, lon: -116.5997 },

//   { state: "Baja California Sur", city: "Cabo San Lucas", lat: 22.8909, lon: -109.9124 },
//   { state: "Baja California Sur", city: "San Jose del Cabo", lat: 23.0631, lon: -109.7028 },

//   { state: "Campeche", city: "Ciudad del Carmen", lat: 18.6516, lon: -91.8078 },
//   { state: "Campeche", city: "Champoton", lat: 19.3447, lon: -90.7261 },

//   { state: "Chiapas", city: "Tapachula", lat: 14.9031, lon: -92.2575 },
//   { state: "Chiapas", city: "San Cristobal de las Casas", lat: 16.737, lon: -92.6376 },

//   { state: "Chihuahua", city: "Ciudad Juarez", lat: 31.7398, lon: -106.485 },
//   { state: "Chihuahua", city: "Delicias", lat: 28.1915, lon: -105.4717 },

//   { state: "Coahuila", city: "Torreon", lat: 25.5428, lon: -103.4068 },
//   { state: "Coahuila", city: "Monclova", lat: 26.9007, lon: -101.4208 },

//   { state: "Colima", city: "Manzanillo", lat: 19.05, lon: -104.3333 },
//   { state: "Colima", city: "Tecoman", lat: 18.9167, lon: -103.8833 },

//   { state: "Durango", city: "Gomez Palacio", lat: 25.5647, lon: -103.4966 },
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

//   { state: "Michoacan", city: "Uruapan", lat: 19.4167, lon: -102.05 },
//   { state: "Michoacan", city: "Zamora", lat: 19.9856, lon: -102.2839 },

//   { state: "Morelos", city: "Jiutepec", lat: 18.8826, lon: -99.1775 },
//   { state: "Morelos", city: "Cuautla", lat: 18.8121, lon: -98.9542 },

//   { state: "Nayarit", city: "Bahia de Banderas", lat: 20.8031, lon: -105.2048 },
//   { state: "Nayarit", city: "Compostela", lat: 21.2333, lon: -104.9 },

//   { state: "Nuevo Leon", city: "San Nicolas de los Garza", lat: 25.7492, lon: -100.289 },
//   { state: "Nuevo Leon", city: "San Pedro Garza Garcia", lat: 25.6578, lon: -100.4022 },

//   { state: "Oaxaca", city: "Salina Cruz", lat: 16.1667, lon: -95.2 },
//   { state: "Oaxaca", city: "Juchitan de Zaragoza", lat: 16.4342, lon: -95.0203 },

//   { state: "Puebla", city: "Tehuacan", lat: 18.4667, lon: -97.4 },
//   { state: "Puebla", city: "Atlixco", lat: 18.9, lon: -98.4333 },

//   { state: "Queretaro", city: "San Juan del Rio", lat: 20.3833, lon: -99.9833 },
//   { state: "Queretaro", city: "El Marques", lat: 20.5667, lon: -100.2833 },

//   { state: "Quintana Roo", city: "Playa del Carmen", lat: 20.6296, lon: -87.0739 },
//   { state: "Quintana Roo", city: "Chetumal", lat: 18.5036, lon: -88.305 },

//   { state: "San Luis Potosi", city: "Ciudad Valles", lat: 21.9833, lon: -99.0167 },
//   { state: "San Luis Potosi", city: "Matehuala", lat: 23.65, lon: -100.65 },

//   { state: "Sinaloa", city: "Mazatlan", lat: 23.2167, lon: -106.4167 },
//   { state: "Sinaloa", city: "Los Mochis", lat: 25.7903, lon: -108.99 },

//   { state: "Sonora", city: "Nogales", lat: 31.305, lon: -110.9442 },
//   { state: "Sonora", city: "Cajeme", lat: 27.4926, lon: -109.9304 },

//   { state: "Tamaulipas", city: "Reynosa", lat: 26.0922, lon: -98.2772 },
//   { state: "Tamaulipas", city: "Matamoros", lat: 25.8697, lon: -97.5025 },

//   { state: "Veracruz", city: "Coatzacoalcos", lat: 18.1333, lon: -94.45 },
//   { state: "Veracruz", city: "Orizaba", lat: 18.85, lon: -97.1 },

//   { state: "Yucatan", city: "Valladolid", lat: 20.6897, lon: -88.2011 },
//   { state: "Yucatan", city: "Tizimin", lat: 21.1422, lon: -88.1508 }
// ];
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

    // Obtener productos de la BD
    let dbProducts = await Product.find(filtros);
    console.log(`📦 Found ${dbProducts.length} products in database`);
    console.log(`🌐 Found ${realProducts.data.length} products from Tuya`);

    // Crear un mapa de productos de la BD para búsqueda rápida
    const dbProductsMap = new Map();
    dbProducts.forEach(p => {
      dbProductsMap.set(p.id, p);
    });

    // Combinar productos: usar los de Tuya como base y enriquecerlos con info de la BD
    const products = realProducts.data.map(realProduct => {
      const dbProduct = dbProductsMap.get(realProduct.id);
      
      if (dbProduct) {
        // Si existe en BD, usar ese como base y actualizarlo con info de Tuya
        return {
          ...dbProduct.toObject(),
          online: realProduct.online,
          name: realProduct.name,
          ip: realProduct.ip,
          status: realProduct.status,
          update_time: realProduct.update_time,
          active_time: realProduct.active_time,
        };
      } else {
        // Si no existe en BD, usar el producto de Tuya directamente
        // Asignar cliente Caffenio por defecto y ciudad Hermosillo
        const defaultCliente = clientes.find(c => c.name === 'Caffenio') || clientes.find(c => c.name === 'All') || clientes[0];
        return {
          ...realProduct,
          cliente: defaultCliente?._id,
          product_type: realProduct.id === 'ebe24cce942e6266b1wixy' ? 'Nivel' : 'Osmosis',
          city: realProduct.city || 'Hermosillo',
          state: realProduct.state || 'Sonora',
        };
      }
    });

    console.log(`✅ Total products to show: ${products.length}`);

    // Aplicar transformaciones y filtros
    const filteredProducts = await Promise.all(products.map(async (product) => {
      // Determinar si está online
      product.online = product.online || false;
      
      // Tipo de producto especial
      if (product.id === 'ebe24cce942e6266b1wixy') {
        product.product_type = 'Nivel';
      }

      // Buscar y asignar cliente
      const cliente = clientes.find(cliente => 
        cliente._id.toString() === (product.cliente?._id?.toString() || product.cliente?.toString())
      );
      product.cliente = cliente || clientes.find(c => c.name === 'All') || clientes[0];
      
      // ====== OBTENER VALORES DE PRODUCT LOGS SI SON 0 (SOLO OSMOSIS) ======
      const isOsmosis = product.product_type === 'Osmosis' || product.product_type === 'osmosis';
      
      if (isOsmosis && product.status && Array.isArray(product.status)) {
        const flowSpeed1 = product.status.find(s => s.code === 'flowrate_speed_1');
        const flowSpeed2 = product.status.find(s => s.code === 'flowrate_speed_2');
        
        const needsFlowSpeed1 = !flowSpeed1 || flowSpeed1.value === 0;
        const needsFlowSpeed2 = !flowSpeed2 || flowSpeed2.value === 0;
        
        if (needsFlowSpeed1 || needsFlowSpeed2) {
          console.log(`🔍 [getAllProducts] Producto ${product.id}: flowrate en 0, consultando ProductLog...`);
          
          try {
            // Obtener el registro más reciente de ProductLog
            const latestLog = await ProductLog.findOne({ product_id: product.id })
              .sort({ date: -1 })
              .limit(1);
            
            if (latestLog) {
              console.log(`✅ [getAllProducts] Log encontrado para ${product.id}`);
              
              if (needsFlowSpeed1 && latestLog.flujo_produccion) {
                if (flowSpeed1) {
                  flowSpeed1.value = latestLog.flujo_produccion;
                } else {
                  product.status.push({ code: 'flowrate_speed_1', value: latestLog.flujo_produccion });
                }
                console.log(`  📊 flowrate_speed_1 actualizado: ${latestLog.flujo_produccion}`);
              }
              
              if (needsFlowSpeed2 && latestLog.flujo_rechazo) {
                if (flowSpeed2) {
                  flowSpeed2.value = latestLog.flujo_rechazo;
                } else {
                  product.status.push({ code: 'flowrate_speed_2', value: latestLog.flujo_rechazo });
                }
                console.log(`  📊 flowrate_speed_2 actualizado: ${latestLog.flujo_rechazo}`);
              }
            } else {
              console.log(`⚠️ [getAllProducts] No se encontraron logs para ${product.id}`);
            }
          } catch (logError) {
            console.error(`❌ [getAllProducts] Error obteniendo logs para ${product.id}:`, logError.message);
          }
        }
      }
      
      // Aplicar transformaciones a los status
      const PRODUCTOS_ESPECIALES = [
        'ebf9738480d78e0132gnru',
        'ebea4ffa2ab1483940nrqn'
      ];
      if (product.status && Array.isArray(product.status)) {
        product.status = product.status.map((stat) => {
          const flujos_codes = ["flowrate_speed_1", "flowrate_speed_2", "flowrate_total_1", "flowrate_total_2"];
          const flujos_total_codes = ["flowrate_total_1", "flowrate_total_2"];
          
          if (PRODUCTOS_ESPECIALES.includes(product.id) && flujos_codes.includes(stat.code)) {
            stat.value = (stat.value * 1.6).toFixed(2);
            if (flujos_total_codes.includes(stat.code)) {
              stat.value = (stat.value / 10).toFixed(2);
            }
          }
          
          const arrayCodes = ["flowrate_speed_1", "flowrate_speed_2"];
          if (arrayCodes.includes(stat.code) && stat.value > 0) {
            stat.value = (stat.value / 10).toFixed(2);
          }
          
          return stat;
        });
      }

      return product;
    }));

    // Aplicar filtros adicionales después de combinar
    let finalProducts = filteredProducts;

    // Filtrar por cliente si es necesario
    if (filtros.cliente) {
      finalProducts = finalProducts.filter(p => 
        p.cliente?._id?.toString() === filtros.cliente.toString()
      );
    }

    // Filtrar por ciudad
    if (filtros.city) {
      finalProducts = finalProducts.filter(p => p.city === filtros.city);
    }

    // Filtrar por estado
    if (filtros.state) {
      finalProducts = finalProducts.filter(p => p.state === filtros.state);
    }

    // Filtrar por drive
    if (filtros.drive) {
      finalProducts = finalProducts.filter(p => p.drive === filtros.drive);
    }

    // Filtrar por status online/offline
    if (filtros.online !== undefined) {
      finalProducts = finalProducts.filter(p => p.online === filtros.online);
    }

    // Filtrar por rango de fechas
    if (filtros.create_time) {
      finalProducts = finalProducts.filter(p => 
        p.create_time >= filtros.create_time.$gte && 
        p.create_time <= filtros.create_time.$lte
      );
    }

    console.log(`🎯 Final products after filters: ${finalProducts.length}`);

    // 🔽 EXTRA: incluir productos sólo locales que no están en Tuya
    const idsTuya = new Set(realProducts.data.map(p => p.id));
    const productosLocales = dbProducts.filter(p => !idsTuya.has(p.id));
    const productosLocalesAdaptados = productosLocales.map((dbProduct) => ({
      ...dbProduct.toObject(),
      online: false,
      // Mantén el resto de campos tal como en la BD
    }));

    // Combina ambos arreglos antes de filtrar de nuevo
    let todosLosProductos = [...filteredProducts, ...productosLocalesAdaptados];

    // 🔽 Vuelve a aplicar los filtros extra (post-combinados)
    if (filtros.cliente) {
      todosLosProductos = todosLosProductos.filter(p => 
        p.cliente?._id?.toString() === filtros.cliente.toString()
      );
    }
    if (filtros.city) {
      todosLosProductos = todosLosProductos.filter(p => p.city === filtros.city);
    }
    if (filtros.state) {
      todosLosProductos = todosLosProductos.filter(p => p.state === filtros.state);
    }
    if (filtros.drive) {
      todosLosProductos = todosLosProductos.filter(p => p.drive === filtros.drive);
    }
    if (filtros.online !== undefined) {
      todosLosProductos = todosLosProductos.filter(p => p.online === filtros.online);
    }
    if (filtros.create_time) {
      todosLosProductos = todosLosProductos.filter(p => 
        p.create_time >= filtros.create_time.$gte && 
        p.create_time <= filtros.create_time.$lte
      );
    }

    console.log(`🎯 Final products after filters (combinados): ${todosLosProductos.length}`);
    res.json(todosLosProductos);
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
        if (product) { return res.json(product); }
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
        const PRODUCTOS_ESPECIALES = [
          'ebf9738480d78e0132gnru',
          'ebea4ffa2ab1483940nrqn'
        ];
        console.log(`Product ${id} updated in MongoDB.`);
        
        // ====== OBTENER VALORES DE PRODUCT LOGS SI SON 0 (SOLO OSMOSIS) ======
        const isOsmosis = product.product_type === 'Osmosis' || product.product_type === 'osmosis';
        
        if (isOsmosis && product.status && Array.isArray(product.status)) {
          const flowSpeed1 = product.status.find(s => s.code === 'flowrate_speed_1');
          const flowSpeed2 = product.status.find(s => s.code === 'flowrate_speed_2');
          
          const needsFlowSpeed1 = !flowSpeed1 || flowSpeed1.value === 0;
          const needsFlowSpeed2 = !flowSpeed2 || flowSpeed2.value === 0;
          
          if (needsFlowSpeed1 || needsFlowSpeed2) {
            console.log(`🔍 [getProductById] Producto ${id}: flowrate en 0, consultando ProductLog...`);
            
            try {
              // Obtener el registro más reciente de ProductLog
              const latestLog = await ProductLog.findOne({ product_id: id })
                .sort({ date: -1 })
                .limit(1);
              
              if (latestLog) {
                console.log(`✅ [getProductById] Log encontrado para ${id}`);
                
                if (needsFlowSpeed1 && latestLog.flujo_produccion) {
                  if (flowSpeed1) {
                    flowSpeed1.value = latestLog.flujo_produccion;
                  } else {
                    product.status.push({ code: 'flowrate_speed_1', value: latestLog.flujo_produccion });
                  }
                  console.log(`  📊 flowrate_speed_1 actualizado: ${latestLog.flujo_produccion}`);
                }
                
                if (needsFlowSpeed2 && latestLog.flujo_rechazo) {
                  if (flowSpeed2) {
                    flowSpeed2.value = latestLog.flujo_rechazo;
                  } else {
                    product.status.push({ code: 'flowrate_speed_2', value: latestLog.flujo_rechazo });
                  }
                  console.log(`  📊 flowrate_speed_2 actualizado: ${latestLog.flujo_rechazo}`);
                }
              } else {
                console.log(`⚠️ [getProductById] No se encontraron logs para ${id}`);
              }
            } catch (logError) {
              console.error(`❌ [getProductById] Error obteniendo logs para ${id}:`, logError.message);
            }
          }
        }
        
        if (PRODUCTOS_ESPECIALES.includes(id)) {
          const flujos_codes = ["flowrate_speed_1", "flowrate_speed_2", "flowrate_total_1", "flowrate_total_2"];
          const flujos_total_codes = [ "flowrate_total_1", "flowrate_total_2"]
          product.status.map((stat) => {
            if (flujos_codes.includes(stat.code)) {
              stat.value = (stat.value * 1.6).toFixed(2);
            }
            if (flujos_total_codes.includes(stat.code)) {
              stat.value = (stat.value / 10).toFixed(2);
            }
            return stat;
          });
        }
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

    if (!response || !response.data) {
      return res.status(404).json({ message: 'Device not found in Tuya API' });
    }

    // Obtener cliente por defecto (Caffenio preferentemente)
    const clientes = await Client.find();
    const defaultCliente = clientes.find(c => c.name === 'Caffenio') || clientes.find(c => c.name === 'All') || clientes[0];

    // Save the new product to MongoDB
    const productData = {
      ...response.data,
      cliente: defaultCliente._id,
      product_type: response.data.id === 'ebe24cce942e6266b1wixy' ? 'Nivel' : 'Osmosis',
      city: response.data.city || 'Hermosillo',
      state: response.data.state || 'Sonora',
    };
    
    const newProduct = new Product(productData);
    await newProduct.save();

    console.log(`Product ${id} saved to MongoDB.`);
    console.log('newProduct', newProduct);
    
    // ====== OBTENER VALORES DE PRODUCT LOGS SI SON 0 (SOLO OSMOSIS) ======
    const isOsmosis = newProduct.product_type === 'Osmosis' || newProduct.product_type === 'osmosis';
    
    if (isOsmosis && newProduct.status && Array.isArray(newProduct.status)) {
      const flowSpeed1 = newProduct.status.find(s => s.code === 'flowrate_speed_1');
      const flowSpeed2 = newProduct.status.find(s => s.code === 'flowrate_speed_2');
      
      const needsFlowSpeed1 = !flowSpeed1 || flowSpeed1.value === 0;
      const needsFlowSpeed2 = !flowSpeed2 || flowSpeed2.value === 0;
      
      if (needsFlowSpeed1 || needsFlowSpeed2) {
        console.log(`🔍 [getProductById - new] Producto ${id}: flowrate en 0, consultando ProductLog...`);
        
        try {
          // Obtener el registro más reciente de ProductLog
          const latestLog = await ProductLog.findOne({ product_id: id })
            .sort({ date: -1 })
            .limit(1);
          
          if (latestLog) {
            console.log(`✅ [getProductById - new] Log encontrado para ${id}`);
            
            if (needsFlowSpeed1 && latestLog.flujo_produccion) {
              if (flowSpeed1) {
                flowSpeed1.value = latestLog.flujo_produccion;
              } else {
                newProduct.status.push({ code: 'flowrate_speed_1', value: latestLog.flujo_produccion });
              }
              console.log(`  📊 flowrate_speed_1 actualizado: ${latestLog.flujo_produccion}`);
            }
            
            if (needsFlowSpeed2 && latestLog.flujo_rechazo) {
              if (flowSpeed2) {
                flowSpeed2.value = latestLog.flujo_rechazo;
              } else {
                newProduct.status.push({ code: 'flowrate_speed_2', value: latestLog.flujo_rechazo });
              }
              console.log(`  📊 flowrate_speed_2 actualizado: ${latestLog.flujo_rechazo}`);
            }
          } else {
            console.log(`⚠️ [getProductById - new] No se encontraron logs para ${id}`);
          }
        } catch (logError) {
          console.error(`❌ [getProductById - new] Error obteniendo logs para ${id}:`, logError.message);
        }
      }
    }
    
    const PRODUCTOS_ESPECIALES = [
      'ebf9738480d78e0132gnru',
      'ebea4ffa2ab1483940nrqn'
    ];
    if (PRODUCTOS_ESPECIALES.includes(newProduct.id)) {
      const flujos_codes = ["flowrate_speed_1", "flowrate_speed_2", "flowrate_total_1", "flowrate_total_2"];
      const flujos_total_codes = [ "flowrate_total_1", "flowrate_total_2"]
      newProduct.status.map((stat) => {
        if (flujos_codes.includes(stat.code)) {
          stat.value = (stat.value * 1.6).toFixed(2);
        }
        if (flujos_total_codes.includes(stat.code)) {
          stat.value = (stat.value / 10).toFixed(2);
        }
        return stat;
      });
    }
    res.json(newProduct);
    
  } catch (error) {
    console.error('Error fetching product details:', error);
    res.status(500).json({ message: 'Error fetching product details' });
  }
};

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
      fields: 'flowrate_speed_1,flowrate_speed_2,flowrate_total_1,flowrate_total_2,tds_out', // hardcodeados
      size: limit,
      last_row_key,
    };

    let logs = [];
    let source = 'database';

    // ====== Intentar obtener desde Tuya ======
    try {
      const response = await tuyaService.getDeviceLogs(filters);
      if (response.success && response.data && response.data.logs?.length > 0) {
        logs = mapTuyaLogs(response.data.logs); // <--- aquí mapeamos
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

function mapTuyaLogs(tuyaData) {
  const grouped = {};

  tuyaData.forEach(item => {
    const ts = item.event_time;
    if (!grouped[ts]) grouped[ts] = { date: ts, source: 'tuya' };

    switch (item.code) {
      case 'flowrate_speed_1':
        grouped[ts].flujo_produccion = Number(item.value);
        break;
      case 'flowrate_speed_2':
        grouped[ts].flujo_rechazo = Number(item.value);
        break;
      case 'flowrate_total_1':
        grouped[ts].production_volume = Number(item.value);
        break;
      case 'flowrate_total_2':
        grouped[ts].rejected_volume = Number(item.value);
        break;
      case 'tds_out':
        grouped[ts].tds = Number(item.value);
        break;
    }
  });

  return Object.values(grouped).sort((a, b) => b.date - a.date);
}




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


/* ======================================================
   🔧 Funciones auxiliares para cada tipo de producto
   ====================================================== */

// 🧩 — OSMOSIS
async function handleOsmosisProduct(product, data) {
  console.log('🧩 [Osmosis] Procesando actualización...');
  const {
    pressure_valve1_psi,
    pressure_valve2_psi,
    pressure_difference_psi,
    relay_state,
    temperature,
    timestamp
  } = data;

  // Asegurar existencia de status necesarios
  const ensureStatus = (code, defaultValue = 0) => {
    let s = product.status.find(st => st.code === code);
    if (!s) {
      s = { code, value: defaultValue };
      product.status.push(s);
      console.log(`➕ [Osmosis] Se agregó status faltante: ${code}`);
    }
    return s;
  };

  const flujoProd = ensureStatus('flujo_produccion', 0);
  const flujoRech = ensureStatus('flujo_rechazo', 0);
  const presionDif = ensureStatus('pressure_difference', 0);
  const relayState = ensureStatus('relay_state', false);
  const tempStatus = ensureStatus('temperature', 0);

  presionDif.value = pressure_difference_psi ?? 0;
  relayState.value = relay_state ?? false;
  tempStatus.value = temperature ?? 0;

  const currentRelay = relay_state;
  const startTime = product.status.find(s => s.code === 'start_time');

  if (currentRelay === true && !startTime) {
    product.status.push({ code: 'start_time', value: timestamp });
    console.log('▶️ [Osmosis] Ciclo iniciado');
  } else if (currentRelay === false && startTime) {
    const elapsed = Math.max(0, timestamp - startTime.value);
    console.log(`⏱️ [Osmosis] Ciclo completado en ${elapsed} ms`);

    const litrosProd = (pressure_valve1_psi / 100) * (elapsed / 1000);
    const litrosRech = (pressure_valve2_psi / 100) * (elapsed / 1000);

    flujoProd.value += litrosProd;
    flujoRech.value += litrosRech;

    console.log(
      `💧 [Osmosis] Flujo producción +${litrosProd.toFixed(2)} L | Flujo rechazo +${litrosRech.toFixed(2)} L`
    );

    // Eliminar start_time tras finalizar ciclo
    product.status = product.status.filter(s => s.code !== 'start_time');
  }

  await product.save();
  console.log('💾 [Osmosis] Datos de osmosis actualizados correctamente');
  return { success: true, message: 'Datos de osmosis actualizados', product };
}

// ⚙️ — PRESIÓN
// 🔧 Lógica específica para productos de tipo "pressure"
async function handlePressureProduct(product, data) {
  console.log('🔧 [handlePressure] Iniciando procesamiento del producto de tipo Pressure...');
  
  // Acceso seguro y normalización de nombres
  const inPsi  = data.pressure_valve1_psi ?? data.presion_in;
  const outPsi = data.pressure_valve2_psi ?? data.presion_out;
  const pressure_difference_psi = data.pressure_difference_psi;
  const relay_state             = data.relay_state;
  const temperature             = data.temperature;

  console.log('📦 [handlePressure] Datos recibidos:', {
    inPsi, outPsi, pressure_difference_psi, relay_state, temperature
  });

  // Solo los códigos estándar para Pressure
  const allowedCodes = ['presion_in', 'presion_out', 'pressure_difference_psi', 'relay_state', 'temperature'];
  if (!Array.isArray(product.status)) {
    console.log('🧩 [handlePressure] No existe array de status, creando uno nuevo.');
    product.status = [];
  }
  product.status = product.status.filter(s => allowedCodes.includes(s.code));

  console.log('📋 [handlePressure] Status actual antes de actualizar:', JSON.stringify(product.status, null, 2));

  // Sólo almacena los códigos normalizados
  const updates = [
    { code: 'presion_in', value: inPsi },
    { code: 'presion_out', value: outPsi },
    { code: 'pressure_difference_psi', value: pressure_difference_psi },
    { code: 'relay_state', value: relay_state },
    { code: 'temperature', value: temperature },
  ];

  for (const { code, value } of updates) {
    if (value === undefined || value === null) {
      console.log(`⚠️ [handlePressure] Valor omitido para '${code}' (undefined o null)`);
      continue;
    }

    const existing = product.status.find((s) => s.code === code);
    if (existing) {
      console.log(`🔁 [handlePressure] Actualizando '${code}' de ${existing.value} → ${value}`);
      existing.value = value;
    } else {
      console.log(`➕ [handlePressure] Agregando nuevo status '${code}' = ${value}`);
      product.status.push({ code, value });
    }
  }

  // Marca el campo como modificado
  product.markModified('status');

  console.log('🧩 [handlePressure] Status final antes de guardar:', JSON.stringify(product.status, null, 2));

  try {
    await product.save();
    console.log('✅ [handlePressure] Producto actualizado correctamente en MongoDB');
  } catch (err) {
    console.error('❌ [handlePressure] Error al guardar producto:', err);
    throw err;
  }

  // Verificación post-save
  const refreshed = await product.constructor.findById(product._id).lean();
  console.log('🧩 [handlePressure] Status final guardado en DB:', JSON.stringify(refreshed.status, null, 2));

  return { success: true, message: 'Datos de presión actualizados', product: refreshed };
}


// 🌊 — NIVEL
async function handleLevelProduct(product, data) {
  console.log('🌊 [Nivel] Procesando actualización...');
  const { liquid_depth, liquid_state, liquid_level_percent, max_set, mini_set } = data;

  if (!product.status) product.status = [];

  const updates = [
    { code: 'liquid_state', value: liquid_state },
    { code: 'liquid_depth', value: liquid_depth },
    { code: 'liquid_level_percent', value: liquid_level_percent },
    { code: 'max_set', value: max_set },
    { code: 'mini_set', value: mini_set },
  ];

  for (const { code, value } of updates) {
    if (value === undefined || value === null) continue;

    const existing = product.status.find(s => s.code === code);
    if (existing) {
      existing.value = value;
      console.log(`🔁 [Nivel] Actualizado '${code}' = ${value}`);
    } else {
      product.status.push({ code, value });
      console.log(`➕ [Nivel] Agregado nuevo status '${code}' = ${value}`);
    }
  }

  await product.save();
  console.log('💾 [Nivel] Datos de nivel actualizados correctamente');
  return { success: true, message: 'Datos de nivel actualizados', product };
}

/* ======================================================
   🎯 Función principal
   ====================================================== */

export const componentInput = async (req, res) => {
  try {
    console.log('📥 [componentInput] Body recibido:', req.body);

    const {
      productId,
      pressure_valve1_psi,
      pressure_valve2_psi,
      pressure_difference_psi,
      relay_state,
      temperature,
      liquid_depth,
      liquid_state,
      liquid_level_percent,
      max_set,
      mini_set,
      timestamp
    } = req.body;

    if (!productId) {
      console.log('⚠️ [componentInput] Faltan datos requeridos');
      return res.status(400).json({ message: 'Datos incompletos' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      console.log('❌ [componentInput] Producto no encontrado');
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    console.log(`✅ [componentInput] Producto encontrado: ${product.name} (${product.product_type || product.type})`);

    const data = {
      // Para Pressure: admite presion_in / presion_out o pressure_valve1_psi / pressure_valve2_psi
      pressure_valve1_psi: pressure_valve1_psi ?? presion_in,
      pressure_valve2_psi: pressure_valve2_psi ?? presion_out,
      pressure_difference_psi,
      relay_state,
      temperature,
      liquid_depth,
      liquid_state,
      liquid_level_percent,
      max_set,
      mini_set,
      timestamp,
    };

    let result;

    switch (product.product_type || product.type) {
      case 'osmosis':
      case 'Osmosis':
        result = await handleOsmosisProduct(product, data);
        break;

      case 'Pressure':
      case 'Presión':
      case 'Presion':
        result = await handlePressureProduct(product, data);
        break;

      case 'nivel':
      case 'Nivel':
        result = await handleLevelProduct(product, data);
        break;

      default:
        console.log('ℹ️ [componentInput] Tipo de producto sin lógica especial, guardando sin cambios');
        await product.save();
        result = { success: true, message: 'Producto actualizado sin lógica especial', product };
        break;
    }

    return res.json(result);
  } catch (error) {
    console.error('🔥 [componentInput] Error inesperado:', error);
    return res.status(500).json({ message: 'Error en el servidor', error: error.message });
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


/* ======================================================
   🔄 RUTINA DE LOGS - Fetch logs from Tuya and save to DB
   ====================================================== */

/**
 * Routine para obtener logs de productos whitelist y guardarlos en la BD
 * Se puede ejecutar manualmente via endpoint o con un cron job
 */
export const fetchLogsRoutine = async (req, res) => {
  try {
    console.log('🔄 [fetchLogsRoutine] Iniciando rutina de obtención de logs...');

    // ====== WHITELIST DE PRODUCTOS ======
    // TODO: Mover esto a una variable de entorno o configuración
    const productosWhitelist = [
      { id: 'ebf9738480d78e0132gnru', type: 'Osmosis' },
      { id: 'ebea4ffa2ab1483940nrqn', type: 'Osmosis' },
      { id: 'ebe24cce942e6266b1wixy', type: 'Nivel' },
      // Agrega más productos según necesites
    ];

    // Si no hay productos en whitelist, responder con error
    if (!productosWhitelist || productosWhitelist.length === 0) {
      console.warn('⚠️ [fetchLogsRoutine] No hay productos en la whitelist');
      return res.status(400).json({
        success: false,
        message: 'No products in whitelist',
      });
    }

    console.log(`📋 [fetchLogsRoutine] Procesando ${productosWhitelist.length} productos...`);

    // ====== CONFIGURACIÓN DE TIEMPO ======
    const now = Date.now();
    // Por defecto últimos 5 minutos, pero puedes cambiar según necesites
    // Para pruebas: 24 * 60 * 60 * 1000 (24 horas)
    // Para producción con cron: 5 * 60 * 1000 (5 minutos)
    const timeRangeMs = 5 * 60 * 1000 ; // 5 minutos
    const startTime = now - timeRangeMs;
    
    // Crear objetos Date
    const nowDate = new Date(now);
    const startDate = new Date(startTime);
    
    // Formatear para zona horaria de Hermosillo
    const formatOptions = {
      timeZone: 'America/Hermosillo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    
    const nowLocal = nowDate.toLocaleString('es-MX', formatOptions);
    const startLocal = startDate.toLocaleString('es-MX', formatOptions);
    
    console.log(`⏰ [fetchLogsRoutine] Hora actual del servidor:`);
    console.log(`   - Hermosillo: ${nowLocal}`);
    console.log(`   - UTC: ${nowDate.toISOString()}`);
    console.log(`   - Timestamp: ${now}`);
    
    console.log(`⏰ [fetchLogsRoutine] Rango de búsqueda (últimos 5 minutos):`);
    console.log(`   - Desde (Hermosillo): ${startLocal}`);
    console.log(`   - Hasta (Hermosillo): ${nowLocal}`);
    console.log(`   - Timestamps: ${startTime} a ${now}`);

    // ====== CÓDIGOS DE LOGS POR TIPO DE PRODUCTO ======
    const logCodesByType = {
      'Osmosis': [
        'flowrate_speed_1',
        'flowrate_speed_2',
        'flowrate_total_1',
        'flowrate_total_2',
        'tds_out'
      ],
      'Nivel': [
        'liquid_depth',
        'liquid_level_percent'
      ]
    };

    const results = {
      success: [],
      errors: [],
      totalLogsInserted: 0,
    };

    // ====== PROCESAR CADA PRODUCTO ======
    for (const productConfig of productosWhitelist) {
      const productId = productConfig.id;
      const productType = productConfig.type;
      const logCodes = logCodesByType[productType] || logCodesByType['Osmosis'];
      try {
        console.log(`\n📦 [fetchLogsRoutine] Procesando producto: ${productId} (Tipo: ${productType})`);

        // Verificar que el producto existe en la BD
        const product = await Product.findOne({ id: productId });
        if (!product) {
          console.warn(`⚠️ [fetchLogsRoutine] Producto ${productId} no encontrado en BD`);
          results.errors.push({
            productId,
            error: 'Product not found in database',
          });
          continue;
        }

        // ====== OBTENER LOGS DE TUYA POR CADA CÓDIGO (SEPARADO) ======
        // Es importante hacer consultas separadas ya que cada una tiene límite de 100 registros
        const allTuyaLogs = [];
        let totalLogsFetched = 0;

        for (const code of logCodes) {
          try {
            console.log(`🔍 [fetchLogsRoutine] Obteniendo logs de código '${code}' para ${productId}...`);
            
            const filters = {
              id: productId,
              start_date: startTime,
              end_date: now,
              fields: code, // ⚠️ IMPORTANTE: Solo un código a la vez
              size: 100, // Últimos 100 logs por código
            };

            const response = await tuyaService.getDeviceLogsForRoutine(filters);

            if (response.success && response.data && response.data.logs && response.data.logs.length > 0) {
              const codeLogs = response.data.logs;
              allTuyaLogs.push(...codeLogs);
              totalLogsFetched += codeLogs.length;
              console.log(`  ✅ ${codeLogs.length} logs obtenidos para código '${code}'`);
            } else {
              console.log(`  ⚠️ No se encontraron logs para código '${code}'`);
            }

            // Pequeña pausa entre requests para no saturar la API
            await new Promise(resolve => setTimeout(resolve, 200));

          } catch (codeError) {
            console.error(`  ❌ Error obteniendo logs para código '${code}':`, codeError.message);
          }
        }

        if (allTuyaLogs.length === 0) {
          console.warn(`⚠️ [fetchLogsRoutine] No se encontraron logs en Tuya para ${productId}`);
          results.errors.push({
            productId,
            error: 'No logs found in Tuya',
          });
          continue;
        }

        console.log(`✅ [fetchLogsRoutine] Total ${totalLogsFetched} logs obtenidos de Tuya para ${productId} (${logCodes.length} códigos)`);

        // ====== AGRUPAR LOGS POR TIMESTAMP ======
        const groupedLogs = {};

        allTuyaLogs.forEach(log => {
          const timestamp = log.event_time;
          
          if (!groupedLogs[timestamp]) {
            groupedLogs[timestamp] = {
              product_id: productId,
              producto: product._id,
              date: new Date(timestamp),
              source: 'tuya',
              // Valores por defecto
              tds: 0,
              production_volume: 0,
              rejected_volume: 0,
              temperature: 0,
              flujo_produccion: 0,
              flujo_rechazo: 0,
              tiempo_inicio: Math.floor(timestamp / 1000),
              tiempo_fin: Math.floor(timestamp / 1000),
            };
          }

          // Mapear cada código según el tipo de producto
          if (productType === 'Osmosis') {
            switch (log.code) {
              case 'flowrate_speed_1':
                groupedLogs[timestamp].flujo_produccion = Number(log.value) || 0;
                break;
              case 'flowrate_speed_2':
                groupedLogs[timestamp].flujo_rechazo = Number(log.value) || 0;
                break;
              case 'flowrate_total_1':
                groupedLogs[timestamp].production_volume = Number(log.value) || 0;
                break;
              case 'flowrate_total_2':
                groupedLogs[timestamp].rejected_volume = Number(log.value) || 0;
                break;
              case 'tds_out':
                groupedLogs[timestamp].tds = Number(log.value) || 0;
                break;
            }
          } else if (productType === 'Nivel') {
            // Para productos tipo Nivel, mapear a campos disponibles
            switch (log.code) {
              case 'liquid_depth':
                // Mapear liquid_depth a flujo_produccion temporalmente
                groupedLogs[timestamp].flujo_produccion = Number(log.value) || 0;
                break;
              case 'liquid_level_percent':
                // Mapear liquid_level_percent a flujo_rechazo temporalmente
                groupedLogs[timestamp].flujo_rechazo = Number(log.value) || 0;
                break;
            }
          }
        });

        // ====== FILTRAR LOGS CON VALORES EN 0 ======
        const logsToSave = Object.values(groupedLogs).filter(log => {
          // Verificar que al menos un valor sea diferente de 0
          const hasValidData = 
            (log.tds !== 0) ||
            (log.production_volume !== 0) ||
            (log.rejected_volume !== 0) ||
            (log.flujo_produccion !== 0) ||
            (log.flujo_rechazo !== 0);
          
          return hasValidData;
        });

        console.log(`💾 [fetchLogsRoutine] ${logsToSave.length} logs con datos válidos para guardar (de ${Object.values(groupedLogs).length} totales)`);

        let insertedCount = 0;
        let skippedZeros = Object.values(groupedLogs).length - logsToSave.length;

        for (const logData of logsToSave) {
          try {
            // Verificar si ya existe un log similar (evitar duplicados)
            const existingLog = await ProductLog.findOne({
              product_id: productId,
              date: logData.date,
            });

            if (!existingLog) {
              const newLog = new ProductLog(logData);
              await newLog.save();
              insertedCount++;
            } else {
              console.log(`⏭️ [fetchLogsRoutine] Log duplicado, omitiendo... ${logData.date}`);
            }
          } catch (saveError) {
            console.error(`❌ [fetchLogsRoutine] Error guardando log individual:`, saveError.message);
          }
        }

        if (skippedZeros > 0) {
          console.log(`⏭️ [fetchLogsRoutine] ${skippedZeros} logs omitidos por tener todos los valores en 0`);
        }

        console.log(`✅ [fetchLogsRoutine] ${insertedCount} logs insertados para ${productId}`);
        
        results.success.push({
          productId,
          logsInserted: insertedCount,
          totalLogsFromTuya: totalLogsFetched,
          codesFetched: logCodes.length,
        });

        results.totalLogsInserted += insertedCount;

      } catch (productError) {
        console.error(`❌ [fetchLogsRoutine] Error procesando producto ${productId}:`, productError.message);
        results.errors.push({
          productId,
          error: productError.message,
        });
      }
    }

    // ====== RESPUESTA FINAL ======
    console.log('✅ [fetchLogsRoutine] Rutina completada');
    console.log(`📊 [fetchLogsRoutine] Resumen: ${results.success.length} exitosos, ${results.errors.length} errores`);
    console.log(`📊 [fetchLogsRoutine] Total logs insertados: ${results.totalLogsInserted}`);

    return res.json({
      success: true,
      message: 'Logs routine completed',
      summary: {
        productsProcessed: productosWhitelist.length,
        successfulProducts: results.success.length,
        failedProducts: results.errors.length,
        totalLogsInserted: results.totalLogsInserted,
      },
      details: {
        success: results.success,
        errors: results.errors,
      },
    });

  } catch (error) {
    console.error('❌ [fetchLogsRoutine] Error general en rutina:', error);
    return res.status(500).json({
      success: false,
      message: 'Error executing logs routine',
      error: error.message,
    });
  }
};
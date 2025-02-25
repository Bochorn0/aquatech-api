// src/controllers/product.controller.js
 import Product from '../models/product.model.js';
import * as tuyaService from '../services/tuya.service.js';  

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

  const cities = ["Tijuana", "Culiacan", "Cd. Juarez", "Hermosillo"];
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
  const mockedData = { result: realProducts.result };
  for (let i = 0; i < 1000; i++) {
      mockedData.result.push({
          ...baseData,
          id: `device_${i}`,
          name: `Device CB-5 - #${i}`,
          create_time: new Date(Date.now() - randomValue(0, 365) * 1000 * 60 * 60 * 24),
          model: `model_${randomValue(100, 999)}`,
          online: Math.random() < 0.5,
          ip: `${randomValue(10, 255)}.${randomValue(10, 255)}.${randomValue(10, 255)}.${randomValue(10, 255)}`,
          lat: (Math.random() * 180 - 90).toFixed(2),
          lon: (Math.random() * 360 - 180).toFixed(2),
          uid: `user_${randomValue(1000, 9999)}`,
          uuid: `${randomValue(100000, 999999)}`,
          city: cities[randomValue(0, cities.length - 1)],  // Random city
          drive: drives[randomValue(0, drives.length - 1)],  // Random drive
          status: [
            { code: "tds_out", value: randomValue(5, 20) },
            { code: "water_overflow", value: Math.random() < 0.5 },
            { code: "water_wash", value: Math.random() < 0.5 },
            { code: "filter_element_1", value: randomValue(0, 180) },
            { code: "filter_element_2", value: randomValue(0, 270) },
            { code: "filter_element_3", value: randomValue(0, 270) },
            { code: "filter_element_4", value: randomValue(0, 270) },
            { code: "flowrate_total_1", value: randomValue(10, 50) },
            { code: "flowrate_total_2", value: randomValue(10, 50) },
            { code: "flowrate_speed_1", value: randomValue(0, 15) },
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


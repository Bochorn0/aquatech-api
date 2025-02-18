// src/controllers/product.controller.js
// import Product from '../models/product.model.js';  
import * as tuyaService from '../services/tuya.service.js';  

export const getAllProducts = async (req, res) => {
  try {
    console.log('Fetching devices from Tuya API...');
    const devices = await tuyaService.getAllDevices();
    return res.json(devices.result);
    // res.json(products);
  } catch (error) {
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    res.status(500).json({ 
      message: 'Error fetching products',
      error: error.message,
      details: error.response?.data 
    });
  }
};

export const generateAllProducts = async (req, res) => {
    try {
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

        // Generate 100 random records
        const mockedData = { result: [] };
        for (let i = 0; i < 100; i++) {
            mockedData.result.push({
                ...baseData,
                // id: `device_${i}`,
                name: `Device CB-5 - #${i}`,
                model: `model_${randomValue(100, 999)}`,
                online: Math.random() < 0.5,
                ip: `${randomValue(10, 255)}.${randomValue(10, 255)}.${randomValue(10, 255)}.${randomValue(10, 255)}`,
                lat: (Math.random() * 180 - 90).toFixed(2),
                lon: (Math.random() * 360 - 180).toFixed(2),
                uid: `user_${randomValue(1000, 9999)}`,
                uuid: `${randomValue(100000, 999999)}`,
                status: [
                  { code: "tds_out", value: randomValue(5, 20) },
                  { code: "work_error", value: randomValue(0, 1) },
                  { code: "water_overflow", value: Math.random() < 0.5 },
                  { code: "water_wash", value: Math.random() < 0.5 },
                  { code: "flowrate_total_1", value: randomValue(10, 50) },
                  { code: "flowrate_total_2", value: randomValue(10, 50) },
                  { code: "temperature", value: randomValue(20, 40) }
              ],
            });
        }
        console.log('Generated product data:', mockedData);
        res.status(200).json(mockedData.result);
    } catch (error) {
        console.error("Error generating product data:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Fetching product details for:', id);
    const product = await tuyaService.getDeviceDetail(id)
    res.json(product);
  } catch (error) {
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    res.status(500).json({ 
      message: 'Error fetching product details',
      error: error.message,
      details: error.response?.data 
    });
  }
};

export const getProductMetrics = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findOne({ deviceId: id });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    console.log('Fetching status from Tuya API...');
    const status = await tuyaService.getDeviceStatus(id);

    product.metrics = {
      ...product.metrics,
      tds: status.find(s => s.code === 'tds')?.value || 0,
      waterFlow: status.find(s => s.code === 'water_flow')?.value || 0,
      filterLife: status.find(s => s.code === 'filter_life')?.value || 100,
      waterQuality: status.find(s => s.code === 'water_quality')?.value || 'good',
    };

    product.lastUpdated = Date.now();
    await product.save();

    res.json(product.metrics);
  } catch (error) {
    console.error('Error fetching product metrics:', error);
    res.status(500).json({ message: 'Error fetching product metrics' });
  }
};

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

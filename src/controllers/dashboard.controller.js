// src/controllers/product.controller.js
 import Metric from '../models/metric.model.js';

export const getDashboardMetrics = async (req, res) => {
  try {
    console.log('Fetching dashboard Metrics from MongoDB...');
    
    // Check if products exist in MongoDB
    let metrics = await Metric.find({});

    if (metrics.length === 0) {
      // Store products in MongoDB

      // Return stored products
      metrics = [
        {
          "total": 150,
          "label": "Productos Conectados",
          "totalOnline": 120,
          "percentage": 0.8
        },
        {
          "total": 100,
          "label": "Equipos en rango",
          "totalOnline": 85,
          "percentage": 0.85
        },
        {
          "total": 50,
          "label": "Equipos fuera de Rango",
          "totalOnline": 10,
          "percentage": 0.2
        },
        {
          "total": 200,
          "label": "Oportunidades",
          "totalOnline": 150,
          "percentage": 0.75
        }
      ];
    }

    res.json(metrics);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ message: 'Error fetching dashboard metrics' });
  }
};

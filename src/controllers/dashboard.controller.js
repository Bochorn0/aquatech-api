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
          "icon": "/assets/icons/glass/ic-glass-bag.svg",
          "totalOnline": 120,
          "percentage": 0.8,
          "chart": {
            "categories": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"],
            "series": [22, 8, 35, 50, 82, 84, 77, 12]
          }
        },
        {
          "total": 100,
          "label": "Equipos en rango",
          "totalOnline": 85,
          "percentage": 0.85,
          "color":"secondary",
          "icon":"/assets/icons/glass/ic-glass-users.svg",
          "chart":{
            "categories": ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
            "series": [56, 47, 40, 62, 73, 30, 23, 54],
          }
        },
        {
          "total": 50,
          "label": "Equipos fuera de Rango",
          "totalOnline": 10,
          "percentage": 0.2,
          "color":"warning",
          "icon":"/assets/icons/glass/ic-glass-buy.svg",
          "chart":{
            "categories": ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
            "series": [40, 70, 50, 28, 70, 75, 7, 64],
          }
        },
        {
          "total": 200,
          "label": "Oportunidades",
          "totalOnline": 150,
          "percentage": 0.75,
          "color":"error",
          "icon": "/assets/icons/glass/ic-glass-message.svg",
          "chart": {
            "categories": ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
            "series": [56, 30, 23, 54, 47, 40, 62, 73]
          }
        },
      ];
    }

    res.json(metrics);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ message: 'Error fetching dashboard metrics' });
  }
};

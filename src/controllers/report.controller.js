// src/controllers/product.controller.js
 import Report from '../models/report.model.js';

export const getReports = async (req, res) => {
  try {
    console.log('Fetching reports...');
    
    // Check if products exist in MongoDB
    let report = await Report.find({});

    if (report.length === 0) {
      // Store products in MongoDB

      // Return stored products
      report = [
        {
          "total": 150,
          "label": "report metrics",
          "totalOnline": 120,
          "percentage": 0.8
        }];
    }

    res.json(report);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ message: 'Error fetching reports' });
  }
};

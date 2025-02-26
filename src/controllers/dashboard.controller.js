// src/controllers/product.controller.js
import Metric from '../models/metric.model.js';
import { mockedProducts } from './product.controller.js';

export const getDashboardMetrics = async (req, res) => {
  try {
    console.log('Fetching dashboard Metrics from MongoDB...');
    
    // Check if products exist in MongoDB
    let metrics = await Metric.find({});
    let total = 0;
    let totalOnline = 0;
    let totalRangoOnline = 0;
    let totalFueraRangoOnline = 0;
    let totalOportunidadesOnline = 0;
    let enRango = [];
    let fueraRango = [];
    let oportunidades = [];
    let totalByCity = [];
    const mockProducts = await mockedProducts();
    if (metrics.length === 0) {
      // Generate Mocked Metrics
      total = mockProducts.length;
      totalOnline = mockProducts.filter((product) => product.online).length;
      // get city indicators
      mockProducts.forEach((product) => {
        const cityIndex = totalByCity.findIndex((city) => city.name === product.city);
        if (cityIndex === -1) {
          const prodByCity = mockProducts.filter((prod) => prod.city === product.city);
          totalByCity.push({ name: product.city, total: prodByCity.total, categories: getSortedDataByMonth(prodByCity) });
        }
      });
      // Get products in range
      enRango = mockProducts.filter((product) => {
        const flowrate = product.status.find(s => s.code === 'flowrate_total_2')?.value;
        return flowrate && flowrate >= 2;
      });
      totalRangoOnline = enRango.filter((product) => product.online).length;
      // Get products out of range
      fueraRango = mockProducts.filter((product) => {
        const flowrate = product.status.find(s => s.code === 'flowrate_total_2')?.value;
        return flowrate && flowrate < 2;
      });
      totalFueraRangoOnline = fueraRango.filter((product) => product.online).length;
      // Get opportunities
      oportunidades = mockProducts.filter((product) => product.drive === 'BochoApp');
      totalOportunidadesOnline = oportunidades.filter((product) => product.online).length;
      
      // Return stored products
      metrics = [
        {
          "total": total,
          "label": "Equipos Conectados",
          "icon": "/assets/icons/glass/ic-glass-bag.svg",
          "totalOnline": totalOnline,
          "percentage": (totalOnline / total),
          "color":"primary",
          "chart":getSortedDataByMonth(mockProducts)
        },
        {
          "total": enRango.length,
          "label": "Equipos en rango",
          "totalOnline": totalRangoOnline,
          "percentage": (totalRangoOnline / enRango.length),
          "color":"secondary",
          "icon":"/assets/icons/glass/ic-glass-users.svg",
          "chart":getSortedDataByMonth(enRango)
        },
        {
          "total": fueraRango.length,
          "label": "Equipos fuera de Rango",
          "totalOnline": totalFueraRangoOnline,
          "percentage": (totalFueraRangoOnline / fueraRango.length),
          "color":"error",
          "icon":"/assets/icons/glass/ic-glass-buy.svg",
          "chart":getSortedDataByMonth(fueraRango)
        },
        {
          "total": oportunidades.length,
          "label": "Oportunidades",
          "totalOnline": totalOportunidadesOnline,
          "percentage": (totalOportunidadesOnline / oportunidades.length),
          "color":"warning",
          "icon": "/assets/icons/glass/ic-glass-message.svg",
          "chart":getSortedDataByMonth(oportunidades)
        },
      ];
    }
    const series = totalByCity.map((city) => { 
      return {name: city.name, data: city.categories.series}
    });
    const response = {
      metrics,
      total,
      totalOnline,
      totalOffline: total - totalOnline,
      totalRango: enRango.length,
      totalRangoOnline,
      totalFueraRango: fueraRango.length,
      totalFueraRangoOnline,
      totalOportunidades: oportunidades.length,
      totalOportunidadesOnline,
      serieCovertura: {
        categories: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
        series
      }
    }
    res.json(response);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ message: 'Error fetching dashboard metrics' });
  }
};

function getSortedDataByMonth(data) {
  const categories = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const series = new Array(12).fill(0);

  data.forEach(item => {
      const timestamp = item.create_time * 1000; // Convert to milliseconds
      const date = new Date(timestamp);
      const monthIndex = date.getUTCMonth(); // Get month index (0-11)
      series[monthIndex] += 1; // Increment count for the month
  });

  return { categories, series };
} 
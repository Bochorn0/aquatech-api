// src/controllers/product.controller.js
import Metric from '../models/metric.model.js';
import { mockedProducts } from './product.controller.js';

const categories = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const visibleCities = ['Hermosillo', 'Tijuana', 'Monterrey', 'CDMX', 'Tijuana'];

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
        const flowrate = product.status.find(s => s.code === 'flowrate_total_1')?.value;
        return flowrate && flowrate >= 20;
      });
      totalRangoOnline = enRango.filter((product) => product.online).length;
      // Get products out of range
      fueraRango = mockProducts.filter((product) => {
        const flowrate = product.status.find(s => s.code === 'flowrate_total_1')?.value;
        return flowrate && flowrate < 20;
      });
      totalFueraRangoOnline = fueraRango.filter((product) => product.online).length;
      // Get opportunities
      oportunidades = mockProducts.filter((product) => product.drive === 'BochoApp');
      totalOportunidadesOnline = oportunidades.filter((product) => product.online).length;
      
      // Return stored products
      metrics = [
        createMetricsData({data:mockProducts, total2:totalOnline, label: 'Equipos Conectados', color: 'primary', icon: '/assets/icons/glass/ic-glass-bag.svg'}),
        createMetricsData({data:enRango, total2:totalRangoOnline, label: 'Equipos en rango', color: 'secondary', icon: '/assets/icons/glass/ic-glass-users.svg'}),
        createMetricsData({data:fueraRango, total2:totalFueraRangoOnline, label: 'Equipos fuera de rango', color: 'error', icon: '/assets/icons/glass/ic-glass-buy.svg'}),
        createMetricsData({data:oportunidades, total2:totalOportunidadesOnline, label: 'Oportunidades', color: 'warning', icon: '/assets/icons/glass/ic-glass-message.svg'}),
      ];
    }
    const series = totalByCity.map((city) => {
      let initiallyHidden = true;
      if (visibleCities.includes(city.name)) {
        initiallyHidden = false;
      } 
      return {name: city.name, data: city.categories.series, initiallyHidden}
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
        categories,
        series
      }
    }
    res.json(response);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ message: 'Error fetching dashboard metrics' });
  }
};

function createMetricsData({data, total2, label, color, icon}) {
  const metric = {
    "total": data.length,
    "label": label,
    "icon": icon,
    "totalOnline": total2,
    "percentage": (total2 / data.length),
    "color":color,
    "chart":getSortedDataByMonth(data)
  }
  return metric;
}

function getSortedDataByMonth(data) {

  const series = new Array(12).fill(0);

  data.forEach(item => {
      const timestamp = item.create_time * 1000; // Convert to milliseconds
      const date = new Date(timestamp);
      const monthIndex = date.getUTCMonth(); // Get month index (0-11)
      series[monthIndex] += 1; // Increment count for the month
  });

  return { categories, series };
} 
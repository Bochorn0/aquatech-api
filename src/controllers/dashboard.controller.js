// src/controllers/product.controller.js
import { mockedProducts } from './product.controller.js';
import User from '../models/user.model.js';
import Metric from '../models/metric.model.js';

const categories = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const clientCategories = ['En Rango (> 25 L)', 'Rango Medio (10 - 25 L)', 'Rango Bajo (5 -10 L)', 'Fuera Rango (< 5 L)'];
const visibleCities = ['Hermosillo', 'Tijuana', 'Monterrey', 'CDMX', 'Tijuana'];

export const getOldDashboardMetrics = async (req, res) => {
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
    let totalByCliente = [];
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
          totalByCity.push({ name: product.city, total: prodByCity.total, data: getSortedDataByMonth(prodByCity) });
        }
        const clienteIndex = totalByCliente.findIndex((customer) => customer.name === product.cliente);
        if (clienteIndex === -1) {
          const prodByCliente = mockProducts.filter((prod) => prod.cliente === product.cliente);
          totalByCliente.push({ name: product.cliente, total: prodByCliente.length, series: getSeriesByCliente(prodByCliente) });
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
        createMetricsData({data:fueraRango, total2:totalFueraRangoOnline, label: 'Equipos fuera rango', color: 'error', icon: '/assets/icons/glass/ic-glass-buy.svg'}),
        createMetricsData({data:oportunidades, total2:totalOportunidadesOnline, label: 'Oportunidades', color: 'warning', icon: '/assets/icons/glass/ic-glass-message.svg'}),
      ];
    }
    const seriesMetrics = totalByCity.map((city) => {
      let initiallyHidden = true;
      if (visibleCities.includes(city.name)) {
        initiallyHidden = false;
      } 
      return {name: city.name, data: city.data.series, initiallyHidden}
    });
    const seriesClientes = totalByCliente.map((cliente) => {
      return {name: cliente.name, data: cliente.series} 
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
        series: seriesMetrics
      },
      serieCliente: {
        categories: clientCategories,
        series: seriesClientes
      }
    }
    res.json(response);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ message: 'Error fetching dashboard metrics' });
  }
};

export const getDashboardMetrics = async (req, res) => {
  const user = req.user;
  const { id, role } = user;
  const { cliente } = await User.findById(id, {cliente: 1});
  const mockProducts = await mockedProducts();
  let productosByCliente = [];
  if (role === 'admin' || cliente === 'Aquatech') {
    productosByCliente = mockProducts;
  } else {
    productosByCliente = mockProducts.filter((product) => product.cliente === cliente);
  }
  //const productosByCliente = mockProducts;
  const metrics = await getMetricsByProds(productosByCliente, cliente);
  res.json({ productMetrics: metrics });
};

const getMetricsByProds = async (productosByCliente, cliente) => {
  const metricsData = await Metric.findOne({cliente});
  const tdsOnRangeProds = [];
  const tdsOffRangeProds = [];
  const proOnRangeProds = [];
  const proOffRangeProds = [];
  const rejectedOnRangeProds = [];
  const rejectedOffRangeProds = [];
  productosByCliente.filter((product) => {
    const tdsRange = product.status.find(s => s.code === 'tds_out')?.value;
    const productionVolume = product.status.find(s => s.code === 'flowrate_total_1')?.value;
    const rejectedVolume = product.status.find(s => s.code === 'flowrate_total_2')?.value;
    // TDS Range
    if (tdsRange && tdsRange >= metricsData.tds_range) tdsOnRangeProds.push(product);
    if (tdsRange && tdsRange < metricsData.tds_range) tdsOffRangeProds.push(product);
    // Production Volume
    if (productionVolume && productionVolume >= metricsData.production_volume_range / 10) proOnRangeProds.push(product);
    if (productionVolume && productionVolume < metricsData.production_volume_range / 10) proOffRangeProds.push(product);
    // Rejected Volume
    if (rejectedVolume && rejectedVolume >= metricsData.rejected_volume_range / 10) rejectedOnRangeProds.push(product);
    if (rejectedVolume && rejectedVolume < metricsData.rejected_volume_range / 10) rejectedOffRangeProds.push(product);
    
  });

  const metrics = [
    {
      title: 'Equipos Conectados', 
      series: [
        {
          label: 'Online',
          value: productosByCliente.filter((product) => product.online).length,
          products: productosByCliente.filter((product) => product.online)
        },
        {
          label: 'Offline',
          value: productosByCliente.filter((product) => !product.online).length,
          products: productosByCliente.filter((product) => !product.online)
        }
      ]
    },
    {
      title: 'TDS',
      series: [
        {
          label: `Rango < ${metricsData.tds_range} ppm`,
          value: tdsOffRangeProds.length,
          products: tdsOffRangeProds
        },
        {
          label: `Rango >= ${metricsData.tds_range} ppm`,
          value: tdsOnRangeProds.length,
          products: tdsOnRangeProds
        }
      ]
    },
    {
      title: 'PRODUCCIÓN', 
      series: [
        {
          label: `Rango < ${metricsData.production_volume_range} ml/min`,
          value: proOnRangeProds.length,
          products: proOnRangeProds
        },
        {
          label: `Rango >= ${metricsData.production_volume_range} ml/min`,
          value: proOffRangeProds.length,
          products: proOffRangeProds
        }
      ]
    },
    {
      title: 'RECHAZO', 
      series: [
        {
          label: `Rango < ${metricsData.rejected_volume_range} ml/min`,
          value: rejectedOnRangeProds.length,
          products: rejectedOnRangeProds
        },
        {
          label: `Rango >= ${metricsData.rejected_volume_range} ml/min`,
          value: rejectedOffRangeProds.length,
          products: rejectedOffRangeProds
        }
      ]
    }
  ]
  return metrics;
}

function getSeriesByCliente(data) {
      // Get products in range
      const enRango = data.filter((product) => {
        const flowrate = product.status.find(s => s.code === 'flowrate_total_1')?.value;
        return flowrate && flowrate >= 25;
      });
      const rangoMedio = data.filter((product) => {
        const flowrate = product.status.find(s => s.code === 'flowrate_total_1')?.value;
        return flowrate && flowrate < 25 && flowrate >= 10;
      });
      // Get products out of range
      const rangoBajo = data.filter((product) => {
        const flowrate = product.status.find(s => s.code === 'flowrate_total_1')?.value;
        return flowrate && flowrate < 10 && flowrate >= 5;
      });
      const rangoFalla = data.filter((product) => {
        const flowrate = product.status.find(s => s.code === 'flowrate_total_1')?.value;
        return flowrate && flowrate < 5;
      });
  return [
    enRango.length,
    rangoMedio.length,
    rangoBajo.length, 
    rangoFalla.length
  ]
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

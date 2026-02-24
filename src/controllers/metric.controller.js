import ClientMetricModel from '../models/postgres/clientMetric.model.js';
import UserModel from '../models/postgres/user.model.js';
import ClientModel from '../models/postgres/client.model.js';

const validateMetric = (metric, existingMetric, metricId) => {
  const errors = [];
  const clientId = metric.cliente ?? metric.client_id;
  if (existingMetric && String(existingMetric.client_id) === String(clientId)) {
    if (!metricId || String(metricId) !== String(existingMetric.id)) {
      errors.push('Ya existe una métrica para este cliente');
    }
  }
  if (!metric.tds_range || metric.tds_range < 0) errors.push('El rango TDS debe ser mayor a 0');
  if (!metric.production_volume_range || metric.production_volume_range < 0) errors.push('El rango de volumen de producción debe ser mayor a 0');
  if (!metric.temperature_range || metric.temperature_range < 0) errors.push('El rango de temperatura debe ser mayor a 0');
  if (!metric.rejected_volume_range || metric.rejected_volume_range < 0) errors.push('El rango de volumen rechazado debe ser mayor a 0');
  if (!metric.flow_rate_speed_range || metric.flow_rate_speed_range < 0) errors.push('El rango de velocidad de flujo debe ser mayor a 0');
  if (errors.length > 0) throw new Error(errors.join(' | '));
};

export const getMetrics = async (req, res) => {
  try {
    const clientes = await ClientModel.find();
    const user = req.user;
    const userData = await UserModel.findById(user.id);
    const filtros = {};
    if (userData?.client_id && userData.clienteName && userData.clienteName !== 'All') {
      const client = clientes.find(c => c.name === userData.clienteName);
      if (client) filtros.client_id = client.id;
    }
    const metrics = await ClientMetricModel.find(filtros);
    const clienteMap = new Map(clientes.map(c => [String(c.id), c.name]));
    const mappedResults = metrics.map(m => ({
      ...m,
      client_name: clienteMap.get(String(m.client_id)) || ''
    }));
    res.status(200).json(mappedResults);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ message: 'Error al obtener métricas', error: error.message });
  }
};

export const getMetricById = async (req, res) => {
  try {
    const { metricId } = req.params;
    const metric = await ClientMetricModel.findById(metricId);
    if (!metric) return res.status(404).json({ message: 'Métrica no encontrada' });
    res.status(200).json(metric);
  } catch (error) {
    console.error('Error fetching metric:', error);
    res.status(500).json({ message: 'Error al obtener métrica', error });
  }
};

export const addMetric = async (req, res) => {
  try {
    delete req.body._id;
    const existingMetric = await ClientMetricModel.findByClientId(req.body.cliente ?? req.body.client_id);
    validateMetric(req.body, existingMetric, null);
    const newMetric = await ClientMetricModel.create(req.body);
    res.status(201).json(newMetric);
  } catch (error) {
    console.error('Error adding metric:', error);
    res.status(400).json({ message: error.message || 'Error agregando métrica', error: error.message });
  }
};

export const updateMetric = async (req, res) => {
  try {
    const { metricId } = req.params;
    const existingMetric = await ClientMetricModel.findById(metricId);
    delete req.body._id;
    validateMetric(req.body, existingMetric, metricId);
    const updatedMetric = await ClientMetricModel.update(metricId, req.body);
    if (!updatedMetric) return res.status(404).json({ message: 'Métrica no encontrada' });
    res.status(200).json(updatedMetric);
  } catch (error) {
    console.error('Error updating metric:', error);
    res.status(500).json({ message: error?.message || 'Error actualizando métrica', error });
  }
};

export const removeMetric = async (req, res) => {
  try {
    const { metricId } = req.params;
    const deleted = await ClientMetricModel.delete(metricId);
    if (!deleted) return res.status(404).json({ message: 'Métrica no encontrada' });
    res.status(200).json({ message: 'Métrica eliminada' });
  } catch (error) {
    console.error('Error deleting metric:', error);
    res.status(500).json({ message: 'Error eliminando métrica', error });
  }
};

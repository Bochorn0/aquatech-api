import Metric from "../models/metric.model.js";
import User from "../models/user.model.js";
import Client from "../models/client.model.js";
import { validate as validateUUID } from 'uuid';

// Controller to get all metrics
export const getMetrics = async (req, res) => {
  try {
    // Fetch the list of clients
    const clientes = await Client.find();
    const user = req.user;
    const userId = user.id;
    const filtros = {};

    // Fetch user data and populate the 'cliente' field
    const userData = await User.findById(userId).populate('cliente');

    // Check if userData and cliente exist, and filter if necessary
    if (userData && userData.cliente && userData.cliente.name !== 'All') {
      filtros.cliente = userData.cliente._id;
    }

    // Fetch metrics based on filters
    const metrics = await Metric.find(filtros);

    // Create a lookup map for clients for faster access
    const clienteMap = new Map(clientes.map(cliente => [cliente._id.toString(), cliente.name]));

    // Map metrics with the corresponding client name using the lookup map
    const mappedResults = metrics.map(metric => {
      const clientName = clienteMap.get(metric.cliente.toString()) || ''; // Use map for faster lookup
      return {
        ...metric.toObject(), // Convert metric to plain object if it's a Mongoose document
        client_name: clientName,
      };
    });
    // Return the results
    res.status(200).json(mappedResults);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ message: 'Error al obtener métricas', error: error.message });
  }
};



// Controller to get a specific metric by its ID
export const getMetricById = async (req, res) => {
  try {
    const { metricId } = req.params;
    
    // Find the metric by ID
    const metric = await Metric.findOne({ _id: metricId });
    if (!metric) {
      return res.status(404).json({ message: 'Métrica no encontrada' });
    }

    res.status(200).json(metric);
  }
  catch (error) {
    console.error('Error fetching metric:', error);
    res.status(500).json({ message: 'Error al obtener métrica', error });
  }
}

// Controller to add a new metric
export const addMetric = async (req, res) => {
  try {
    // Check if metric already exists for the given client
    const existingMetric = await Metric.findOne({ cliente: req.body.cliente });
    // Validate the metric
    delete req.body._id;
    validateMetric(req.body, existingMetric, null);
    
    // If validation passes, create and save the new metric
    const newMetric = new Metric(req.body);
    await newMetric.save();
    
    res.status(201).json(newMetric); // Return the new metric
  } catch (error) {
    console.error('Error adding metric:', error);
    // Send the error back to the frontend with proper message and status code
    res.status(400).json({
      message: error.message || 'Error agregando métrica',  // Send the error message or fallback to a default one
      error: error.message, // Include the error message for debugging
    });
  }
};


// Controller to update a metric by its ID
export const updateMetric = async (req, res) => {
  try {
    const { metricId } = req.params;
    const existingMetric = await Metric.findOne({ _id: metricId });
    delete req.body._id;
    validateMetric(req.body, existingMetric, metricId);
    const updatedMetric = await Metric
    .findOneAndUpdate({ _id: metricId }, req.body, { new: true });
    if (!updatedMetric) {
      return res.status(404).json({ message: 'Métrica no encontrada' });
    }
    res.status(200).json(updatedMetric);
  }
  catch (error) {
    console.error('Error updating metric:', error);
    res.status(500).json({ message: error || 'Error actualizando métrica', error });
  }
}

// Controller to remove a metric by its ID
export const removeMetric = async (req, res) => {
  try {
    const { metricId } = req.params;
    const deletedMetric = await Metric.findOneAndDelete({ _id: metricId });
    if (!deletedMetric) {
      return res.status(404).json({ message: 'Métrica no encontrada' });
    }
    res.status(200).json(deletedMetric);
  }
  catch (error) {
    console.error('Error deleting metric:', error);
    res.status(500).json({ message: 'Error eliminando métrica', error });
  }
}

const validateMetric = (metric, existingMetric, metricId) => {
  const errors = [];
  // Check for client uniqueness
  if (existingMetric  && existingMetric.cliente.toString() === metric.cliente.toString()) {
    if (!metricId || metricId !== existingMetric._id.toString()) {
      errors.push('Ya existe una métrica para este cliente');
    }
  }
  // Validate required fields and ranges
  if (!metric.tds_range || metric.tds_range < 0) {
    errors.push('El rango TDS debe ser mayor a 0');
  }
  if (!metric.production_volume_range || metric.production_volume_range < 0) {
    errors.push('El rango de volumen de producción debe ser mayor a 0');
  }
  if (!metric.temperature_range || metric.temperature_range < 0) {
    errors.push('El rango de temperatura debe ser mayor a 0');
  }
  if (!metric.rejected_volume_range || metric.rejected_volume_range < 0) {
    errors.push('El rango de volumen rechazado debe ser mayor a 0');
  }
  if (!metric.flow_rate_speed_range || metric.flow_rate_speed_range < 0) {
    errors.push('El rango de velocidad de flujo debe ser mayor a 0');
  }


  // If there are errors, throw them all together
  if (errors.length > 0) {
    throw new Error(errors.join(' | '));
  }
}
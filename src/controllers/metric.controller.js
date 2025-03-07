import Metric from "../models/metric.model.js";
import City from "../models/city.model.js";

// Controller to get all metrics
export const getMetrics = async (req, res) => {
  try {
    const f = req.query;
    const filters = {};
    if (f.cliente && f.cliente !== 'All') {
      filters.cliente = f.cliente;
    }
    const metrics = await Metric.find(filters);
    res.status(200).json(metrics);
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ message: 'Error fetching metrics' });
  }
};

// Controller to get a specific metric by its ID
export const getMetricById = async (req, res) => {
  try {
    const { metricId } = req.params;
    
    // Find the metric by ID
    const metric = await Metric.findOne
    ({ _id: metricId });

    if (!metric) {
      return res.status(404).json({ message: 'Metric not found' });
    }

    res.status(200).json(metric);
  }
  catch (error) {
    console.error('Error fetching metric:', error);
    res.status(500).json({ message: 'Error fetching metric' });
  }
}

// Controller to add a new metric
export const addMetric = async (req, res) => {
  try {
    const newMetric = new Metric(req.body);
    await newMetric.save();
    res.status(201).json(newMetric);
  } catch (error) {
    console.error('Error adding metric:', error);
    res.status(500).json({ message: 'Error adding metric' });
  }
};

// Controller to update a metric by its ID
export const updateMetric = async (req, res) => {
  try {
    const { metricId } = req.params;
    const updatedMetric = await Metric
    .findOneAndUpdate({ _id: metricId }, req.body, { new: true });
    if (!updatedMetric) {
      return res.status(404).json({ message: 'Metric not found' });
    }
    res.status(200).json(updatedMetric);
  }
  catch (error) {
    console.error('Error updating metric:', error);
    res.status(500).json({ message: 'Error updating metric' });
  }
}

// Controller to remove a metric by its ID
export const removeMetric = async (req, res) => {
  try {
    const { metricId } = req.params;
    const deletedMetric = await Metric.findOneAndDelete({ _id: metricId });
    if (!deletedMetric) {
      return res.status(404).json({ message: 'Metric not found' });
    }
    res.status(200).json(deletedMetric);
  }
  catch (error) {
    console.error('Error deleting metric:', error);
    res.status(500).json({ message: 'Error deleting metric' });
  }
}

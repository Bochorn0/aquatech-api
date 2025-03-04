import Metric from "../models/metric.model.js";

// Controller to get all metrics
export const getMetrics = async (req, res) => {
  try {
    const metrics = await Metric.find();
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
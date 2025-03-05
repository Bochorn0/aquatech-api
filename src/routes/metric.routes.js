// src/routes/product.routes.js
import { Router } from 'express';
import { getMetrics, addMetric, removeMetric, getMetricById, updateMetric } from '../controllers/metric.controller.js'; // Named imports

const router = Router();

// Get all products
router.get('/', getMetrics);

router.post('/', addMetric);

router.get('/:metricId', getMetricById);

router.patch('/:metricId', updateMetric);

router.delete('/:metricId', removeMetric);
export default router;

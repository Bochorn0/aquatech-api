// src/routes/product.routes.js
import { Router } from 'express';
import { getMetrics, addMetric } from '../controllers/metric.controller.js'; // Named imports

const router = Router();

// Get all products
router.get('/', getMetrics);

router.post('/', addMetric);

export default router;

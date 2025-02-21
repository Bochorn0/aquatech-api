// src/routes/product.routes.js
import { Router } from 'express';
import { getDashboardMetrics } from '../controllers/dashboard.controller.js'; // Named imports

const router = Router();

// Get all products
router.get('/', getDashboardMetrics);

export default router;

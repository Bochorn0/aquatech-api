// src/routes/product.routes.js
import { Router } from 'express';
import { getDashboardMetrics } from '../controllers/dashboard.controller.js'; // Named imports
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// Get all products
router.get('/', authenticate, getDashboardMetrics);

export default router;

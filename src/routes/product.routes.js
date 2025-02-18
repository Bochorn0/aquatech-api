// src/routes/product.routes.js
import { Router } from 'express';
import { getAllProducts, generateAllProducts, getProductById, getProductMetrics } from '../controllers/product.controller.js'; // Named imports

const router = Router();

// Get all products
router.get('/', generateAllProducts);

// Get specific product by ID
router.get('/:id', getProductById);

// Get product metrics
router.get('/:id/metrics', getProductMetrics);

export default router;

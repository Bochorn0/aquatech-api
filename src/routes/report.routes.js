// src/routes/product.routes.js
import { Router } from 'express';
import { getReports } from '../controllers/report.controller.js'; // Named imports

const router = Router();

// Get all products
router.get('/', getReports);

export default router;

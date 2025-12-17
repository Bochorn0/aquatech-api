// src/routes/report.routes.js
import { Router } from 'express';
import { getReports, getProductLogsReport, reporteMensual } from '../controllers/report.controller.js'; // Named imports
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = Router();

// Get all reports
router.get('/', getReports);

// Get product logs report grouped by hour
// Query params: product_id, date (YYYY-MM-DD)
router.get('/product-logs', authenticate, authorizeRoles('admin', 'cliente'), getProductLogsReport);

// Reporte mensual - logs agrupados por día
router.get('/mensual', authenticate, reporteMensual);

export default router;

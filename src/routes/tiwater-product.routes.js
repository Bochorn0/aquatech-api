import { Router } from 'express';
import { 
  getProducts, 
  getProductById, 
  getProductByCode,
  createProduct, 
  updateProduct, 
  deleteProduct,
  getProductStats
} from '../controllers/tiwater-product.controller.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware.js';
import { validateTiWaterApiKey } from '../middlewares/tiwater-api-key.middleware.js';

const router = Router();

// Protected routes - Requires TI Water API Key for viewing products (catalog)
// Get all products (with optional filters)
router.get('/', validateTiWaterApiKey, getProducts);

// Get product statistics
router.get('/stats', validateTiWaterApiKey, getProductStats);

// Get product by code
router.get('/code/:code', validateTiWaterApiKey, getProductByCode);

// Get specific product by ID
router.get('/:productId', validateTiWaterApiKey, getProductById);

// Create new product (admin only)
router.post('/', authenticate, authorizeRoles('admin'), createProduct);

// Update specific product by ID (admin only)
router.patch('/:productId', authenticate, authorizeRoles('admin'), updateProduct);
router.put('/:productId', authenticate, authorizeRoles('admin'), updateProduct);

// Delete specific product by ID (admin only - soft delete)
router.delete('/:productId', authenticate, authorizeRoles('admin'), deleteProduct);

export default router;

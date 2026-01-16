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
import { validateTiWaterApiKey, validateTiWaterApiKeyOrAuth } from '../middlewares/tiwater-api-key.middleware.js';

const router = Router();

// Protected routes - Accepts either API Key (TI_water frontend) OR JWT Token (Aquatech_front dashboard)
// Get all products (with optional filters)
router.get('/', validateTiWaterApiKeyOrAuth, getProducts);

// Get product statistics
router.get('/stats', validateTiWaterApiKeyOrAuth, getProductStats);

// Get product by code
router.get('/code/:code', validateTiWaterApiKeyOrAuth, getProductByCode);

// Get specific product by ID
router.get('/:productId', validateTiWaterApiKeyOrAuth, getProductById);

// Create new product (admin only)
router.post('/', authenticate, authorizeRoles('admin'), createProduct);

// Update specific product by ID (admin only)
router.patch('/:productId', authenticate, authorizeRoles('admin'), updateProduct);
router.put('/:productId', authenticate, authorizeRoles('admin'), updateProduct);

// Delete specific product by ID (admin only - soft delete)
router.delete('/:productId', authenticate, authorizeRoles('admin'), deleteProduct);

export default router;

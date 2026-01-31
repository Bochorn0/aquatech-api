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
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js';
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

// Write: require /tiwater-catalog
router.post('/', authenticate, requirePermission('/tiwater-catalog'), createProduct);
router.patch('/:productId', authenticate, requirePermission('/tiwater-catalog'), updateProduct);
router.put('/:productId', authenticate, requirePermission('/tiwater-catalog'), updateProduct);
router.delete('/:productId', authenticate, requirePermission('/tiwater-catalog'), deleteProduct);

export default router;

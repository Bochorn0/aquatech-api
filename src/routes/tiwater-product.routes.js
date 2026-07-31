import { Router } from 'express';
import { 
  // getProducts, 
  // getProductById, 
  // getProductByCode,
  createProduct, 
  updateProduct, 
  deleteProduct,
  // getProductStats
} from '../controllers/tiwater-product.controller.js';
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js';
// import { validateTiWaterApiKey, validateTiWaterApiKeyOrAuth } from '../middlewares/tiwater-api-key.middleware.js';

const router = Router();

// Disabled: public/API-key catalog reads (X-TIWater-API-Key o JWT) — use TI_water_api instead
// router.get('/', validateTiWaterApiKeyOrAuth, getProducts);
// router.get('/stats', validateTiWaterApiKeyOrAuth, getProductStats);
// router.get('/code/:code', validateTiWaterApiKeyOrAuth, getProductByCode);
// router.get('/:productId', validateTiWaterApiKeyOrAuth, getProductById);

// Write: require /tiwater-catalog
router.post('/', authenticate, requirePermission('/tiwater-catalog'), createProduct);
router.patch('/:productId', authenticate, requirePermission('/tiwater-catalog'), updateProduct);
router.put('/:productId', authenticate, requirePermission('/tiwater-catalog'), updateProduct);
router.delete('/:productId', authenticate, requirePermission('/tiwater-catalog'), deleteProduct);

export default router;

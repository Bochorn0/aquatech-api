import { Router } from 'express';
import { 
  getControllers, 
  getControllerById,
  getActiveControllers, 
  updateController, 
  deleteController, 
  addController 
} from '../controllers/controller.controller.js';
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js';

const router = Router();

// Access by requirePermission('/controladores') at mount
router.get('/all', authenticate, requirePermission('/controladores'), getControllers);
router.get('/:id', authenticate, getControllerById);
router.get('/', authenticate, getActiveControllers);
router.post('/', authenticate, requirePermission('/controladores'), addController);
router.patch('/:id', authenticate, updateController);
router.delete('/:id', authenticate, requirePermission('/controladores'), deleteController);


export default router;

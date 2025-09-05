import { Router } from 'express';
import { 
  getControllers, 
  getControllerById,
  getActiveControllers, 
  updateController, 
  deleteController, 
  addController 
} from '../controllers/controller.controller.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = Router();

// Obtener todos los controladores (solo admin)
router.get('/all', authenticate, authorizeRoles('admin'), getControllers);

// Obtener un controlador por ID (admin y cliente)
router.get('/:id', authenticate, authorizeRoles('admin', 'cliente'), getControllerById);


// Obtener controladores activos con filtros (admin y cliente)
router.get('/', authenticate, authorizeRoles('admin', 'cliente'), getActiveControllers);

// Crear un nuevo controlador (solo admin)
router.post('/', authenticate, authorizeRoles('admin'), addController);

// Actualizar un controlador (admin y cliente)
router.patch('/:id', authenticate, authorizeRoles('admin', 'cliente'), updateController);

// Eliminar un controlador (solo admin)
router.delete('/:id', authenticate, authorizeRoles('admin'), deleteController);


export default router;

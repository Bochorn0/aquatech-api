import { Router } from 'express';
import {
  getPuntosVenta,
  getPuntosVentaFiltered,
  getPuntoVentaById,
  addPuntoVenta,
  updatePuntoVenta,
  deletePuntoVenta
} from '../controllers/puntoVenta.controller.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = Router();

// 🔹 Obtener todos los puntos de venta (solo admin)
router.get('/all', authenticate, authorizeRoles('admin', 'cliente'), getPuntosVenta);

// 🔹 Obtener puntos de venta filtrados (admin y cliente)
router.get('/', authenticate, authorizeRoles('admin', 'cliente'), getPuntosVentaFiltered);

// 🔹 Obtener un punto de venta por ID (admin y cliente)
router.get('/:id', authenticate, authorizeRoles('admin', 'cliente'), getPuntoVentaById);

// 🔹 Crear un nuevo punto de venta (solo admin)
router.post('/', authenticate, authorizeRoles('admin'), addPuntoVenta);

// 🔹 Actualizar un punto de venta (admin y cliente)
router.patch('/:id', authenticate, authorizeRoles('admin', 'cliente'), updatePuntoVenta);

// 🔹 Eliminar un punto de venta (solo admin)
router.delete('/:id', authenticate, authorizeRoles('admin'), deletePuntoVenta);

export default router;

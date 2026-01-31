import { Router } from 'express';
import { getClients, getClientsById, addClient, updateClient, saveAllClients, removeClient } from '../controllers/client.controller.js';
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js';

const router = Router();

// Read access by requirePermission('/') at mount
router.get('/', authenticate, getClients);
router.get('/:clientId', authenticate, getClientsById);

// Write: require /usuarios
router.post('/', authenticate, requirePermission('/usuarios'), addClient);
router.patch('/:clientId', authenticate, requirePermission('/usuarios'), updateClient);
router.post('/saveAllClients', authenticate, requirePermission('/usuarios'), saveAllClients);
router.delete('/:clientId', authenticate, requirePermission('/usuarios'), removeClient);

export default router;

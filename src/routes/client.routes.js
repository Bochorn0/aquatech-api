import { Router } from 'express';
import { getClients, getClientsById, addClient,  updateClient, saveAllClients, removeClient } from '../controllers/client.controller.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = Router();

// Get all products
router.get('/', authenticate, getClients);

// Add new client
router.post('/', authenticate, authorizeRoles('admin'), addClient);

// Get specific product by ID
router.get('/:clientId', authenticate, getClientsById);

// Update specific product by ID
router.patch('/:clientId', authenticate, authorizeRoles('admin'), updateClient);

// storage All Clients
router.post('/saveAllClients', authenticate, authorizeRoles('admin'), saveAllClients);

// Delete specific Client by ID
router.delete('/:clientId',authenticate, authorizeRoles('admin'), removeClient);

export default router;

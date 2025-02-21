// src/routes/product.routes.js
import { Router } from 'express';
import { getUsers } from '../controllers/user.controller.js'; // Named imports

const router = Router();

// Get all products
router.get('/', getUsers);

export default router;

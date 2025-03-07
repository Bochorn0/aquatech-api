import { Router } from 'express';
import { getCities, getCityById, addCity,  updateCity, saveAllCities, removeCity } from '../controllers/city.controller.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware.js';
const router = Router();

// Get all cities
router.get('/', getCities);

// Get specific city by ID
router.get('/:cityId', getCityById);

// Update specific city by ID
router.patch('/:cityId', authenticate, updateCity);

// Add new city
router.post('/', authenticate, authorizeRoles('admin'), addCity);

// save All Cities
router.post('/saveAllCities', authenticate, authorizeRoles('admin'), saveAllCities);

// Delete specific city by ID
router.delete('/:cityId',authenticate, authorizeRoles('admin'), removeCity);

export default router;

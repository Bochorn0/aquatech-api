import { Router } from 'express';
import { getCities, getCityById, addCity, updateCity, saveAllCities, removeCity } from '../controllers/city.controller.js';
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js';

const router = Router();

// Read (no auth at route; mount applies authenticate + requirePermission('/'))
router.get('/', getCities);
router.get('/:cityId', getCityById);

// Write: require / (dashboard)
router.patch('/:cityId', authenticate, updateCity);
router.post('/', authenticate, requirePermission('/'), addCity);
router.post('/saveAllCities', authenticate, requirePermission('/'), saveAllCities);
router.delete('/:cityId', authenticate, requirePermission('/'), removeCity);

export default router;

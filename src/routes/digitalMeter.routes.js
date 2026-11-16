import { Router } from 'express';

import { listDigitalMeters } from '../controllers/digitalMeter.controller.js';

const router = Router();

router.get('/', listDigitalMeters);

export default router;

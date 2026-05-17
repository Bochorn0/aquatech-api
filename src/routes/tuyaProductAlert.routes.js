import { Router } from 'express';
import { authenticate, requirePermission } from '../middlewares/auth.middleware.js';
import {
  listTuyaAlertConfigs,
  createTuyaAlertConfig,
  updateTuyaAlertConfig,
  deleteTuyaAlertConfig,
  listTuyaAlertContacts,
  createTuyaAlertContact,
  updateTuyaAlertContact,
  deleteTuyaAlertContact,
} from '../controllers/tuyaProductAlert.controller.js';

const router = Router();

const perm = requirePermission('/personalizacion/v1', '/personalizacion/v1/tuya-alerts');

router.get('/configs', authenticate, perm, listTuyaAlertConfigs);
router.post('/configs', authenticate, perm, createTuyaAlertConfig);
router.patch('/configs/:id', authenticate, perm, updateTuyaAlertConfig);
router.delete('/configs/:id', authenticate, perm, deleteTuyaAlertConfig);

router.get('/configs/:configId/contacts', authenticate, perm, listTuyaAlertContacts);
router.post('/configs/:configId/contacts', authenticate, perm, createTuyaAlertContact);
router.patch('/contacts/:contactId', authenticate, perm, updateTuyaAlertContact);
router.delete('/contacts/:contactId', authenticate, perm, deleteTuyaAlertContact);

export default router;

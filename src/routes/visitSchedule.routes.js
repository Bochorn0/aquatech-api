import express from 'express';
import {
  deleteScheduledVisit,
  deleteVisitRule,
  getScheduledVisits,
  getVisitRules,
  patchScheduledVisit,
  patchVisitRule,
  postDefaultVisitRules,
  postScheduledVisits,
  postVisitRule,
  sendVisitReminders,
} from '../controllers/visitSchedule.controller.js';

const router = express.Router();

router.get('/visit-rules', getVisitRules);
router.post('/visit-rules/defaults', postDefaultVisitRules);
router.post('/visit-rules', postVisitRule);
router.patch('/visit-rules/:id', patchVisitRule);
router.delete('/visit-rules/:id', deleteVisitRule);
router.get('/scheduled-visits', getScheduledVisits);
router.post('/scheduled-visits', postScheduledVisits);
router.patch('/scheduled-visits/:id', patchScheduledVisit);
router.delete('/scheduled-visits/:id', deleteScheduledVisit);
router.post('/scheduled-visits/reminders/run', sendVisitReminders);

export default router;

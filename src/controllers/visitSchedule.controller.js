import {
  VisitScheduleError,
  cancelVisits,
  createDefaultRules,
  createRule,
  listRules,
  listVisits,
  removeRule,
  scheduleVisits,
  sendDueReminders,
  updateRule,
  updateVisit,
} from '../services/visitSchedule.service.js';

function sendError(res, error, fallback) {
  const status = error instanceof VisitScheduleError ? error.statusCode : 500;
  console.error(fallback, error);
  res.status(status).json({
    success: false,
    message: error.message || fallback,
  });
}

export const getVisitRules = async (req, res) => {
  try {
    const data = await listRules(req.query.client_id);
    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error, 'No se pudieron leer las reglas de visitas');
  }
};

export const postVisitRule = async (req, res) => {
  try {
    const data = await createRule(req.body || {});
    res.status(201).json({ success: true, data });
  } catch (error) {
    sendError(res, error, 'No se pudo crear la regla');
  }
};

export const postDefaultVisitRules = async (req, res) => {
  try {
    const result = await createDefaultRules(req.body?.client_id);
    res.status(201).json({
      success: true,
      message: result.created
        ? `Se agregaron ${result.created} reglas`
        : 'Este cliente ya tiene esas reglas',
      data: result.data,
    });
  } catch (error) {
    sendError(res, error, 'No se pudieron crear las reglas');
  }
};

export const deleteVisitRule = async (req, res) => {
  try {
    const data = await removeRule(req.params.id);
    res.json({ success: true, message: 'Regla eliminada', data });
  } catch (error) {
    sendError(res, error, 'No se pudo eliminar la regla');
  }
};

export const patchVisitRule = async (req, res) => {
  try {
    const data = await updateRule(req.params.id, req.body || {});
    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error, 'No se pudo guardar la regla');
  }
};

export const getScheduledVisits = async (req, res) => {
  try {
    const data = await listVisits(req.query.client_id);
    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error, 'No se pudo leer la agenda');
  }
};

export const postScheduledVisits = async (req, res) => {
  try {
    const data = await scheduleVisits(req.body || {});
    res.status(201).json({
      success: true,
      message: data.length === 1
        ? 'Se creó la visita con Google Meet'
        : `Se crearon ${data.length} visitas con Google Meet`,
      data,
    });
  } catch (error) {
    sendError(res, error, 'No se pudo agendar la visita');
  }
};

export const patchScheduledVisit = async (req, res) => {
  try {
    const scope = req.query.scope === 'series' ? 'series' : 'one';
    const result = await updateVisit(req.params.id, req.body || {}, scope);
    const count = result.updated.length;
    res.json({
      success: true,
      message: result.failures.length
        ? `Se actualizaron ${count} visitas. ${result.failures.length} no se pudieron cambiar en Google Calendar.`
        : (count === 1 ? 'Visita y Meet actualizados' : `Se actualizaron ${count} visitas y sus Meets`),
      data: result.updated,
    });
  } catch (error) {
    sendError(res, error, 'No se pudo editar la visita');
  }
};

export const deleteScheduledVisit = async (req, res) => {
  try {
    const scope = req.query.scope === 'series' ? 'series' : 'one';
    const result = await cancelVisits(req.params.id, scope);
    const count = result.cancelled.length;
    res.json({
      success: true,
      message: count === 1 ? 'Visita cancelada' : `Se cancelaron ${count} visitas`,
      data: result,
    });
  } catch (error) {
    sendError(res, error, 'No se pudo cancelar la visita');
  }
};

export const sendVisitReminders = async (req, res) => {
  try {
    const data = await sendDueReminders();
    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error, 'No se pudieron enviar los recordatorios');
  }
};

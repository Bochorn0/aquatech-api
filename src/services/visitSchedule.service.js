import { randomUUID } from 'crypto';
import config from '../config/config.js';
import emailHelper from '../utils/email.helper.js';
import VisitScheduleModel from '../models/postgres/visitSchedule.model.js';
import { createMeetEvent, deleteMeetEvent } from './googleCalendar.service.js';
import {
  addDaysYmd,
  addMinutes,
  buildOccurrenceDates,
  isValidHm,
  isValidYmd,
  localDateTimeToUtc,
} from './visitSchedule.dates.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TYPE_LABEL = {
  visita_tecnica: 'Visita técnica',
  instalacion: 'Instalación',
  mantenimiento: 'Mantenimiento',
};

const EVENT_TYPES = ['visita_tecnica', 'instalacion', 'mantenimiento'];

const DEFAULT_RULES = [
  { event_type: 'visita_tecnica', interval_months: 3, horizon_months: 24 },
  { event_type: 'visita_tecnica', interval_months: 6, horizon_months: 24 },
  { event_type: 'visita_tecnica', interval_months: 12, horizon_months: 36 },
  { event_type: 'instalacion', interval_months: null, horizon_months: 1 },
  { event_type: 'mantenimiento', interval_months: null, horizon_months: 1 },
];

export class VisitScheduleError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

function googleMessage(error) {
  return error?.response?.data?.error?.message || error?.message || 'No se pudo usar Google Calendar';
}

export function normalizeGuests(list) {
  if (!Array.isArray(list)) {
    throw new VisitScheduleError('Los invitados deben ser una lista de correos');
  }
  const cleaned = [...new Set(
    list.map((email) => String(email || '').trim().toLowerCase()).filter(Boolean)
  )];
  const invalid = cleaned.find((email) => !EMAIL_RE.test(email) || email.length > 254);
  if (invalid) throw new VisitScheduleError(`Correo inválido: ${invalid}`);
  if (cleaned.length > 30) throw new VisitScheduleError('Máximo 30 invitados por visita');
  return cleaned;
}

function intInRange(value, min, max, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new VisitScheduleError(`${label} debe estar entre ${min} y ${max}`);
  }
  return n;
}

function timeZone() {
  return config.GOOGLE_CALENDAR_TIMEZONE || 'America/Tijuana';
}

function defaultLabel(eventType, intervalMonths) {
  if (eventType === 'visita_tecnica') return `Visita técnica cada ${intervalMonths} meses`;
  return TYPE_LABEL[eventType] || 'Visita';
}

function readSettings(body, eventType) {
  const start = String(body.start_time || '10:00').slice(0, 5);
  if (!isValidHm(start)) throw new VisitScheduleError('La hora de la visita no es válida');
  return {
    enabled: body.enabled !== false,
    duration_minutes: intInRange(body.duration_minutes ?? 60, 15, 480, 'La duración'),
    notification_days_before: intInRange(body.notification_days_before ?? 7, 0, 90, 'Los días de aviso'),
    reminder_hour: intInRange(body.reminder_hour ?? 9, 0, 23, 'La hora del correo'),
    start_time: start,
    horizon_months: eventType === 'visita_tecnica'
      ? intInRange(body.horizon_months ?? 24, 1, 60, 'El horizonte')
      : 1,
    guests: normalizeGuests(body.guests || []),
    notes: body.notes ? String(body.notes).slice(0, 2000) : null,
  };
}

function asDuplicate(error) {
  if (error?.code === '23505') {
    throw new VisitScheduleError('Este cliente ya tiene una regla de ese tipo y ese intervalo');
  }
  if (error?.code === '23514') {
    throw new VisitScheduleError('La regla no cumple las condiciones permitidas');
  }
  throw error;
}

async function requireClient(clientId) {
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0) throw new VisitScheduleError('Elige un cliente');
  const client = await VisitScheduleModel.findClient(id);
  if (!client) throw new VisitScheduleError('No se encontró el cliente', 404);
  return client;
}

export async function listRules(clientId) {
  if (clientId == null || clientId === '') return [];
  const client = await requireClient(clientId);
  const rules = await VisitScheduleModel.listRules(client.id);
  return rules.map((rule) => ({ ...rule, client_name: rule.client_name || client.name }));
}

export async function createRule(body) {
  const client = await requireClient(body.client_id);
  const eventType = body.event_type;
  if (!EVENT_TYPES.includes(eventType)) throw new VisitScheduleError('El tipo de visita no es válido');

  const intervalMonths = eventType === 'visita_tecnica'
    ? intInRange(body.interval_months, 1, 36, 'El intervalo')
    : null;
  const label = String(body.label || '').trim().slice(0, 120) || defaultLabel(eventType, intervalMonths);

  try {
    const created = await VisitScheduleModel.createRule({
      client_id: client.id,
      event_type: eventType,
      interval_months: intervalMonths,
      label,
      ...readSettings(body, eventType),
    });
    return { ...created, client_name: client.name };
  } catch (error) {
    asDuplicate(error);
  }
}

export async function createDefaultRules(clientId) {
  const client = await requireClient(clientId);
  let created = 0;
  for (const preset of DEFAULT_RULES) {
    try {
      await createRule({
        client_id: client.id,
        ...preset,
        notification_days_before: 7,
        reminder_hour: 9,
        duration_minutes: 60,
        start_time: '10:00',
        guests: [],
        enabled: true,
      });
      created += 1;
    } catch (error) {
      if (!(error instanceof VisitScheduleError) || !error.message.includes('ya tiene')) throw error;
    }
  }
  return { created, data: await listRules(client.id) };
}

export async function updateRule(id, body) {
  const existing = await VisitScheduleModel.findRule(id);
  if (!existing) throw new VisitScheduleError('No se encontró la regla', 404);

  const isTechnical = existing.event_type === 'visita_tecnica';
  const intervalMonths = isTechnical
    ? intInRange(body.interval_months ?? existing.interval_months, 1, 36, 'El intervalo')
    : null;
  const label = String(body.label || existing.label || '').trim().slice(0, 120)
    || defaultLabel(existing.event_type, intervalMonths);

  try {
    const updated = await VisitScheduleModel.updateRule(id, {
      ...readSettings(body, existing.event_type),
      label,
      interval_months: intervalMonths,
    });
    return { ...updated, client_name: existing.client_name };
  } catch (error) {
    asDuplicate(error);
  }
}

export async function removeRule(id) {
  const existing = await VisitScheduleModel.findRule(id);
  if (!existing) throw new VisitScheduleError('No se encontró la regla', 404);
  const open = await VisitScheduleModel.countOpenVisits(id);
  if (open > 0) {
    throw new VisitScheduleError('Esta regla tiene visitas programadas. Cancélalas o desactiva la regla.');
  }
  await VisitScheduleModel.deleteRule(id);
  return { id: existing.id };
}

export async function listVisits(clientId) {
  if (clientId != null && clientId !== '') await requireClient(clientId);
  return VisitScheduleModel.listUpcoming(clientId || null);
}

export async function scheduleVisits(body) {
  const rule = body.rule_id ? await VisitScheduleModel.findRule(body.rule_id) : null;
  if (rule && !rule.enabled) throw new VisitScheduleError('Esa regla está desactivada');

  const name = String(body.name || '').trim().slice(0, 200);
  if (!name) throw new VisitScheduleError('Escribe el nombre de la cita');

  const eventType = body.event_type || rule?.event_type;
  if (!EVENT_TYPES.includes(eventType)) throw new VisitScheduleError('El tipo de visita no es válido');

  let client = null;
  if (body.client_id) client = await requireClient(body.client_id);
  else if (rule?.client_id) client = await VisitScheduleModel.findClient(rule.client_id);

  let punto = null;
  if (body.punto_venta_id) {
    punto = await VisitScheduleModel.findPunto(body.punto_venta_id);
    if (!punto) throw new VisitScheduleError('No se encontró el punto de venta', 404);
    if (client && punto.client_id && Number(punto.client_id) !== Number(client.id)) {
      throw new VisitScheduleError('Ese punto de venta no pertenece al cliente elegido');
    }
  }

  const date = String(body.date || '');
  if (!isValidYmd(date)) throw new VisitScheduleError('La fecha de la visita no es válida');

  const startHm = String(body.start_time || rule?.start_time || '10:00').slice(0, 5);
  if (!isValidHm(startHm)) throw new VisitScheduleError('La hora de la visita no es válida');

  const zone = timeZone();
  const firstStart = localDateTimeToUtc(date, startHm, zone);
  if (firstStart.getTime() < Date.now() - 5 * 60 * 1000) {
    throw new VisitScheduleError('La fecha y hora de la visita ya pasaron');
  }

  const period = body.repeat === 'weeks' || body.repeat === 'months' || body.repeat === 'series'
    ? (body.repeat === 'weeks' ? 'weeks' : 'months')
    : 'once';
  const intervalWeeks = period === 'weeks'
    ? intInRange(body.interval_weeks, 1, 52, 'Las semanas')
    : null;
  const horizonWeeks = period === 'weeks'
    ? intInRange(body.horizon_weeks ?? 12, 1, 104, 'Las semanas a agendar')
    : null;
  const intervalMonths = period === 'months'
    ? intInRange(body.interval_months ?? rule?.interval_months, 1, 36, 'Los meses')
    : null;
  const horizonMonths = period === 'months'
    ? intInRange(body.horizon_months ?? rule?.horizon_months ?? 12, 1, 60, 'Los meses a agendar')
    : 1;
  const duration = body.duration_minutes == null
    ? (rule?.duration_minutes || 60)
    : intInRange(body.duration_minutes, 15, 480, 'La duración');

  const guests = normalizeGuests(body.guests ?? rule?.guests ?? []);
  const notificationDays = body.notification_days_before == null
    ? (rule?.notification_days_before ?? 7)
    : intInRange(body.notification_days_before, 0, 90, 'Los días de aviso');
  const reminderHour = body.reminder_hour == null
    ? (rule?.reminder_hour ?? 9)
    : intInRange(body.reminder_hour, 0, 23, 'La hora del correo');
  const notes = body.notes != null
    ? (String(body.notes).trim().slice(0, 2000) || null)
    : (rule?.notes || null);

  const dates = buildOccurrenceDates({
    date,
    intervalMonths,
    horizonMonths,
    intervalDays: intervalWeeks ? intervalWeeks * 7 : null,
    horizonDays: horizonWeeks ? horizonWeeks * 7 : null,
  });
  if (!dates.length) throw new VisitScheduleError('No hay fechas para agendar');

  const endClock = addMinutes(startHm, duration);
  const seriesId = randomUUID();
  const label = TYPE_LABEL[eventType];
  const place = punto
    ? (punto.codigo_tienda ? `${punto.name} (${punto.codigo_tienda})` : punto.name)
    : '';
  const createdEvents = [];

  try {
    for (const ymd of dates) {
      const endDate = addDaysYmd(ymd, endClock.dayOffset);
      const title = `${label} — ${name}`;
      const description = [
        label,
        `Nombre: ${name}`,
        client ? `Cliente: ${client.name}` : '',
        place ? `Sitio: ${place}` : '',
        notes || '',
        `Recordatorio por correo ${notificationDays} día(s) antes.`,
      ].filter(Boolean).join('\n');

      let event;
      try {
        event = await createMeetEvent({
          summary: title,
          description,
          start: `${ymd}T${startHm}:00`,
          end: `${endDate}T${endClock.hm}:00`,
          attendees: guests,
          timeZone: zone,
        });
      } catch (error) {
        throw new VisitScheduleError(`Google Calendar: ${googleMessage(error)}`, 502);
      }
      createdEvents.push({ ymd, title, event });
    }

    return await VisitScheduleModel.insertVisits(createdEvents.map((item) => ({
      series_id: seriesId,
      rule_id: rule?.id || null,
      client_id: client?.id || null,
      client_name: name,
      punto_venta_id: punto?.id || null,
      punto_venta_name: punto?.name || null,
      codigo_tienda: punto?.codigo_tienda || null,
      event_type: eventType,
      interval_months: intervalMonths,
      interval_weeks: intervalWeeks,
      title: item.title,
      notes,
      starts_at: localDateTimeToUtc(item.ymd, startHm, zone).toISOString(),
      ends_at: localDateTimeToUtc(
        addDaysYmd(item.ymd, endClock.dayOffset),
        endClock.hm,
        zone
      ).toISOString(),
      time_zone: zone,
      guests,
      notification_days_before: notificationDays,
      reminder_hour: reminderHour,
      google_event_id: item.event.id,
      meet_link: item.event.meetLink,
      calendar_link: item.event.htmlLink,
    })));
  } catch (error) {
    await Promise.all(createdEvents.map((item) => (
      deleteMeetEvent(item.event?.id).catch((deleteError) => {
        console.error('[VisitSchedule] No se pudo revertir el evento', item.event?.id, deleteError.message);
      })
    )));
    throw error;
  }
}

export async function cancelVisits(id, scope) {
  const visit = await VisitScheduleModel.findVisit(id);
  if (!visit || visit.status !== 'scheduled') {
    throw new VisitScheduleError('No se encontró la visita programada', 404);
  }

  const targets = scope === 'series'
    ? await VisitScheduleModel.listSeries(visit.series_id)
    : [visit];

  const cancelledIds = [];
  const failures = [];
  for (const target of targets) {
    try {
      if (target.google_event_id) await deleteMeetEvent(target.google_event_id);
      cancelledIds.push(target.id);
    } catch (error) {
      failures.push({ id: target.id, message: googleMessage(error) });
    }
  }

  const cancelled = await VisitScheduleModel.markCancelled(cancelledIds);
  if (failures.length && !cancelled.length) {
    throw new VisitScheduleError(`Google Calendar: ${failures[0].message}`, 502);
  }
  return { cancelled, failures };
}

function formatWhen(iso, zone) {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: zone,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function reminderHtml(visit) {
  const when = formatWhen(visit.starts_at, visit.time_zone);
  const place = visit.codigo_tienda
    ? `${visit.punto_venta_name || visit.client_name || 'Cita'} (${visit.codigo_tienda})`
    : (visit.punto_venta_name || visit.client_name || 'Cita');
  const meet = visit.meet_link
    ? `<p><strong>Google Meet:</strong> <a href="${visit.meet_link}">${visit.meet_link}</a></p>`
    : '';
  const calendar = visit.calendar_link
    ? `<p><a href="${visit.calendar_link}">Abrir en Google Calendar</a></p>`
    : '';
  const notes = visit.notes ? `<p>${escapeHtml(visit.notes)}</p>` : '';
  return `
    <div style="font-family:Arial,sans-serif;color:#222;line-height:1.5">
      <p>Recordatorio de <strong>${escapeHtml(visit.title)}</strong>.</p>
      <p><strong>Cuándo:</strong> ${escapeHtml(when)}</p>
      <p><strong>Dónde:</strong> ${escapeHtml(place)}</p>
      ${meet}
      ${calendar}
      ${notes}
      <p>Este aviso se envía ${visit.notification_days_before} día(s) antes de la visita.</p>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendDueReminders() {
  const due = await VisitScheduleModel.claimDueReminders();
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const visit of due) {
    const recipients = visit.guests.length
      ? visit.guests
      : [config.GOOGLE_CALENDAR_IMPERSONATE].filter(Boolean);

    if (!recipients.length) {
      await VisitScheduleModel.markReminderSkipped(visit.id, 'Sin destinatarios');
      skipped += 1;
      continue;
    }

    const when = formatWhen(visit.starts_at, visit.time_zone);
    const result = await emailHelper.sendEmail({
      to: recipients,
      subject: `Recordatorio: ${visit.title} — ${when}`,
      html: reminderHtml(visit),
      text: `${visit.title}\n${when}\n${visit.punto_venta_name || visit.client_name || ''}\n${visit.meet_link || ''}`,
    });

    if (result?.success) {
      await VisitScheduleModel.markReminderSent(visit.id);
      sent += 1;
    } else {
      await VisitScheduleModel.markReminderFailed(visit.id, result?.error || 'No se pudo enviar el correo');
      failed += 1;
    }
  }

  return { checked: due.length, sent, failed, skipped };
}

let schedulerStarted = false;

export function startVisitReminderScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  const run = () => {
    sendDueReminders()
      .then((result) => {
        if (result.sent || result.failed || result.skipped) {
          console.log('[VisitReminders]', result);
        }
      })
      .catch((error) => {
        console.error('[VisitReminders]', error.message);
      });
  };
  setTimeout(run, 20_000);
  setInterval(run, 60 * 60 * 1000);
}

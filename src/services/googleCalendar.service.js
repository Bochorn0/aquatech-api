import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { google } from 'googleapis';
import config from '../config/config.js';

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

function loadServiceAccount() {
  const configured = String(config.GOOGLE_CALENDAR_CREDENTIALS || '').trim();
  if (!configured) {
    throw new Error('Falta GOOGLE_CALENDAR_CREDENTIALS');
  }
  if (configured.startsWith('{')) {
    return JSON.parse(configured);
  }
  const keyFile = path.isAbsolute(configured)
    ? configured
    : path.resolve(process.cwd(), configured);
  return JSON.parse(fs.readFileSync(keyFile, 'utf8'));
}

function calendarClient() {
  const key = loadServiceAccount();
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: [CALENDAR_SCOPE],
    subject: config.GOOGLE_CALENDAR_IMPERSONATE,
  });
  return google.calendar({ version: 'v3', auth });
}

/**
 * Crea un evento en el calendario de mantenimiento y le adjunta un Meet.
 * Sin invitados no se manda correo. Con invitados, Google envía la invitación.
 */
export async function createMeetEvent({
  summary,
  description,
  start,
  end,
  attendees = [],
  timeZone = config.GOOGLE_CALENDAR_TIMEZONE,
}) {
  const calendar = calendarClient();
  const guestEmails = attendees.map((email) => ({ email }));

  const response = await calendar.events.insert({
    calendarId: config.GOOGLE_CALENDAR_ID || 'primary',
    conferenceDataVersion: 1,
    sendUpdates: guestEmails.length ? 'all' : 'none',
    requestBody: {
      summary,
      description,
      start: { dateTime: start, timeZone },
      end: { dateTime: end, timeZone },
      attendees: guestEmails,
      conferenceData: {
        createRequest: {
          requestId: randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
  });

  const event = response.data;
  const video = event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video');

  return {
    id: event.id,
    summary: event.summary,
    htmlLink: event.htmlLink,
    meetLink: event.hangoutLink || video?.uri || null,
    start: event.start,
    end: event.end,
  };
}

/** Borra el evento. Un 404 significa que ya no está en el calendario. */
export async function deleteMeetEvent(eventId) {
  if (!eventId) return { deleted: false, missing: true };
  const calendar = calendarClient();
  try {
    await calendar.events.delete({
      calendarId: config.GOOGLE_CALENDAR_ID || 'primary',
      eventId,
      sendUpdates: 'all',
    });
    return { deleted: true, missing: false };
  } catch (error) {
    const status = error?.code || error?.response?.status;
    if (status === 404 || status === 410) return { deleted: false, missing: true };
    throw error;
  }
}

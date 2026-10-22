import { getClient, query } from '../../config/postgres.config.js';

function asNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asIso(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function asGuests(value) {
  if (Array.isArray(value)) return value.map((email) => String(email));
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((email) => String(email)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function asTime(value) {
  if (!value) return '10:00';
  return String(value).slice(0, 5);
}

const RULE_ORDER = `
  ORDER BY CASE event_type
    WHEN 'visita_tecnica' THEN 1
    WHEN 'instalacion' THEN 2
    WHEN 'mantenimiento' THEN 3
    ELSE 4
  END, interval_months NULLS LAST
`;

class VisitScheduleModel {
  static parseRule(row) {
    if (!row) return null;
    return {
      id: asNumber(row.id),
      client_id: asNumber(row.client_id),
      client_name: row.client_name || null,
      event_type: row.event_type,
      interval_months: asNumber(row.interval_months),
      label: row.label,
      enabled: row.enabled !== false,
      duration_minutes: asNumber(row.duration_minutes) ?? 60,
      notification_days_before: asNumber(row.notification_days_before) ?? 7,
      reminder_hour: asNumber(row.reminder_hour) ?? 9,
      start_time: asTime(row.start_time),
      horizon_months: asNumber(row.horizon_months) ?? 24,
      guests: asGuests(row.guests),
      notes: row.notes || null,
      updated_at: asIso(row.updated_at),
    };
  }

  static parseVisit(row) {
    if (!row) return null;
    return {
      id: asNumber(row.id),
      series_id: row.series_id,
      rule_id: asNumber(row.rule_id),
      client_id: asNumber(row.client_id),
      client_name: row.client_name || null,
      punto_venta_id: asNumber(row.punto_venta_id),
      punto_venta_name: row.punto_venta_name || null,
      codigo_tienda: row.codigo_tienda || null,
      event_type: row.event_type,
      interval_months: asNumber(row.interval_months),
      interval_weeks: asNumber(row.interval_weeks),
      title: row.title,
      notes: row.notes || null,
      starts_at: asIso(row.starts_at),
      ends_at: asIso(row.ends_at),
      time_zone: row.time_zone || 'America/Tijuana',
      guests: asGuests(row.guests),
      notification_days_before: asNumber(row.notification_days_before) ?? 7,
      reminder_hour: asNumber(row.reminder_hour) ?? 9,
      google_event_id: row.google_event_id || null,
      meet_link: row.meet_link || null,
      calendar_link: row.calendar_link || null,
      status: row.status,
      reminder_sent_at: asIso(row.reminder_sent_at),
      reminder_error: row.reminder_error || null,
    };
  }

  static async listRules(clientId) {
    const result = await query(
      `SELECT r.*, c.name AS client_name
       FROM visit_rules r
       LEFT JOIN clients c ON c.id = r.client_id
       WHERE r.client_id = $1
       ${RULE_ORDER}`,
      [clientId]
    );
    return result.rows.map((row) => this.parseRule(row));
  }

  static async findClient(id) {
    const result = await query('SELECT id, name, email FROM clients WHERE id = $1 LIMIT 1', [id]);
    const row = result.rows[0];
    if (!row) return null;
    return { id: asNumber(row.id), name: row.name, email: row.email || null };
  }

  static async findRule(id) {
    const result = await query(
      `SELECT r.*, c.name AS client_name
       FROM visit_rules r
       LEFT JOIN clients c ON c.id = r.client_id
       WHERE r.id = $1
       LIMIT 1`,
      [id]
    );
    return this.parseRule(result.rows[0]);
  }

  static async createRule(data) {
    const result = await query(
      `INSERT INTO visit_rules (
         client_id, event_type, interval_months, label, enabled,
         duration_minutes, notification_days_before, reminder_hour,
         start_time, horizon_months, guests, notes
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8,
         $9, $10, $11::jsonb, $12
       )
       RETURNING *`,
      [
        data.client_id,
        data.event_type,
        data.interval_months,
        data.label,
        data.enabled,
        data.duration_minutes,
        data.notification_days_before,
        data.reminder_hour,
        data.start_time,
        data.horizon_months,
        JSON.stringify(data.guests),
        data.notes,
      ]
    );
    return this.parseRule(result.rows[0]);
  }

  static async countOpenVisits(ruleId) {
    const result = await query(
      `SELECT COUNT(*)::int AS total
       FROM scheduled_visits
       WHERE rule_id = $1 AND status = 'scheduled' AND starts_at > NOW()`,
      [ruleId]
    );
    return result.rows[0]?.total || 0;
  }

  static async deleteRule(id) {
    const result = await query('DELETE FROM visit_rules WHERE id = $1 RETURNING id', [id]);
    return result.rowCount > 0;
  }

  static async updateRule(id, data) {
    const result = await query(
      `UPDATE visit_rules SET
         enabled = $2,
         duration_minutes = $3,
         notification_days_before = $4,
         reminder_hour = $5,
         start_time = $6,
         horizon_months = $7,
         guests = $8::jsonb,
         notes = $9,
         label = $10,
         interval_months = $11,
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        data.enabled,
        data.duration_minutes,
        data.notification_days_before,
        data.reminder_hour,
        data.start_time,
        data.horizon_months,
        JSON.stringify(data.guests),
        data.notes,
        data.label,
        data.interval_months,
      ]
    );
    return this.parseRule(result.rows[0]);
  }

  static async findPunto(id) {
    const result = await query(
      `SELECT id, name, codigo_tienda, code, clientid
       FROM puntoventa
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: asNumber(row.id),
      name: row.name || row.codigo_tienda || row.code || `Punto ${row.id}`,
      codigo_tienda: row.codigo_tienda || row.code || null,
      client_id: asNumber(row.clientid),
    };
  }

  static async insertVisits(rows) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const inserted = [];
      for (const row of rows) {
        const result = await client.query(
          `INSERT INTO scheduled_visits (
             series_id, rule_id, client_id, client_name, punto_venta_id, punto_venta_name, codigo_tienda,
             event_type, interval_months, interval_weeks, title, notes, starts_at, ends_at, time_zone,
             guests, notification_days_before, reminder_hour,
             google_event_id, meet_link, calendar_link, status
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7,
             $8, $9, $10, $11, $12, $13, $14, $15,
             $16::jsonb, $17, $18,
             $19, $20, $21, 'scheduled'
           )
           RETURNING *`,
          [
            row.series_id,
            row.rule_id,
            row.client_id,
            row.client_name,
            row.punto_venta_id,
            row.punto_venta_name,
            row.codigo_tienda,
            row.event_type,
            row.interval_months,
            row.interval_weeks,
            row.title,
            row.notes,
            row.starts_at,
            row.ends_at,
            row.time_zone,
            JSON.stringify(row.guests),
            row.notification_days_before,
            row.reminder_hour,
            row.google_event_id,
            row.meet_link,
            row.calendar_link,
          ]
        );
        inserted.push(this.parseVisit(result.rows[0]));
      }
      await client.query('COMMIT');
      return inserted;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async listUpcoming(clientId) {
    const result = await query(
      `SELECT * FROM scheduled_visits
       WHERE status = 'scheduled'
         AND starts_at >= NOW() - INTERVAL '1 day'
         AND ($1::bigint IS NULL OR client_id = $1)
       ORDER BY starts_at ASC
       LIMIT 400`,
      [clientId || null]
    );
    return result.rows.map((row) => this.parseVisit(row));
  }

  static async findVisit(id) {
    const result = await query('SELECT * FROM scheduled_visits WHERE id = $1 LIMIT 1', [id]);
    return this.parseVisit(result.rows[0]);
  }

  static async listSeries(seriesId, { scheduledOnly = true } = {}) {
    const result = await query(
      `SELECT * FROM scheduled_visits
       WHERE series_id = $1
         AND ($2::boolean = FALSE OR status = 'scheduled')
       ORDER BY starts_at ASC`,
      [seriesId, scheduledOnly]
    );
    return result.rows.map((row) => this.parseVisit(row));
  }

  static async markCancelled(ids) {
    if (!ids.length) return [];
    const result = await query(
      `UPDATE scheduled_visits
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = ANY($1::bigint[]) AND status = 'scheduled'
       RETURNING *`,
      [ids]
    );
    return result.rows.map((row) => this.parseVisit(row));
  }

  static async claimDueReminders() {
    const result = await query(
      `UPDATE scheduled_visits AS v
       SET reminder_claimed_at = NOW(), updated_at = NOW()
       WHERE v.id IN (
         SELECT id
         FROM scheduled_visits
         WHERE status = 'scheduled'
           AND reminder_sent_at IS NULL
           AND starts_at > NOW()
           AND (
             ((starts_at AT TIME ZONE time_zone)::date - notification_days_before)
               < (NOW() AT TIME ZONE time_zone)::date
             OR (
               ((starts_at AT TIME ZONE time_zone)::date - notification_days_before)
                 = (NOW() AT TIME ZONE time_zone)::date
               AND EXTRACT(HOUR FROM (NOW() AT TIME ZONE time_zone))::int >= reminder_hour
             )
           )
           AND (reminder_claimed_at IS NULL OR reminder_claimed_at < NOW() - INTERVAL '30 minutes')
         ORDER BY starts_at
         LIMIT 50
       )
       RETURNING *`
    );
    return result.rows.map((row) => this.parseVisit(row));
  }

  static async markReminderSent(id) {
    await query(
      `UPDATE scheduled_visits
       SET reminder_sent_at = NOW(), reminder_error = NULL, updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
  }

  static async markReminderFailed(id, message) {
    await query(
      `UPDATE scheduled_visits
       SET reminder_claimed_at = NULL, reminder_error = $2, updated_at = NOW()
       WHERE id = $1 AND reminder_sent_at IS NULL`,
      [id, message]
    );
  }

  static async markReminderSkipped(id, message) {
    await query(
      `UPDATE scheduled_visits
       SET reminder_sent_at = NOW(), reminder_error = $2, updated_at = NOW()
       WHERE id = $1`,
      [id, message]
    );
  }
}

export default VisitScheduleModel;

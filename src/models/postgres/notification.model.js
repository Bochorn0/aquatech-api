// PostgreSQL model for notifications table (replaces MongoDB Notification)

import { query } from '../../config/postgres.config.js';

class NotificationModel {
  static async findById(id) {
    const result = await query('SELECT * FROM notifications WHERE id = $1 LIMIT 1', [id]);
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async findByUserId(userId) {
    const result = await query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY posted_at DESC',
      [userId]
    );
    return (result.rows || []).map(r => this.parseRow(r));
  }

  static async create(data) {
    const result = await query(`
      INSERT INTO notifications (user_id, title, description, avatar_url, type, posted_at, is_unread, url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [data.user_id, data.title, data.description, data.avatar_url ?? null, data.type, data.posted_at ?? new Date(), data.is_unread ?? true, data.url ?? null]);
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async update(id, data) {
    const result = await query(`
      UPDATE notifications SET
        is_unread = COALESCE($1, is_unread),
        updatedat = CURRENT_TIMESTAMP
      WHERE id = $2 RETURNING *
    `, [data.is_unread ?? data.isUnRead, id]);
    return result.rows?.[0] ? this.parseRow(result.rows[0]) : null;
  }

  static async markAllAsRead(userId) {
    await query('UPDATE notifications SET is_unread = FALSE, updatedat = CURRENT_TIMESTAMP WHERE user_id = $1', [userId]);
  }

  static parseRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      _id: String(row.id),
      user: row.user_id,
      user_id: row.user_id,
      title: row.title,
      description: row.description,
      avatarUrl: row.avatar_url,
      type: row.type,
      postedAt: row.posted_at,
      isUnRead: row.is_unread ?? true,
      url: row.url
    };
  }
}

export default NotificationModel;

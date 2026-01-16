// src/models/postgres/tiwater-quote.model.js
// PostgreSQL model for tiwater_quotes and tiwater_quote_items tables

import { query, getClient } from '../../config/postgres-tiwater.config.js';

/**
 * TI Water Quote Model
 * Handles all database operations for the tiwater_quotes and tiwater_quote_items tables
 */
class TIWaterQuoteModel {
  /**
   * Generate next quote number
   * Format: COT-YYYY-NNN (e.g., COT-2024-001)
   * @returns {Promise<String>} Next quote number
   */
  static async generateQuoteNumber() {
    const year = new Date().getFullYear();
    const prefix = `COT-${year}-`;
    
    // Find the highest quote number for this year
    const selectQuery = `
      SELECT quote_number 
      FROM tiwater_quotes 
      WHERE quote_number LIKE $1
      ORDER BY quote_number DESC
      LIMIT 1
    `;
    
    try {
      const result = await query(selectQuery, [`${prefix}%`]);
      
      if (result.rows.length === 0) {
        return `${prefix}001`;
      }
      
      const lastQuoteNumber = result.rows[0].quote_number;
      const lastNumber = parseInt(lastQuoteNumber.replace(prefix, ''));
      const nextNumber = String(lastNumber + 1).padStart(3, '0');
      
      return `${prefix}${nextNumber}`;
    } catch (error) {
      console.error('[TIWaterQuoteModel] Error generating quote number:', error);
      // Fallback to timestamp-based number
      const timestamp = Date.now().toString().slice(-6);
      return `${prefix}${timestamp}`;
    }
  }

  /**
   * Create a new quote with items
   * @param {Object} data - Quote data object with items array
   * @returns {Promise<Object>} Created quote record with items
   */
  static async create(data) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      // Generate quote number if not provided
      const quoteNumber = data.quoteNumber || data.quote_number || await this.generateQuoteNumber();
      
      // Calculate totals if not provided
      const subtotal = data.subtotal !== undefined ? parseFloat(data.subtotal) : 0;
      const tax = data.tax !== undefined ? parseFloat(data.tax) : 0;
      const total = data.total !== undefined ? parseFloat(data.total) : (subtotal + tax);
      
      // Insert quote
      const quoteQuery = `
        INSERT INTO tiwater_quotes (
          quote_number, client_name, client_email, client_phone, client_address,
          subtotal, tax, total, notes, valid_until, status, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        ) RETURNING *
      `;
      
      const quoteValues = [
        quoteNumber,
        data.clientName || data.client_name || null,
        data.clientEmail || data.client_email || null,
        data.clientPhone || data.client_phone || null,
        data.clientAddress || data.client_address || null,
        subtotal,
        tax,
        total,
        data.notes || null,
        data.validUntil || data.valid_until ? new Date(data.validUntil || data.valid_until) : null,
        data.status || 'draft',
        data.createdBy || data.created_by || null
      ];
      
      const quoteResult = await client.query(quoteQuery, quoteValues);
      const quote = this.parseQuoteRow(quoteResult.rows[0]);
      
      // Insert quote items if provided
      const items = data.items || [];
      const quoteItems = [];
      
      for (const item of items) {
        const itemQuery = `
          INSERT INTO tiwater_quote_items (
            quote_id, product_id, quantity, unit_price, discount, subtotal, notes
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7
          ) RETURNING *
        `;
        
        const itemValues = [
          quote.id,
          item.productId || item.product_id,
          parseFloat(item.quantity || 1),
          parseFloat(item.unitPrice || item.unit_price || 0),
          parseFloat(item.discount || 0),
          parseFloat(item.subtotal || 0),
          item.notes || null
        ];
        
        const itemResult = await client.query(itemQuery, itemValues);
        quoteItems.push(this.parseQuoteItemRow(itemResult.rows[0]));
      }
      
      await client.query('COMMIT');
      
      return {
        ...quote,
        items: quoteItems
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[TIWaterQuoteModel] Error creating quote:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Find quotes with filters
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options (limit, offset, orderBy)
   * @returns {Promise<Array>} Array of quote records with items
   */
  static async find(filters = {}, options = {}) {
    const {
      limit = 100,
      offset = 0,
      orderBy = 'created_at DESC'
    } = options;

    let whereClause = '1=1';
    const values = [];
    let paramIndex = 1;

    // Build WHERE clause dynamically
    if (filters.status) {
      whereClause += ` AND q.status = $${paramIndex++}`;
      values.push(filters.status);
    }

    if (filters.clientName || filters.client_name) {
      whereClause += ` AND q.client_name ILIKE $${paramIndex++}`;
      values.push(`%${filters.clientName || filters.client_name}%`);
    }

    if (filters.quoteNumber || filters.quote_number) {
      whereClause += ` AND q.quote_number ILIKE $${paramIndex++}`;
      values.push(`%${filters.quoteNumber || filters.quote_number}%`);
    }

    if (filters.createdBy || filters.created_by) {
      whereClause += ` AND q.created_by = $${paramIndex++}`;
      values.push(filters.createdBy || filters.created_by);
    }

    const selectQuery = `
      SELECT q.* FROM tiwater_quotes q
      WHERE ${whereClause}
      ORDER BY q.${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);

    try {
      const result = await query(selectQuery, values);
      const quotes = await Promise.all(
        result.rows.map(async (row) => {
          const quote = this.parseQuoteRow(row);
          const items = await this.getQuoteItems(quote.id);
          return { ...quote, items };
        })
      );
      return quotes;
    } catch (error) {
      console.error('[TIWaterQuoteModel] Error finding quotes:', error);
      throw error;
    }
  }

  /**
   * Get items for a quote
   * @param {Number} quoteId - Quote ID
   * @returns {Promise<Array>} Array of quote items
   */
  static async getQuoteItems(quoteId) {
    const itemsQuery = `
      SELECT qi.*, p.code, p.name, p.description, p.category
      FROM tiwater_quote_items qi
      JOIN tiwater_products p ON qi.product_id = p.id
      WHERE qi.quote_id = $1
      ORDER BY qi.id
    `;
    
    try {
      const result = await query(itemsQuery, [quoteId]);
      return result.rows.map(row => ({
        ...this.parseQuoteItemRow(row),
        product: {
          code: row.code,
          name: row.name,
          description: row.description,
          category: row.category
        }
      }));
    } catch (error) {
      console.error('[TIWaterQuoteModel] Error getting quote items:', error);
      throw error;
    }
  }

  /**
   * Find a single quote by ID
   * @param {Number} id - Quote ID
   * @returns {Promise<Object|null>} Quote record with items or null
   */
  static async findById(id) {
    const selectQuery = 'SELECT * FROM tiwater_quotes WHERE id = $1';
    
    try {
      const result = await query(selectQuery, [id]);
      if (result.rows.length === 0) {
        return null;
      }
      
      const quote = this.parseQuoteRow(result.rows[0]);
      const items = await this.getQuoteItems(id);
      
      return {
        ...quote,
        items
      };
    } catch (error) {
      console.error('[TIWaterQuoteModel] Error finding quote by ID:', error);
      throw error;
    }
  }

  /**
   * Update a quote by ID
   * @param {Number} id - Quote ID
   * @param {Object} data - Updated quote data
   * @returns {Promise<Object|null>} Updated quote record with items or null
   */
  static async updateById(id, data) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      const fields = [];
      const values = [];
      let paramIndex = 1;

      // Build SET clause dynamically
      if (data.clientName !== undefined || data.client_name !== undefined) {
        fields.push(`client_name = $${paramIndex++}`);
        values.push(data.clientName || data.client_name);
      }
      if (data.clientEmail !== undefined || data.client_email !== undefined) {
        fields.push(`client_email = $${paramIndex++}`);
        values.push(data.clientEmail !== null ? (data.clientEmail || data.client_email) : null);
      }
      if (data.clientPhone !== undefined || data.client_phone !== undefined) {
        fields.push(`client_phone = $${paramIndex++}`);
        values.push(data.clientPhone !== null ? (data.clientPhone || data.client_phone) : null);
      }
      if (data.clientAddress !== undefined || data.client_address !== undefined) {
        fields.push(`client_address = $${paramIndex++}`);
        values.push(data.clientAddress !== null ? (data.clientAddress || data.client_address) : null);
      }
      if (data.subtotal !== undefined) {
        fields.push(`subtotal = $${paramIndex++}`);
        values.push(parseFloat(data.subtotal));
      }
      if (data.tax !== undefined) {
        fields.push(`tax = $${paramIndex++}`);
        values.push(parseFloat(data.tax));
      }
      if (data.total !== undefined) {
        fields.push(`total = $${paramIndex++}`);
        values.push(parseFloat(data.total));
      }
      if (data.notes !== undefined) {
        fields.push(`notes = $${paramIndex++}`);
        values.push(data.notes);
      }
      if (data.validUntil !== undefined || data.valid_until !== undefined) {
        fields.push(`valid_until = $${paramIndex++}`);
        values.push(data.validUntil || data.valid_until ? new Date(data.validUntil || data.valid_until) : null);
      }
      if (data.status !== undefined) {
        fields.push(`status = $${paramIndex++}`);
        values.push(data.status);
      }

      if (fields.length > 0) {
        values.push(id);
        const updateQuery = `
          UPDATE tiwater_quotes
          SET ${fields.join(', ')}
          WHERE id = $${paramIndex}
          RETURNING *
        `;
        
        await client.query(updateQuery, values);
      }

      // Update items if provided
      if (data.items !== undefined) {
        // Delete existing items
        await client.query('DELETE FROM tiwater_quote_items WHERE quote_id = $1', [id]);
        
        // Insert new items
        for (const item of data.items) {
          const itemQuery = `
            INSERT INTO tiwater_quote_items (
              quote_id, product_id, quantity, unit_price, discount, subtotal, notes
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7
            )
          `;
          
          const itemValues = [
            id,
            item.productId || item.product_id,
            parseFloat(item.quantity || 1),
            parseFloat(item.unitPrice || item.unit_price || 0),
            parseFloat(item.discount || 0),
            parseFloat(item.subtotal || 0),
            item.notes || null
          ];
          
          await client.query(itemQuery, itemValues);
        }
      }
      
      await client.query('COMMIT');
      
      // Return updated quote with items
      return this.findById(id);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[TIWaterQuoteModel] Error updating quote:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete a quote by ID (and its items via CASCADE)
   * @param {Number} id - Quote ID
   * @returns {Promise<Boolean>} Success status
   */
  static async deleteById(id) {
    const deleteQuery = 'DELETE FROM tiwater_quotes WHERE id = $1';
    
    try {
      const result = await query(deleteQuery, [id]);
      return result.rowCount > 0;
    } catch (error) {
      console.error('[TIWaterQuoteModel] Error deleting quote:', error);
      throw error;
    }
  }

  /**
   * Count quotes with filters
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Number>} Count of records
   */
  static async count(filters = {}) {
    let whereClause = '1=1';
    const values = [];
    let paramIndex = 1;

    if (filters.status) {
      whereClause += ` AND status = $${paramIndex++}`;
      values.push(filters.status);
    }
    if (filters.clientName || filters.client_name) {
      whereClause += ` AND client_name ILIKE $${paramIndex++}`;
      values.push(`%${filters.clientName || filters.client_name}%`);
    }
    if (filters.createdBy || filters.created_by) {
      whereClause += ` AND created_by = $${paramIndex++}`;
      values.push(filters.createdBy || filters.created_by);
    }

    const countQuery = `SELECT COUNT(*) as count FROM tiwater_quotes WHERE ${whereClause}`;

    try {
      const result = await query(countQuery, values);
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('[TIWaterQuoteModel] Error counting quotes:', error);
      throw error;
    }
  }

  /**
   * Parse database row to clean quote object
   * @param {Object} row - Database row
   * @returns {Object} Parsed quote object
   */
  static parseQuoteRow(row) {
    if (!row) return null;

    return {
      id: row.id,
      quoteNumber: row.quote_number,
      clientName: row.client_name,
      clientEmail: row.client_email,
      clientPhone: row.client_phone,
      clientAddress: row.client_address,
      subtotal: row.subtotal !== null ? parseFloat(row.subtotal) : 0,
      tax: row.tax !== null ? parseFloat(row.tax) : 0,
      total: row.total !== null ? parseFloat(row.total) : 0,
      notes: row.notes,
      validUntil: row.valid_until,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Parse database row to clean quote item object
   * @param {Object} row - Database row
   * @returns {Object} Parsed quote item object
   */
  static parseQuoteItemRow(row) {
    if (!row) return null;

    return {
      id: row.id,
      quoteId: row.quote_id,
      productId: row.product_id,
      quantity: parseFloat(row.quantity),
      unitPrice: parseFloat(row.unit_price),
      discount: parseFloat(row.discount || 0),
      subtotal: parseFloat(row.subtotal),
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default TIWaterQuoteModel;

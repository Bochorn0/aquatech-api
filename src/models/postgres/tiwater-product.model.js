// src/models/postgres/tiwater-product.model.js
// PostgreSQL model for tiwater_products table

import { query, getClient } from '../../config/postgres-tiwater.config.js';

/**
 * TI Water Product Model
 * Handles all database operations for the tiwater_products table
 */
class TIWaterProductModel {
  /**
   * Create a new product
   * @param {Object} data - Product data object
   * @returns {Promise<Object>} Created product record
   */
  static async create(data) {
    const insertQuery = `
      INSERT INTO tiwater_products (
        code, name, description, category, price,
        specifications, images, catalog_source, page_number, is_active
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      ) RETURNING *
    `;

    const values = [
      data.code || null,
      data.name || null,
      data.description || null,
      data.category || null,
      data.price !== undefined ? parseFloat(data.price) : null,
      data.specifications ? JSON.stringify(data.specifications) : null,
      data.images ? JSON.stringify(data.images) : null,
      data.catalogSource || data.catalog_source || null,
      data.pageNumber || data.page_number || null,
      data.isActive !== undefined ? data.isActive : true
    ];

    try {
      const result = await query(insertQuery, values);
      return this.parseRow(result.rows[0]);
    } catch (error) {
      console.error('[TIWaterProductModel] Error creating product:', error);
      throw error;
    }
  }

  /**
   * Find products with filters
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options (limit, offset, orderBy)
   * @returns {Promise<Array>} Array of product records
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
    if (filters.code) {
      whereClause += ` AND code = $${paramIndex}`;
      values.push(filters.code);
      paramIndex++;
    }

    if (filters.category) {
      whereClause += ` AND category = $${paramIndex}`;
      values.push(filters.category);
      paramIndex++;
    }

    if (filters.isActive !== undefined) {
      whereClause += ` AND is_active = $${paramIndex}`;
      values.push(filters.isActive);
      paramIndex++;
    }

    if (filters.catalogSource || filters.catalog_source) {
      whereClause += ` AND catalog_source = $${paramIndex}`;
      values.push(filters.catalogSource || filters.catalog_source);
      paramIndex++;
    }

    if (filters.search) {
      // Full-text search on name and description
      whereClause += ` AND (
        name ILIKE $${paramIndex} OR 
        description ILIKE $${paramIndex} OR
        code ILIKE $${paramIndex}
      )`;
      const searchTerm = `%${filters.search}%`;
      values.push(searchTerm, searchTerm, searchTerm);
      paramIndex += 3;
    }

    const selectQuery = `
      SELECT * FROM tiwater_products
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);

    try {
      const result = await query(selectQuery, values);
      return result.rows.map(row => this.parseRow(row));
    } catch (error) {
      console.error('[TIWaterProductModel] Error finding products:', error);
      throw error;
    }
  }

  /**
   * Find a single product by ID
   * @param {Number} id - Product ID
   * @returns {Promise<Object|null>} Product record or null
   */
  static async findById(id) {
    const selectQuery = 'SELECT * FROM tiwater_products WHERE id = $1';
    
    try {
      const result = await query(selectQuery, [id]);
      return result.rows.length > 0 ? this.parseRow(result.rows[0]) : null;
    } catch (error) {
      console.error('[TIWaterProductModel] Error finding product by ID:', error);
      throw error;
    }
  }

  /**
   * Find a product by code
   * @param {String} code - Product code
   * @returns {Promise<Object|null>} Product record or null
   */
  static async findByCode(code) {
    const selectQuery = 'SELECT * FROM tiwater_products WHERE code = $1';
    
    try {
      const result = await query(selectQuery, [code]);
      return result.rows.length > 0 ? this.parseRow(result.rows[0]) : null;
    } catch (error) {
      console.error('[TIWaterProductModel] Error finding product by code:', error);
      throw error;
    }
  }

  /**
   * Update a product by ID
   * @param {Number} id - Product ID
   * @param {Object} data - Updated product data
   * @returns {Promise<Object|null>} Updated product record or null
   */
  static async updateById(id, data) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    // Build SET clause dynamically
    if (data.code !== undefined) {
      fields.push(`code = $${paramIndex++}`);
      values.push(data.code);
    }
    if (data.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.category !== undefined) {
      fields.push(`category = $${paramIndex++}`);
      values.push(data.category);
    }
    if (data.price !== undefined) {
      fields.push(`price = $${paramIndex++}`);
      values.push(data.price !== null ? parseFloat(data.price) : null);
    }
    if (data.specifications !== undefined) {
      fields.push(`specifications = $${paramIndex++}`);
      values.push(data.specifications ? JSON.stringify(data.specifications) : null);
    }
    if (data.images !== undefined) {
      fields.push(`images = $${paramIndex++}`);
      values.push(data.images ? JSON.stringify(data.images) : null);
    }
    if (data.catalogSource !== undefined || data.catalog_source !== undefined) {
      fields.push(`catalog_source = $${paramIndex++}`);
      values.push(data.catalogSource || data.catalog_source || null);
    }
    if (data.pageNumber !== undefined || data.page_number !== undefined) {
      fields.push(`page_number = $${paramIndex++}`);
      values.push(data.pageNumber || data.page_number || null);
    }
    if (data.isActive !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(data.isActive);
    }

    if (fields.length === 0) {
      // No fields to update, return current record
      return this.findById(id);
    }

    values.push(id);
    const updateQuery = `
      UPDATE tiwater_products
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    try {
      const result = await query(updateQuery, values);
      return result.rows.length > 0 ? this.parseRow(result.rows[0]) : null;
    } catch (error) {
      console.error('[TIWaterProductModel] Error updating product:', error);
      throw error;
    }
  }

  /**
   * Delete a product by ID (soft delete by setting is_active = false)
   * @param {Number} id - Product ID
   * @returns {Promise<Object|null>} Updated product record or null
   */
  static async deleteById(id) {
    return this.updateById(id, { isActive: false });
  }

  /**
   * Count products with filters
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Number>} Count of records
   */
  static async count(filters = {}) {
    let whereClause = '1=1';
    const values = [];
    let paramIndex = 1;

    // Build WHERE clause (same logic as find)
    if (filters.code) {
      whereClause += ` AND code = $${paramIndex++}`;
      values.push(filters.code);
    }
    if (filters.category) {
      whereClause += ` AND category = $${paramIndex++}`;
      values.push(filters.category);
    }
    if (filters.isActive !== undefined) {
      whereClause += ` AND is_active = $${paramIndex++}`;
      values.push(filters.isActive);
    }
    if (filters.catalogSource || filters.catalog_source) {
      whereClause += ` AND catalog_source = $${paramIndex++}`;
      values.push(filters.catalogSource || filters.catalog_source);
    }
    if (filters.search) {
      whereClause += ` AND (
        name ILIKE $${paramIndex} OR 
        description ILIKE $${paramIndex} OR
        code ILIKE $${paramIndex}
      )`;
      const searchTerm = `%${filters.search}%`;
      values.push(searchTerm, searchTerm, searchTerm);
      paramIndex += 3;
    }

    const countQuery = `SELECT COUNT(*) as count FROM tiwater_products WHERE ${whereClause}`;

    try {
      const result = await query(countQuery, values);
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('[TIWaterProductModel] Error counting products:', error);
      throw error;
    }
  }

  /**
   * Parse database row to clean object
   * @param {Object} row - Database row
   * @returns {Object} Parsed product object
   */
  static parseRow(row) {
    if (!row) return null;

    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      category: row.category,
      price: row.price !== null ? parseFloat(row.price) : null,
      specifications: typeof row.specifications === 'string' ? JSON.parse(row.specifications) : row.specifications,
      images: typeof row.images === 'string' ? JSON.parse(row.images) : row.images,
      catalogSource: row.catalog_source,
      pageNumber: row.page_number,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default TIWaterProductModel;

// src/controllers/tiwater-product.controller.js
// Controller for TI Water products endpoints

import TIWaterProductModel from '../models/postgres/tiwater-product.model.js';

/**
 * Get all products
 */
export const getProducts = async (req, res) => {
  try {
    const { 
      category, 
      search, 
      isActive,
      catalogSource,
      limit = 100, 
      offset = 0 
    } = req.query;

    const filters = {};
    if (category) filters.category = category;
    if (search) filters.search = search;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (catalogSource) filters.catalogSource = catalogSource;

    const options = {
      limit: parseInt(limit),
      offset: parseInt(offset),
      orderBy: 'created_at DESC'
    };

    const products = await TIWaterProductModel.find(filters, options);
    const total = await TIWaterProductModel.count(filters);

    res.status(200).json({
      products,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + products.length < total
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Error al obtener productos', error: error.message });
  }
};

/**
 * Get a specific product by ID
 */
export const getProductById = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await TIWaterProductModel.findById(parseInt(productId));
    
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    
    res.status(200).json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: 'Error al obtener producto', error: error.message });
  }
};

/**
 * Get a product by code
 */
export const getProductByCode = async (req, res) => {
  try {
    const { code } = req.params;
    const product = await TIWaterProductModel.findByCode(code);
    
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    
    res.status(200).json(product);
  } catch (error) {
    console.error('Error fetching product by code:', error);
    res.status(500).json({ message: 'Error al obtener producto', error: error.message });
  }
};

/**
 * Create a new product
 */
export const createProduct = async (req, res) => {
  try {
    const productData = req.body;
    
    // Validate required fields
    if (!productData.code || !productData.name) {
      return res.status(400).json({ 
        message: 'Código y nombre son requeridos' 
      });
    }

    // Check if code already exists
    const existingProduct = await TIWaterProductModel.findByCode(productData.code);
    if (existingProduct) {
      return res.status(409).json({ 
        message: 'Ya existe un producto con este código' 
      });
    }

    const product = await TIWaterProductModel.create(productData);
    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    
    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({ 
        message: 'Ya existe un producto con este código' 
      });
    }
    
    res.status(500).json({ message: 'Error al crear producto', error: error.message });
  }
};

/**
 * Update a product by ID
 */
export const updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const productData = req.body;
    
    const updatedProduct = await TIWaterProductModel.updateById(parseInt(productId), productData);
    
    if (!updatedProduct) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    
    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    
    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({ 
        message: 'Ya existe un producto con este código' 
      });
    }
    
    res.status(500).json({ message: 'Error al actualizar producto', error: error.message });
  }
};

/**
 * Delete a product by ID (soft delete)
 */
export const deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    
    const deletedProduct = await TIWaterProductModel.deleteById(parseInt(productId));
    
    if (!deletedProduct) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }
    
    res.status(200).json({ 
      message: 'Producto eliminado correctamente',
      product: deletedProduct 
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Error al eliminar producto', error: error.message });
  }
};

/**
 * Get product statistics
 */
export const getProductStats = async (req, res) => {
  try {
    const totalProducts = await TIWaterProductModel.count({});
    const activeProducts = await TIWaterProductModel.count({ isActive: true });
    const inactiveProducts = await TIWaterProductModel.count({ isActive: false });
    
    // Get products by category
    const categories = ['general', 'presurizadores', 'valvulas_sistemas', 'sumergibles', 'plomeria'];
    const categoryStats = {};
    
    for (const category of categories) {
      categoryStats[category] = await TIWaterProductModel.count({ category, isActive: true });
    }

    res.status(200).json({
      total: totalProducts,
      active: activeProducts,
      inactive: inactiveProducts,
      byCategory: categoryStats
    });
  } catch (error) {
    console.error('Error fetching product statistics:', error);
    res.status(500).json({ message: 'Error al obtener estadísticas', error: error.message });
  }
};

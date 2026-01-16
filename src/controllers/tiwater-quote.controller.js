// src/controllers/tiwater-quote.controller.js
// Controller for TI Water quotes endpoints

import TIWaterQuoteModel from '../models/postgres/tiwater-quote.model.js';

/**
 * Get all quotes
 */
export const getQuotes = async (req, res) => {
  try {
    const { 
      status, 
      clientName,
      quoteNumber,
      createdBy,
      limit = 100, 
      offset = 0 
    } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (clientName) filters.clientName = clientName;
    if (quoteNumber) filters.quoteNumber = quoteNumber;
    if (createdBy) filters.createdBy = createdBy;

    const options = {
      limit: parseInt(limit),
      offset: parseInt(offset),
      orderBy: 'created_at DESC'
    };

    const quotes = await TIWaterQuoteModel.find(filters, options);
    const total = await TIWaterQuoteModel.count(filters);

    res.status(200).json({
      quotes,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + quotes.length < total
      }
    });
  } catch (error) {
    console.error('Error fetching quotes:', error);
    res.status(500).json({ message: 'Error al obtener cotizaciones', error: error.message });
  }
};

/**
 * Get a specific quote by ID
 */
export const getQuoteById = async (req, res) => {
  try {
    const { quoteId } = req.params;
    const quote = await TIWaterQuoteModel.findById(parseInt(quoteId));
    
    if (!quote) {
      return res.status(404).json({ message: 'Cotización no encontrada' });
    }
    
    res.status(200).json(quote);
  } catch (error) {
    console.error('Error fetching quote:', error);
    res.status(500).json({ message: 'Error al obtener cotización', error: error.message });
  }
};

/**
 * Create a new quote
 */
export const createQuote = async (req, res) => {
  try {
    const quoteData = req.body;
    
    // Validate required fields
    if (!quoteData.clientName && !quoteData.client_name) {
      return res.status(400).json({ 
        message: 'Nombre del cliente es requerido' 
      });
    }

    // Calculate totals from items if not provided
    if (quoteData.items && quoteData.items.length > 0) {
      let subtotal = 0;
      for (const item of quoteData.items) {
        const itemSubtotal = parseFloat(item.subtotal) || 
          (parseFloat(item.quantity || 1) * parseFloat(item.unitPrice || item.unit_price || 0)) - 
          parseFloat(item.discount || 0);
        subtotal += itemSubtotal;
      }
      
      if (!quoteData.subtotal && !quoteData.total) {
        quoteData.subtotal = subtotal;
        quoteData.tax = quoteData.tax || 0;
        quoteData.total = subtotal + (quoteData.tax || 0);
      }
    }

    // Set created_by from auth token if available
    if (req.user && req.user.id) {
      quoteData.createdBy = req.user.id;
    }

    const quote = await TIWaterQuoteModel.create(quoteData);
    res.status(201).json(quote);
  } catch (error) {
    console.error('Error creating quote:', error);
    res.status(500).json({ message: 'Error al crear cotización', error: error.message });
  }
};

/**
 * Update a quote by ID
 */
export const updateQuote = async (req, res) => {
  try {
    const { quoteId } = req.params;
    const quoteData = req.body;

    // Recalculate totals from items if items are provided
    if (quoteData.items && quoteData.items.length > 0) {
      let subtotal = 0;
      for (const item of quoteData.items) {
        const itemSubtotal = parseFloat(item.subtotal) || 
          (parseFloat(item.quantity || 1) * parseFloat(item.unitPrice || item.unit_price || 0)) - 
          parseFloat(item.discount || 0);
        subtotal += itemSubtotal;
      }
      
      quoteData.subtotal = subtotal;
      quoteData.tax = quoteData.tax || 0;
      quoteData.total = subtotal + (quoteData.tax || 0);
    }
    
    const updatedQuote = await TIWaterQuoteModel.updateById(parseInt(quoteId), quoteData);
    
    if (!updatedQuote) {
      return res.status(404).json({ message: 'Cotización no encontrada' });
    }
    
    res.status(200).json(updatedQuote);
  } catch (error) {
    console.error('Error updating quote:', error);
    res.status(500).json({ message: 'Error al actualizar cotización', error: error.message });
  }
};

/**
 * Delete a quote by ID
 */
export const deleteQuote = async (req, res) => {
  try {
    const { quoteId } = req.params;
    
    const deleted = await TIWaterQuoteModel.deleteById(parseInt(quoteId));
    
    if (!deleted) {
      return res.status(404).json({ message: 'Cotización no encontrada' });
    }
    
    res.status(200).json({ 
      message: 'Cotización eliminada correctamente' 
    });
  } catch (error) {
    console.error('Error deleting quote:', error);
    res.status(500).json({ message: 'Error al eliminar cotización', error: error.message });
  }
};

/**
 * Get quote statistics
 */
export const getQuoteStats = async (req, res) => {
  try {
    const totalQuotes = await TIWaterQuoteModel.count({});
    const draftQuotes = await TIWaterQuoteModel.count({ status: 'draft' });
    const sentQuotes = await TIWaterQuoteModel.count({ status: 'sent' });
    const acceptedQuotes = await TIWaterQuoteModel.count({ status: 'accepted' });
    const rejectedQuotes = await TIWaterQuoteModel.count({ status: 'rejected' });
    const expiredQuotes = await TIWaterQuoteModel.count({ status: 'expired' });

    res.status(200).json({
      total: totalQuotes,
      byStatus: {
        draft: draftQuotes,
        sent: sentQuotes,
        accepted: acceptedQuotes,
        rejected: rejectedQuotes,
        expired: expiredQuotes
      }
    });
  } catch (error) {
    console.error('Error fetching quote statistics:', error);
    res.status(500).json({ message: 'Error al obtener estadísticas', error: error.message });
  }
};

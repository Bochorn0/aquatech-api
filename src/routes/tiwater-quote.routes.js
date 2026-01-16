import { Router } from 'express';
import { 
  getQuotes, 
  getQuoteById, 
  createQuote, 
  updateQuote, 
  deleteQuote,
  getQuoteStats
} from '../controllers/tiwater-quote.controller.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware.js';
import { validateTiWaterApiKey } from '../middlewares/tiwater-api-key.middleware.js';

const router = Router();

// Protected route - Requires TI Water API Key for creating quotes
// Create new quote (customers can create quotes using API key)
router.post('/', validateTiWaterApiKey, createQuote);

// Protected routes - Authentication required for viewing/managing quotes
// Get all quotes (with optional filters) - requires auth
router.get('/', authenticate, getQuotes);

// Get quote statistics - requires auth
router.get('/stats', authenticate, getQuoteStats);

// Get specific quote by ID - requires auth
router.get('/:quoteId', authenticate, getQuoteById);

// Update specific quote by ID
router.patch('/:quoteId', authenticate, updateQuote);
router.put('/:quoteId', authenticate, updateQuote);

// Delete specific quote by ID (admin only)
router.delete('/:quoteId', authenticate, authorizeRoles('admin'), deleteQuote);

export default router;

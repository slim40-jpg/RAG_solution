import express from 'express';
import { searchDocuments, hybridSearch } from '../controllers/searchcontroller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Semantic search using vector embeddings
router.get('/', searchDocuments);

// Hybrid search (vector + keyword)
router.get('/hybrid', hybridSearch);

export default router;
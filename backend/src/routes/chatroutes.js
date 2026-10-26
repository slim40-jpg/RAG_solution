import express from 'express';
import { chat, chatStream } from '../controllers/chatController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Non-streaming chat
router.post('/', chat);

// Streaming chat (SSE)
router.post('/stream', chatStream);

export default router;
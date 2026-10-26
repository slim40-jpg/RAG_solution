import { ragService } from '../services/RAGservice.js';
import { ActivityLog } from '../models/index.js';

export const chat = async (req, res, next) => {
  try {
    const { question, departmentId, topK = 5 } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    // Build context based on user permissions
    const context = {};
    if (req.user.role === 'employee' && req.user.departmentId) {
      context.departmentId = req.user.departmentId;
    } else if (departmentId && req.user.role !== 'employee') {
      context.departmentId = departmentId;
    }

    // ✅ FIX: pass req.user to ragService.ask
    const result = await ragService.ask(question, context, topK, req.user);

    // Log activity
    await ActivityLog.create({
      userId: req.user.id,
      action: 'AI_CHAT_QUERY',
      entityType: 'chat',
      details: {
        question: question.substring(0, 100),
        sourceCount: result.sources?.length || 0
      }
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const chatStream = async (req, res, next) => {
  try {
    const { question, departmentId, topK = 5 } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    // Build context based on user permissions
    const context = {};
    if (req.user.role === 'employee' && req.user.departmentId) {
      context.departmentId = req.user.departmentId;
    } else if (departmentId && req.user.role !== 'employee') {
      context.departmentId = departmentId;
    }

    // ✅ FIX: pass req.user to ragService.ask
    const result = await ragService.ask(question, context, topK, req.user);

    // Log activity
    await ActivityLog.create({
      userId: req.user.id,
      action: 'AI_CHAT_STREAM',
      entityType: 'chat',
      details: {
        question: question.substring(0, 100),
        sourceCount: result.sources?.length || 0
      }
    });

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send sources first
    res.write(`data: ${JSON.stringify({ type: 'sources', sources: result.sources || [] })}\n\n`);

    // Simulate streaming by sending the answer word by word
    const words = (result.answer || '').split(' ');
    for (let i = 0; i < words.length; i++) {
      const chunk = words[i] + (i < words.length - 1 ? ' ' : '');
      res.write(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`);
      await new Promise(resolve => setTimeout(resolve, 30));
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();

  } catch (error) {
    console.error('❌ Chat stream error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
};
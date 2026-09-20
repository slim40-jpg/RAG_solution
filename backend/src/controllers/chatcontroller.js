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

    const result = await ragService.ask(question, context, topK);

    // Log activity
    await ActivityLog.create({
      userId: req.user.id,
      action: 'AI_CHAT_QUERY',
      entityType: 'chat',
      details: {
        question: question.substring(0, 100),
        sourceCount: result.sources.length
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

    const { stream, sources } = await ragService.askStream(question, context, topK);

    // Log activity
    await ActivityLog.create({
      userId: req.user.id,
      action: 'AI_CHAT_STREAM',
      entityType: 'chat',
      details: {
        question: question.substring(0, 100),
        sourceCount: sources.length
      }
    });

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // First, send sources
    res.write(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`);

    // Stream the response
    stream.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.response) {
              res.write(`data: ${JSON.stringify({ type: 'content', content: data.response })}\n\n`);
            }
          } catch (e) {
            console.error('Error parsing stream data:', e);
          }
        }
      }
    });

    stream.on('end', () => {
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    });

    stream.on('error', (error) => {
      console.error('Stream error:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    });

  } catch (error) {
    next(error);
  }
};
import express from 'express';
import { 
  uploadDocument, 
  getDocuments, 
  getDocumentById, 
  deleteDocument 
} from '../controllers/documentcontroller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { uploadMiddleware } from '../config/multer.js';

const router = express.Router();

router.use(authenticate);

router.post('/upload', uploadMiddleware, uploadDocument);
router.get('/', getDocuments);
router.get('/:id', getDocumentById);
router.delete('/:id', requireRole('admin', 'archivist'), deleteDocument);
router.post('/process-all', authenticate, requireRole('admin', 'archivist'), async (req, res) => {
  try {
    await documentProcessor.processAllPendingDocuments();
    res.json({ message: 'Document processing started' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
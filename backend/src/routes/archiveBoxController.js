import express from 'express';
import {
  getArchiveBoxes,
  getArchiveBoxById,
  createArchiveBox,
  updateArchiveBox,
  deleteArchiveBox,
  addDocumentToBox,
  removeDocumentFromBox
} from '../controllers/ArchiveBoxController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ✅ Public (authenticated users can view)
router.get('/', getArchiveBoxes);
router.get('/:id', getArchiveBoxById);

// ✅ Admin and Archivist only
router.post('/', requireRole('admin', 'archivist'), createArchiveBox);
router.put('/:id', requireRole('admin', 'archivist'), updateArchiveBox);
router.delete('/:id', requireRole('admin'), deleteArchiveBox);

// ✅ Document assignment
router.post('/assign', requireRole('admin', 'archivist'), addDocumentToBox);
router.delete('/:documentId/remove', requireRole('admin', 'archivist'), removeDocumentFromBox);

export default router;
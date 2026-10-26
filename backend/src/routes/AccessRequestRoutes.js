import express from 'express';
import {
  createAccessRequest,
  getMyRequests,
  getPendingRequestsForDepartment,
  approveRequest,
  rejectRequest,
  revokeAccess,
  getMyActiveAccess
} from '../controllers/AccessRequestController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// Demandeur
router.post('/', createAccessRequest);
router.get('/my-requests', getMyRequests);
router.get('/my-access', getMyActiveAccess);

// Validateur (admin / archivist)
router.get('/pending', requireRole('admin', 'archivist'), getPendingRequestsForDepartment);
router.put('/:id/approve', requireRole('admin', 'archivist'), approveRequest);
router.put('/:id/reject', requireRole('admin', 'archivist'), rejectRequest);
router.put('/:id/revoke', requireRole('admin', 'archivist'), revokeAccess);

export default router;
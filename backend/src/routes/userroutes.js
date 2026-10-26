import express from 'express';
import {
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  updateUserRole
} from '../controllers/usercontroller.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all users (admin only)
router.get('/', requireRole('admin'), getUsers);

// Get single user
router.get('/:id', getUserById);

// Update user (self or admin)
router.put('/:id', updateUser);

// Delete user (admin only)
router.delete('/:id', requireRole('admin'), deleteUser);

// Update user role (admin only)
router.put('/:id/role', requireRole('admin'), updateUserRole);

export default router;
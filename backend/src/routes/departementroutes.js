import express from 'express';
import {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment
} from '../controllers/departementcontroller.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
// router.use(authenticate);

// Get all departments (filtered by role)
router.get('/', getDepartments);

// Get single department
router.get('/:id', getDepartmentById);

// Admin only routes
router.post('/', requireRole('admin'), createDepartment);
router.put('/:id', requireRole('admin'), updateDepartment);
router.delete('/:id', requireRole('admin'), deleteDepartment);

export default router;
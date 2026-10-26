import { Department, Document, User } from '../models/index.js';
import { ActivityLog } from '../models/index.js';
import { Op } from 'sequelize';

// ✅ PUBLIC - No authentication required
export const getDepartments = async (req, res, next) => {
  try {
    // ✅ REMOVE all req.user checks - this is a public endpoint
    const departments = await Department.findAll({
      attributes: ['id', 'name', 'description', 'archiveLocation', 'created_at', 'updated_at'],
      order: [['name', 'ASC']]
    });

    // Count documents and users for each department
    const departmentsWithCount = await Promise.all(departments.map(async (dept) => {
      const docCount = await Document.count({ 
        where: { departmentId: dept.id } 
      });
      const userCount = await User.count({ 
        where: { departmentId: dept.id } 
      });
      
      return {
        ...dept.toJSON(),
        documentCount: docCount,
        userCount: userCount
      };
    }));

    res.json({ departments: departmentsWithCount });
  } catch (error) {
    next(error);
  }
};

// ✅ PUBLIC - No authentication required
export const getDepartmentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // ✅ REMOVE authentication check - this is a public endpoint
    // Just get the department with basic info
    const department = await Department.findByPk(id, {
      attributes: ['id', 'name', 'description', 'archiveLocation', 'created_at', 'updated_at']
    });

    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    const docCount = await Document.count({ where: { departmentId: id } });
    const userCount = await User.count({ where: { departmentId: id } });
    
    // Get recent documents (only public info)
    const recentDocs = await Document.findAll({
      where: { departmentId: id },
      limit: 5,
      order: [['created_at', 'DESC']],
      attributes: ['id', 'title', 'fileName', 'created_at', 'fileType', 'status']
    });

    res.json({
      department,
      documentCount: docCount,
      userCount: userCount,
      recentDocuments: recentDocs
    });
  } catch (error) {
    next(error);
  }
};

// ✅ PROTECTED - Admin only
export const createDepartment = async (req, res, next) => {
  try {
    // ✅ req.user IS defined here because of authentication middleware
    const { name, description, archiveLocation } = req.body;

    const existing = await Department.findOne({ where: { name } });
    if (existing) {
      return res.status(409).json({ error: 'Department already exists' });
    }

    const department = await Department.create({
      name,
      description,
      archiveLocation
    });

    await ActivityLog.create({
      userId: req.user.id,
      action: 'DEPARTMENT_CREATED',
      entityType: 'department',
      entityId: department.id,
      details: { name, description }
    });

    res.status(201).json({
      message: 'Department created successfully',
      department
    });
  } catch (error) {
    next(error);
  }
};

// ✅ PROTECTED - Admin only
export const updateDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, archiveLocation } = req.body;

    const department = await Department.findByPk(id);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    if (name && name !== department.name) {
      const existing = await Department.findOne({ where: { name } });
      if (existing) {
        return res.status(409).json({ error: 'Department name already exists' });
      }
    }

    await department.update({
      name: name || department.name,
      description: description || department.description,
      archiveLocation: archiveLocation || department.archiveLocation
    });

    await ActivityLog.create({
      userId: req.user.id,
      action: 'DEPARTMENT_UPDATED',
      entityType: 'department',
      entityId: department.id,
      details: { name, description }
    });

    res.json({
      message: 'Department updated successfully',
      department
    });
  } catch (error) {
    next(error);
  }
};

// ✅ PROTECTED - Admin only
export const deleteDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const department = await Department.findByPk(id);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    const docCount = await Document.count({ where: { departmentId: id } });
    const userCount = await User.count({ where: { departmentId: id } });

    if (docCount > 0 || userCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete department with associated documents or users' 
      });
    }

    await department.destroy();

    await ActivityLog.create({
      userId: req.user.id,
      action: 'DEPARTMENT_DELETED',
      entityType: 'department',
      entityId: id,
      details: { name: department.name }
    });

    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    next(error);
  }
};
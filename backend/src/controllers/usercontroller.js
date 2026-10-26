import { User, Department, ActivityLog } from '../models/index.js';
import { Op } from 'sequelize';

export const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, departmentId } = req.query;

    const where = {};
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }
    if (departmentId) {
      where.departmentId = departmentId;
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['passwordHash'] },
      include: [
        { model: Department, attributes: ['id', 'name'] }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    res.json({
      users: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check permissions
    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await User.findByPk(id, {
      attributes: { exclude: ['passwordHash'] },
      include: [
        { model: Department, attributes: ['id', 'name'] }
      ]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, departmentId, password } = req.body;

    // Check permissions
    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check email uniqueness
    if (email && email !== user.email) {
      const existing = await User.findOne({ where: { email } });
      if (existing) {
        return res.status(409).json({ error: 'Email already in use' });
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (departmentId !== undefined) updateData.departmentId = departmentId;
    
    // Update password if provided
    if (password) {
      updateData.passwordHash = await User.hashPassword(password);
    }

    await user.update(updateData);

    // Log activity
    await ActivityLog.create({
      userId: req.user.id,
      action: 'USER_UPDATED',
      entityType: 'user',
      entityId: user.id,
      details: { name, email, departmentId }
    });

    const updatedUser = await User.findByPk(id, {
      attributes: { exclude: ['passwordHash'] },
      include: [{ model: Department, attributes: ['id', 'name'] }]
    });

    res.json({
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (req.user.id === id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await user.destroy();

    // Log activity
    await ActivityLog.create({
      userId: req.user.id,
      action: 'USER_DELETED',
      entityType: 'user',
      entityId: id,
      details: { email: user.email }
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'archivist', 'employee'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent changing own role
    if (req.user.id === id) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    await user.update({ role });

    // Log activity
    await ActivityLog.create({
      userId: req.user.id,
      action: 'USER_ROLE_CHANGED',
      entityType: 'user',
      entityId: user.id,
      details: { role }
    });

    res.json({
      message: 'User role updated successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};
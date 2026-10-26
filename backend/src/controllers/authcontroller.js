import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { ActivityLog } from '../models/index.js';

const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};

export const register = async (req, res, next) => {
  try {
    const { email, password, name, role, departmentId } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await User.hashPassword(password);

    // Create user
    const user = await User.create({
      email,
      passwordHash,
      name,
      role: role || 'employee',
      departmentId
    });

    // Log activity
    await ActivityLog.create({
      userId: user.id,
      action: 'USER_REGISTERED',
      entityType: 'user',
      entityId: user.id,
      details: { email: user.email, role: user.role }
    });

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        departmentId: user.departmentId
      }
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is disabled' });
    }

    // Log activity
    await ActivityLog.create({
      userId: user.id,
      action: 'USER_LOGIN',
      entityType: 'user',
      entityId: user.id,
      details: { 
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    // Generate token
    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        departmentId: user.departmentId
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      departmentId: req.user.departmentId
    }
  });
};

export const logout = async (req, res) => {
  // With JWT, logout is client-side
  // But we log the activity
  await ActivityLog.create({
    userId: req.user.id,
    action: 'USER_LOGOUT',
    entityType: 'user',
    entityId: req.user.id
  });
  
  res.json({ message: 'Logout successful' });
};
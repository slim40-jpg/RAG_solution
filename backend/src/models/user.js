import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import bcrypt from 'bcryptjs';

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  passwordHash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'password_hash'
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('admin', 'archivist', 'employee'),
    allowNull: false,
    defaultValue: 'employee'
  },
  departmentId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'department_id',
    references: {
      model: 'departments',
      key: 'id'
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Instance method to check password
User.prototype.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.passwordHash);
};

// Static method to hash password
User.hashPassword = async function(password) {
  return await bcrypt.hash(password, 10);
};

export default User;
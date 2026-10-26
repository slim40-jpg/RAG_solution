import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Department = sequelize.define('Department', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  archiveLocation: {
    type: DataTypes.STRING(255),
    field: 'archive_location'
  }
}, {
  tableName: 'departments',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default Department;
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ArchiveBox = sequelize.define('ArchiveBox', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  shelfNumber: {
    type: DataTypes.STRING(50),
    field: 'shelf_number'
  },
  rowNumber: {
    type: DataTypes.STRING(50),
    field: 'row_number'
  },
  boxNumber: {
    type: DataTypes.STRING(50),
    field: 'box_number'
  },
  description: {
    type: DataTypes.TEXT
  },
  departmentId: {
    type: DataTypes.UUID,
    field: 'department_id',
    references: {
      model: 'departments',
      key: 'id'
    }
  },
  documentCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'document_count'
  }
}, {
  tableName: 'archive_boxes',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default ArchiveBox;
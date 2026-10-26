import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AccessRequest = sequelize.define('AccessRequest', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  requesterId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'requester_id',
    references: { model: 'users', key: 'id' }
  },
  documentId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'document_id',
    references: { model: 'documents', key: 'id' }
  },
  targetDepartmentId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'target_department_id',
    references: { model: 'departments', key: 'id' }
  },
  // ✅ CORRECTION : STRING au lieu de ENUM
  status: {
    type: DataTypes.STRING(50),
    defaultValue: 'pending'
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  reviewedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'reviewed_by',
    references: { model: 'users', key: 'id' }
  },
  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'reviewed_at'
  },
  accessToken: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'access_token'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'expires_at'
  },
  reviewComment: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'review_comment'
  }
}, {
  tableName: 'access_requests',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  underscored: true
});

export default AccessRequest;
import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Document = sequelize.define('Document', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  fileName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'file_name'
  },
  filePath: {
    type: DataTypes.STRING(500),
    allowNull: false,
    field: 'file_path'
  },
  fileType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'file_type'
  },
  fileSize: {
    type: DataTypes.BIGINT,
    allowNull: false,
    field: 'file_size'
  },
  mimeType: {
    type: DataTypes.STRING(100),
    field: 'mime_type'
  },
  ocrText: {
    type: DataTypes.TEXT,
    field: 'ocr_text'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
    defaultValue: 'pending'
  },
  visibility: {
    type: DataTypes.ENUM('public', 'private'),
    defaultValue: 'private',
    field: 'visibility'
  },
  departmentId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'department_id'
  },
  uploadedBy: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'uploaded_by'
  },
  archiveLocation: {
    type: DataTypes.STRING(255),
    field: 'archive_location'
  },
  archiveBoxId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'archive_box_id',
    references: {
      model: 'archive_boxes',
      key: 'id'
    }
  },
  processedAt: {
    type: DataTypes.DATE,
    field: 'processed_at'
  },
  documentType: {
  type: DataTypes.ENUM('facture', 'bon_commande', 'cahier_charges', 'lettre', 'contrat', 'rapport', 'autre'),
  defaultValue: 'autre',
  field: 'document_type'
}
}, {
  tableName: 'documents',
  timestamps: true,
  createdAt: 'created_at',  
  updatedAt: 'updated_at',
  underscored: true          
});

export default Document;
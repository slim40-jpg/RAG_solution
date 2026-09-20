import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const DocumentChunk = sequelize.define('DocumentChunk', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  documentId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'document_id',
    references: {
      model: 'documents',
      key: 'id'
    }
  },
  chunkIndex: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'chunk_index'
  },
  chunkText: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'chunk_text'
  },
  chunkMetadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    field: 'chunk_metadata'
  },
  qdrantPointId: {
    type: DataTypes.UUID,
    field: 'qdrant_point_id'
  },
  embedding: {
    type: DataTypes.ARRAY(DataTypes.FLOAT),
    allowNull: true
  }
}, {
  tableName: 'document_chunks',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default DocumentChunk;
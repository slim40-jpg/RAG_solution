import User from './User.js';
import Department from './Department.js';
import Document from './Document.js';
import DocumentChunk from './DocumentChunk.js';
import ActivityLog from './ActivityLog.js';
import ArchiveBox from './BoiteArchive.js';
// Define associations
User.belongsTo(Department, { foreignKey: 'departmentId' });
Department.hasMany(User, { foreignKey: 'departmentId' });

Document.belongsTo(Department, { foreignKey: 'departmentId' , as: 'department' });
Department.hasMany(Document, { foreignKey: 'departmentId' });

Document.belongsTo(User, { foreignKey: 'uploadedBy', as: 'uploader' });
User.hasMany(Document, { foreignKey: 'uploadedBy' });

Document.hasMany(DocumentChunk, { foreignKey: 'documentId' });
DocumentChunk.belongsTo(Document, { foreignKey: 'documentId' });

Document.belongsTo(ArchiveBox, { foreignKey: 'archiveBoxId', as: 'archiveBox' });
ArchiveBox.hasMany(Document, { foreignKey: 'archiveBoxId', as: 'documents' });

ArchiveBox.belongsTo(Department, { foreignKey: 'departmentId', as: 'department' });
Department.hasMany(ArchiveBox, { foreignKey: 'departmentId', as: 'archiveBoxes' });

ActivityLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(ActivityLog, { foreignKey: 'userId', as: 'activities' });

ActivityLog.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(ActivityLog, { foreignKey: 'userId' });

export {
  User,
  Department,
  Document,
  DocumentChunk,
  ActivityLog,
  ArchiveBox
};
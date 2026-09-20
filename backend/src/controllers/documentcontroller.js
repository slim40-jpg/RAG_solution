import { Op } from 'sequelize';
import { Document, DocumentChunk, ActivityLog } from '../models/index.js';
import { storageService } from '../services/storageservice.js';
import { ocrService } from '../services/OCRservice.js';
import { embeddingService } from '../services/embeddingservice.js';
import { documentProcessor } from '../services/documentprocess.js';
import { chunkText } from '../services/embeddingservice.js';

// ✅ Upload document avec visibility
export const uploadDocument = async (req, res, next) => {
  try {
    const { 
      title, 
      departmentId, 
      archiveBoxId,
      documentType,
      author,
      documentDate,
      reference,
      client,
      amount,
      description,
      visibility, // ✅ NOUVEAU
      metadata 
    } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // ✅ Si l'utilisateur est un employé, le document est automatiquement privé
    let finalVisibility = visibility || 'private';
    if (req.user.role === 'employee') {
      finalVisibility = 'private';
    }

    // ✅ Si l'utilisateur est admin ou archivist, il peut choisir
    if (req.user.role === 'admin' || req.user.role === 'archivist') {
      finalVisibility = visibility || 'private';
    }

    // Save document metadata
    const document = await Document.create({
      title: title || req.file.originalname,
      fileName: req.file.filename,
      filePath: req.file.path,
      fileType: storageService.getFileType(req.file.mimetype),
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      departmentId: departmentId || null,
      archiveBoxId: archiveBoxId || null,
      uploadedBy: req.user.id,
      status: 'pending',
      documentType: documentType || 'autre',
      visibility: finalVisibility, // ✅ NOUVEAU
      author: author || '',
      documentDate: documentDate || null,
      reference: reference || '',
      client: client || '',
      amount: amount || null,
      description: description || '',
      metadata: {
        ...(metadata ? JSON.parse(metadata) : {}),
        visibility: finalVisibility,
        documentType: documentType || 'autre',
        author: author || '',
        documentDate: documentDate || null,
        reference: reference || '',
        client: client || '',
        amount: amount || null,
        description: description || ''
      }
    });

    // Log activity
    await ActivityLog.create({
      userId: req.user.id,
      action: 'DOCUMENT_UPLOADED',
      entityType: 'document',
      entityId: document.id,
      details: { 
        fileName: req.file.originalname,
        fileSize: req.file.size,
        departmentId,
        archiveBoxId,
        documentType,
        visibility: finalVisibility
      }
    });

    // Process document asynchronously
    documentProcessor.processAllPendingDocuments().catch(console.error);

    res.status(201).json({
      message: 'Document uploaded successfully',
      document: {
        id: document.id,
        title: document.title,
        status: document.status,
        documentType: document.documentType,
        visibility: document.visibility
      }
    });
  } catch (error) {
    next(error);
  }
};

// ✅ Get documents avec filtrage par permissions
export const getDocuments = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      departmentId,
      documentType,
      status,
      search,
      visibility 
    } = req.query;

    const where = {};
    const user = req.user;

    // ✅ Gestion des permissions
    if (user.role === 'admin') {
      // Admin voit tout
      if (departmentId) where.departmentId = departmentId;
    } else if (user.role === 'archivist') {
      // Archivist voit tout
      if (departmentId) where.departmentId = departmentId;
    } else if (user.role === 'employee') {
      // Employee voit:
      // 1. Les documents de son département
      // 2. Les documents publics des autres départements
      where[Op.or] = [
        { departmentId: user.departmentId },
        { visibility: 'public' }
      ];
      // Ne pas filtrer par departmentId si c'est un employee
    }

    if (documentType) where.documentType = documentType;
    if (status) where.status = status;
    if (visibility) where.visibility = visibility;

    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { fileName: { [Op.iLike]: `%${search}%` } },
        { ocrText: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Document.findAndCountAll({
      where,
      include: [
        { association: 'uploader', attributes: ['id', 'name', 'email'] },
        { association: 'department', attributes: ['id', 'name'] },
        { association: 'archiveBox', attributes: ['id', 'name', 'code'] }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    });

    res.json({
      documents: rows,
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

// ✅ Get document by ID avec vérification des permissions
export const getDocumentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const document = await Document.findByPk(id, {
      include: [
        { association: 'uploader', attributes: ['id', 'name', 'email'] },
        { association: 'department', attributes: ['id', 'name'] },
        { association: 'archiveBox', attributes: ['id', 'name', 'code'] },
        { association: 'chunks', attributes: ['id', 'chunkIndex', 'chunkText', 'createdAt'] }
      ]
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const user = req.user;

    // ✅ Vérification des permissions
    if (user.role === 'admin' || user.role === 'archivist') {
      // Admin et archivist voient tout
      // Continuer
    } else if (user.role === 'employee') {
      // Employee voit:
      // 1. Documents de son département
      // 2. Documents publics
      if (document.departmentId !== user.departmentId && document.visibility !== 'public') {
        return res.status(403).json({ 
          error: 'Accès refusé. Ce document est privé et n\'appartient pas à votre département.',
          code: 'ACCESS_DENIED'
        });
      }
    }

    // Log access
    await ActivityLog.create({
      userId: req.user.id,
      action: 'DOCUMENT_VIEWED',
      entityType: 'document',
      entityId: document.id,
      details: { 
        title: document.title,
        visibility: document.visibility
      }
    });

    res.json({ document });
  } catch (error) {
    next(error);
  }
};

// ✅ Delete document avec vérification des permissions
export const deleteDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const document = await Document.findByPk(id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const user = req.user;

    // ✅ Vérification des permissions
    if (user.role === 'admin') {
      // Admin peut tout supprimer
    } else if (user.role === 'archivist') {
      // Archivist peut tout supprimer
    } else if (user.role === 'employee') {
      // Employee ne peut supprimer que les documents de son département
      if (document.departmentId !== user.departmentId) {
        return res.status(403).json({ 
          error: 'Accès refusé. Vous ne pouvez supprimer que les documents de votre département.',
          code: 'ACCESS_DENIED'
        });
      }
    }

    // Delete file from storage
    await storageService.deleteFile(document.filePath);

    // Delete document chunks and embeddings
    await DocumentChunk.destroy({ where: { documentId: id } });

    // Delete document
    await document.destroy();

    // Log activity
    await ActivityLog.create({
      userId: req.user.id,
      action: 'DOCUMENT_DELETED',
      entityType: 'document',
      entityId: id,
      details: { 
        fileName: document.fileName,
        title: document.title
      }
    });

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ✅ Update document (admin/archivist only)
export const updateDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { 
      title, 
      departmentId, 
      archiveBoxId,
      documentType,
      author,
      documentDate,
      reference,
      client,
      amount,
      description,
      visibility,
      status
    } = req.body;

    const document = await Document.findByPk(id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // ✅ Seuls admin et archivist peuvent modifier
    if (req.user.role === 'employee') {
      return res.status(403).json({ 
        error: 'Accès refusé. Vous ne pouvez pas modifier les documents.',
        code: 'ACCESS_DENIED'
      });
    }

    // Mise à jour
    await document.update({
      title: title || document.title,
      departmentId: departmentId !== undefined ? departmentId : document.departmentId,
      archiveBoxId: archiveBoxId !== undefined ? archiveBoxId : document.archiveBoxId,
      documentType: documentType || document.documentType,
      author: author !== undefined ? author : document.author,
      documentDate: documentDate !== undefined ? documentDate : document.documentDate,
      reference: reference !== undefined ? reference : document.reference,
      client: client !== undefined ? client : document.client,
      amount: amount !== undefined ? amount : document.amount,
      description: description !== undefined ? description : document.description,
      visibility: visibility || document.visibility,
      status: status || document.status
    });

    await ActivityLog.create({
      userId: req.user.id,
      action: 'DOCUMENT_UPDATED',
      entityType: 'document',
      entityId: document.id,
      details: { 
        title,
        visibility,
        documentType
      }
    });

    res.json({
      message: 'Document updated successfully',
      document
    });
  } catch (error) {
    next(error);
  }
};

// ✅ Update document visibility (admin/archivist only)
export const updateDocumentVisibility = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { visibility } = req.body;

    if (!['public', 'private'].includes(visibility)) {
      return res.status(400).json({ error: 'Visibility must be "public" or "private"' });
    }

    const document = await Document.findByPk(id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // ✅ Seuls admin et archivist peuvent changer la visibilité
    if (req.user.role === 'employee') {
      return res.status(403).json({ 
        error: 'Accès refusé. Vous ne pouvez pas changer la visibilité des documents.',
        code: 'ACCESS_DENIED'
      });
    }

    await document.update({ visibility });

    await ActivityLog.create({
      userId: req.user.id,
      action: 'DOCUMENT_VISIBILITY_CHANGED',
      entityType: 'document',
      entityId: document.id,
      details: { 
        visibility,
        title: document.title
      }
    });

    res.json({
      message: `Document visibility changed to ${visibility}`,
      document: {
        id: document.id,
        title: document.title,
        visibility: document.visibility
      }
    });
  } catch (error) {
    next(error);
  }
};

// ✅ Process document (existant)
export const processDocument = async (documentId) => {
  try {
    const document = await Document.findByPk(documentId);
    if (!document) return;

    await document.update({ status: 'processing' });

    // 1. OCR Processing
    if (document.fileType === 'image' || document.mimeType === 'application/pdf') {
      const ocrText = await ocrService.extractText(document.filePath);
      await document.update({ ocrText });
    }

    // 2. Text chunking
    const text = document.ocrText || await extractTextFromFile(document);
    const chunks = chunkText(text, 500);

    // 3. Generate embeddings and store in Qdrant
    const chunksWithEmbeddings = await embeddingService.generateAndStore(
      chunks,
      document.id,
      document.metadata
    );

    // 4. Save chunks to database
    for (const [index, chunk] of chunksWithEmbeddings.entries()) {
      await DocumentChunk.create({
        documentId: document.id,
        chunkIndex: index,
        chunkText: chunk.text,
        chunkMetadata: chunk.metadata,
        qdrantPointId: chunk.qdrantPointId,
        embedding: chunk.embedding
      });
    }

    // 5. Update document status
    await document.update({ 
      status: 'completed',
      processedAt: new Date()
    });

    console.log(`Document ${documentId} processed successfully`);
  } catch (error) {
    console.error(`Error processing document ${documentId}:`, error);
    await Document.update(
      { status: 'failed' },
      { where: { id: documentId } }
    );
  }
};

// ✅ Helper function
const extractTextFromFile = async (document) => {
  // Pour les fichiers Word, Excel, etc.
  console.log('📄 No text extraction available for this file type');
  return '';
};
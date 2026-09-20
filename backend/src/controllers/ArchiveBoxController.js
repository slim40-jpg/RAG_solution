import { ArchiveBox, Document, Department } from '../models/index.js';
import { ActivityLog } from '../models/index.js';
import { Op } from 'sequelize';

// ✅ Get all archive boxes
export const getArchiveBoxes = async (req, res, next) => {
  try {
    const boxes = await ArchiveBox.findAll({
      include: [
        { model: Department, as: 'department', attributes: ['id', 'name'] }
      ],
      order: [['name', 'ASC']]
    });

    // Get document count for each box
    const boxesWithCount = await Promise.all(boxes.map(async (box) => {
      const docCount = await Document.count({
        where: { archiveBoxId: box.id }
      });
      return {
        ...box.toJSON(),
        documentCount: docCount
      };
    }));

    res.json({ archiveBoxes: boxesWithCount });
  } catch (error) {
    next(error);
  }
};

// ✅ Get single archive box
export const getArchiveBoxById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const box = await ArchiveBox.findByPk(id, {
      include: [
        { model: Department, as: 'department', attributes: ['id', 'name'] },
        { 
          model: Document, 
          as: 'documents',
          attributes: ['id', 'title', 'fileName', 'created_at' , 'fileType', 'status'],
          limit: 10,
          order: [['created_at', 'DESC']]
        }
      ]
    });

    if (!box) {
      return res.status(404).json({ error: 'Archive box not found' });
    }

    const docCount = await Document.count({
      where: { archiveBoxId: id }
    });

    res.json({
      archiveBox: box,
      documentCount: docCount
    });
  } catch (error) {
    next(error);
  }
};

// ✅ Create archive box
export const createArchiveBox = async (req, res, next) => {
  try {
    const { 
      name, 
      code, 
      shelfNumber, 
      rowNumber, 
      boxNumber, 
      description, 
      departmentId,
      maxCapacity 
    } = req.body;

    // Check if code already exists
    const existing = await ArchiveBox.findOne({ where: { code } });
    if (existing) {
      return res.status(409).json({ error: 'Archive box code already exists' });
    }

    const box = await ArchiveBox.create({
      name,
      code,
      shelfNumber,
      rowNumber,
      boxNumber,
      description,
      departmentId: departmentId || null,
      maxCapacity: maxCapacity || 100
    });

    await ActivityLog.create({
      userId: req.user.id,
      action: 'ARCHIVE_BOX_CREATED',
      entityType: 'archiveBox',
      entityId: box.id,
      details: { name, code }
    });

    res.status(201).json({
      message: 'Archive box created successfully',
      archiveBox: box
    });
  } catch (error) {
    next(error);
  }
};

// ✅ Update archive box
export const updateArchiveBox = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, shelfNumber, rowNumber, boxNumber, description, departmentId, maxCapacity } = req.body;

    const box = await ArchiveBox.findByPk(id);
    if (!box) {
      return res.status(404).json({ error: 'Archive box not found' });
    }

    if (code && code !== box.code) {
      const existing = await ArchiveBox.findOne({ where: { code } });
      if (existing) {
        return res.status(409).json({ error: 'Code already exists' });
      }
    }

    await box.update({
      name: name || box.name,
      code: code || box.code,
      shelfNumber: shelfNumber || box.shelfNumber,
      rowNumber: rowNumber || box.rowNumber,
      boxNumber: boxNumber || box.boxNumber,
      description: description || box.description,
      departmentId: departmentId !== undefined ? departmentId : box.departmentId,
      maxCapacity: maxCapacity || box.maxCapacity
    });

    await ActivityLog.create({
      userId: req.user.id,
      action: 'ARCHIVE_BOX_UPDATED',
      entityType: 'archiveBox',
      entityId: box.id,
      details: { name, code }
    });

    res.json({
      message: 'Archive box updated successfully',
      archiveBox: box
    });
  } catch (error) {
    next(error);
  }
};

// ✅ Delete archive box
export const deleteArchiveBox = async (req, res, next) => {
  try {
    const { id } = req.params;

    const box = await ArchiveBox.findByPk(id);
    if (!box) {
      return res.status(404).json({ error: 'Archive box not found' });
    }

    // Check if it has documents
    const docCount = await Document.count({ where: { archiveBoxId: id } });
    if (docCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete box with ${docCount} documents. Move documents first.` 
      });
    }

    await box.destroy();

    await ActivityLog.create({
      userId: req.user.id,
      action: 'ARCHIVE_BOX_DELETED',
      entityType: 'archiveBox',
      entityId: id,
      details: { name: box.name }
    });

    res.json({ message: 'Archive box deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ✅ Add document to archive box
export const addDocumentToBox = async (req, res, next) => {
  try {
    const { documentId, archiveBoxId } = req.body;

    const document = await Document.findByPk(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const box = await ArchiveBox.findByPk(archiveBoxId);
    if (!box) {
      return res.status(404).json({ error: 'Archive box not found' });
    }

    // Check if box is full
    const docCount = await Document.count({ where: { archiveBoxId } });
    if (docCount >= box.maxCapacity) {
      return res.status(400).json({ error: 'Archive box is full' });
    }

    await document.update({ archiveBoxId });

    // Update document count on box
    await box.update({ documentCount: docCount + 1 });

    await ActivityLog.create({
      userId: req.user.id,
      action: 'DOCUMENT_ADDED_TO_BOX',
      entityType: 'document',
      entityId: document.id,
      details: { documentTitle: document.title, boxName: box.name }
    });

    res.json({ 
      message: 'Document added to archive box successfully',
      document,
      box
    });
  } catch (error) {
    next(error);
  }
};

// ✅ Remove document from archive box
export const removeDocumentFromBox = async (req, res, next) => {
  try {
    const { documentId } = req.params;

    const document = await Document.findByPk(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const boxId = document.archiveBoxId;
    await document.update({ archiveBoxId: null });

    if (boxId) {
      const box = await ArchiveBox.findByPk(boxId);
      if (box) {
        const docCount = await Document.count({ where: { archiveBoxId: boxId } });
        await box.update({ documentCount: docCount });
      }
    }

    await ActivityLog.create({
      userId: req.user.id,
      action: 'DOCUMENT_REMOVED_FROM_BOX',
      entityType: 'document',
      entityId: document.id,
      details: { documentTitle: document.title }
    });

    res.json({ message: 'Document removed from archive box successfully' });
  } catch (error) {
    next(error);
  }
};
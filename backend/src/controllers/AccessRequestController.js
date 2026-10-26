import crypto from 'crypto';
import { AccessRequest, Document, User, Department, ActivityLog } from '../models/index.js';
import { Op } from 'sequelize';

// ============================================
// 1. CRÉER UNE DEMANDE D'ACCÈS
// ============================================
export const createAccessRequest = async (req, res, next) => {
  try {
    const { documentId, reason } = req.body;
    const requesterId = req.user.id;

    // Vérifier le document
    const document = await Document.findByPk(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document introuvable' });
    }

    // Vérifier qu'il n'y a pas déjà une demande en attente
    const existing = await AccessRequest.findOne({
      where: {
        requesterId,
        documentId,
        status: 'pending'
      }
    });

    if (existing) {
      return res.status(409).json({
        error: 'Une demande est déjà en attente pour ce document',
        requestId: existing.id
      });
    }

    // Créer la demande
    const request = await AccessRequest.create({
      requesterId,
      documentId,
      targetDepartmentId: document.departmentId,
      reason: reason || 'Demande d\'accès pour consultation',
      status: 'pending'
    });

    // Log
    await ActivityLog.create({
      userId: requesterId,
      action: 'ACCESS_REQUEST_CREATED',
      entityType: 'access_request',
      entityId: request.id,
      details: { documentId, documentTitle: document.title }
    });

    res.status(201).json({
      message: 'Demande d\'accès créée. En attente de validation.',
      request: {
        id: request.id,
        documentId: request.documentId,
        status: request.status,
        createdAt: request.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// 2. LISTER MES DEMANDES
// ============================================
export const getMyRequests = async (req, res, next) => {
  try {
    const requests = await AccessRequest.findAll({
      where: { requesterId: req.user.id },
      include: [
        { model: Document, as: 'document', attributes: ['id', 'title', 'fileName', 'departmentId'] },
        { model: Department, as: 'targetDepartment', attributes: ['id', 'name'] }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({ requests });
  } catch (error) {
    next(error);
  }
};

// ============================================
// 3. LISTER LES DEMANDES À VALIDER (pour un département)
// ============================================
export const getPendingRequestsForDepartment = async (req, res, next) => {
  try {
    // Seuls admin et archivist peuvent valider
    if (!['admin', 'archivist'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const where = { status: 'pending' };

    // Un archivist ne voit que son département
    if (req.user.role === 'archivist') {
      where.targetDepartmentId = req.user.departmentId;
    }

    const requests = await AccessRequest.findAll({
      where,
      include: [
        { model: Document, as: 'document', attributes: ['id', 'title', 'fileName'] },
        { model: User, as: 'requester', attributes: ['id', 'name', 'email', 'role'] },
        { model: Department, as: 'targetDepartment', attributes: ['id', 'name'] }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({ requests });
  } catch (error) {
    next(error);
  }
};

// ============================================
// 4. APPROUVER UNE DEMANDE (génère le token)
// ============================================
export const approveRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reviewComment, expiresInDays = 30 } = req.body;

    const request = await AccessRequest.findByPk(id, {
      include: [{ model: Document, as: 'document' }]
    });

    if (!request) {
      return res.status(404).json({ error: 'Demande introuvable' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Demande déjà traitée' });
    }

    // Vérifier les permissions
    if (req.user.role === 'archivist' && request.targetDepartmentId !== req.user.departmentId) {
      return res.status(403).json({ error: 'Vous ne pouvez valider que les demandes de votre département' });
    }

    // Générer un token unique
    const accessToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Mettre à jour
    await request.update({
      status: 'approved',
      reviewedBy: req.user.id,
      reviewedAt: new Date(),
      reviewComment: reviewComment || 'Approuvé',
      accessToken,
      expiresAt
    });

    // Log
    await ActivityLog.create({
      userId: req.user.id,
      action: 'ACCESS_REQUEST_APPROVED',
      entityType: 'access_request',
      entityId: request.id,
      details: {
        documentTitle: request.document?.title,
        requesterId: request.requesterId,
        expiresAt
      }
    });

    res.json({
      message: 'Demande approuvée',
      request: {
        id: request.id,
        status: request.status,
        accessToken,
        expiresAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// 5. REJETER UNE DEMANDE
// ============================================
export const rejectRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reviewComment } = req.body;

    const request = await AccessRequest.findByPk(id);
    if (!request) {
      return res.status(404).json({ error: 'Demande introuvable' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Demande déjà traitée' });
    }

    if (req.user.role === 'archivist' && request.targetDepartmentId !== req.user.departmentId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    await request.update({
      status: 'rejected',
      reviewedBy: req.user.id,
      reviewedAt: new Date(),
      reviewComment: reviewComment || 'Rejeté'
    });

    await ActivityLog.create({
      userId: req.user.id,
      action: 'ACCESS_REQUEST_REJECTED',
      entityType: 'access_request',
      entityId: request.id,
      details: { reviewComment }
    });

    res.json({ message: 'Demande rejetée', request });
  } catch (error) {
    next(error);
  }
};

// ============================================
// 6. RÉVOQUER UN TOKEN
// ============================================
export const revokeAccess = async (req, res, next) => {
  try {
    const { id } = req.params;

    const request = await AccessRequest.findByPk(id);
    if (!request) {
      return res.status(404).json({ error: 'Demande introuvable' });
    }

    if (request.status !== 'approved') {
      return res.status(400).json({ error: 'Aucun accès actif à révoquer' });
    }

    await request.update({
      status: 'revoked',
      accessToken: null,
      reviewedAt: new Date()
    });

    await ActivityLog.create({
      userId: req.user.id,
      action: 'ACCESS_REVOKED',
      entityType: 'access_request',
      entityId: request.id
    });

    res.json({ message: 'Accès révoqué' });
  } catch (error) {
    next(error);
  }
};

// ============================================
// 7. VÉRIFIER SI UN UTILISATEUR A ACCÈS À UN DOC
// ============================================
export const hasAccessToDocument = async (userId, documentId) => {
  try {
    // Chercher une demande approuvée et non expirée
    const access = await AccessRequest.findOne({
      where: {
        requesterId: userId,
        documentId,
        status: 'approved',
        expiresAt: { [Op.gt]: new Date() }
      }
    });

    return !!access;
  } catch (error) {
    console.error('Error checking access:', error);
    return false;
  }
};

// ============================================
// 8. LISTER TOUS LES ACCÈS ACTIFS D'UN UTILISATEUR
// ============================================
export const getMyActiveAccess = async (req, res, next) => {
  try {
    const accesses = await AccessRequest.findAll({
      where: {
        requesterId: req.user.id,
        status: 'approved',
        expiresAt: { [Op.gt]: new Date() }
      },
      include: [
        { model: Document, as: 'document', attributes: ['id', 'title', 'departmentId'] },
        { model: Department, as: 'targetDepartment', attributes: ['id', 'name'] }
      ]
    });

    res.json({ accesses });
  } catch (error) {
    next(error);
  }
};
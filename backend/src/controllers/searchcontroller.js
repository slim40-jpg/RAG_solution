import { embeddingService } from '../services/embeddingService.js';
import { Document, Department } from '../models/index.js';
import { Op } from 'sequelize';

export const searchDocuments = async (req, res, next) => {
  try {
    const { 
      query, 
      departmentId, 
      limit = 10,
      minScore = 0.5 
    } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Build filter based on user permissions
    const filter = {};
    if (req.user.role === 'employee') {
      filter.departmentId = req.user.departmentId;
    } else if (departmentId) {
      filter.departmentId = departmentId;
    }

    // Perform vector search
    const results = await embeddingService.search(
      query,
      parseInt(limit),
      filter
    );

    const filteredResults = results.filter(r => r.score >= parseFloat(minScore))
    const documentIds = [...new Set(filteredResults.map(r => r.documentId))];
    const documents = await Document.findAll({
      where: { id: documentIds },
      include: [
        { 
          association: 'department', 
          attributes: ['id', 'name'] 
        },
        { 
          association: 'uploader',   
          attributes: ['id', 'name'] 
        }
      ],
      attributes: ['id', 'title', 'fileName', 'fileType', 'fileSize']
    });

    const documentMap = documents.reduce((acc, doc) => {
      acc[doc.id] = doc;
      return acc;
    }, {});

    const formattedResults = filteredResults.map(result => ({
      id: result.id,
      document: documentMap[result.documentId] || null,
      score: result.score,
      snippet: result.text.substring(0, 300) + '...',
      chunkIndex: result.chunkIndex,
      metadata: result.metadata
    }));

    res.json({
      query,
      results: formattedResults,
      total: formattedResults.length,
      limit: parseInt(limit)
    });
  } catch (error) {
    next(error);
  }
};

export const hybridSearch = async (req, res, next) => {
  try {
    const { 
      query, 
      departmentId, 
      limit = 10,
      vectorWeight = 0.7,
      keywordWeight = 0.3
    } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // 1. Vector search
    const filter = {};
    if (req.user.role === 'employee') {
      filter.departmentId = req.user.departmentId;
    } else if (departmentId) {
      filter.departmentId = departmentId;
    }

    const vectorResults = await embeddingService.search(
      query,
      parseInt(limit) * 2,
      filter
    );

    // 2. Keyword search
    const keywordWhere = {};
    if (req.user.role === 'employee') {
      keywordWhere.departmentId = req.user.departmentId;
    } else if (departmentId) {
      keywordWhere.departmentId = departmentId;
    }

    const keywordResults = await Document.findAll({
      where: {
        ...keywordWhere,
        [Op.or]: [
          { title: { [Op.iLike]: `%${query}%` } },
          { fileName: { [Op.iLike]: `%${query}%` } },
          { ocrText: { [Op.iLike]: `%${query}%` } }
        ]
      },
      limit: parseInt(limit) * 2,
      attributes: ['id', 'title', 'fileName', 'ocrText', 'createdAt']
    });

    // 3. Combine and rerank results
    const combinedScores = {};

    // Add vector scores
    vectorResults.forEach(result => {
      const docId = result.documentId;
      if (!combinedScores[docId]) {
        combinedScores[docId] = { vectorScore: 0, keywordScore: 0, result };
      }
      combinedScores[docId].vectorScore = result.score * parseFloat(vectorWeight);
    });

    // Add keyword scores
    keywordResults.forEach(doc => {
      const docId = doc.id;
      if (!combinedScores[docId]) {
        combinedScores[docId] = { vectorScore: 0, keywordScore: 0, document: doc };
      }
      const titleMatch = doc.title.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
      const fileNameMatch = doc.fileName.toLowerCase().includes(query.toLowerCase()) ? 0.5 : 0;
      const textMatch = (doc.ocrText || '').toLowerCase().includes(query.toLowerCase()) ? 0.3 : 0;
      const keywordScore = (titleMatch + fileNameMatch + textMatch) / 3;
      
      combinedScores[docId].keywordScore = keywordScore * parseFloat(keywordWeight);
    });

    // Calculate final scores
    const finalResults = Object.values(combinedScores)
      .map(item => ({
        documentId: item.result?.documentId || item.document?.id,
        score: item.vectorScore + item.keywordScore,
        text: item.result?.text || item.document?.ocrText || '',
        metadata: item.result?.metadata || {}
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, parseInt(limit));

    // Get document details
    const documentIds = [...new Set(finalResults.map(r => r.documentId))];
    const documents = await Document.findAll({
      where: { id: documentIds },
      include: [
        { 
          association: 'department',  // ✅ Use 'department'
          attributes: ['id', 'name'] 
        },
        { 
          association: 'uploader',    // ✅ Use 'uploader'
          attributes: ['id', 'name'] 
        }
      ]
    });

    const documentMap = documents.reduce((acc, doc) => {
      acc[doc.id] = doc;
      return acc;
    }, {});

    // Format results
    const formattedResults = finalResults.map(result => ({
      document: documentMap[result.documentId] || null,
      score: result.score,
      snippet: result.text?.substring(0, 300) + '...' || '',
      metadata: result.metadata
    }));

    res.json({
      query,
      results: formattedResults,
      total: formattedResults.length,
      limit: parseInt(limit),
      weights: { vector: parseFloat(vectorWeight), keyword: parseFloat(keywordWeight) }
    });
  } catch (error) {
    next(error);
  }
};
import axios from 'axios';
import { QdrantClient } from '@qdrant/js-client-rest';
import { v4 as uuidv4 } from 'uuid';

export class EmbeddingService {
  constructor() {
    this.qdrantClient = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      checkCompatibility: false,
    });
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.embeddingModel = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
    this.collectionName = process.env.QDRANT_COLLECTION || 'document_archive';
    console.log(`✅ EmbeddingService initialized with collection: ${this.collectionName}`);
    this.initCollection();
  }

  async initCollection() {
    try {
      const collections = await this.qdrantClient.getCollections();
      const exists = collections.collections?.some(
        c => c.name === this.collectionName
      );

      if (!exists) {
        await this.qdrantClient.createCollection(this.collectionName, {
          vectors: {
            size: 768,
            distance: 'Cosine'
          }
        });
        console.log(`✅ Collection ${this.collectionName} created`);
      }
    } catch (error) {
      console.error('Failed to initialize Qdrant collection:', error);
    }
  }

  async getEmbedding(text) {
    try {
      const response = await axios.post(`${this.ollamaUrl}/api/embeddings`, {
        model: this.embeddingModel,
        prompt: text
      });
      return response.data.embedding;
    } catch (error) {
      console.error('Failed to get embedding:', error);
      throw error;
    }
  }

  normalizeVector(vector) {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return vector;
    return vector.map(val => val / magnitude);
  }

  // ============================================
  // ✅ GÉNÉRATION + STOCKAGE AVEC TOUS LES CHAMPS
  // ============================================
  async generateAndStore(chunks, documentId, metadata = {}) {
    const results = [];

    console.log(`📦 Storing ${chunks.length} chunks for doc ${documentId}`);
    console.log(`📦 Metadata received:`, {
      title: metadata.title,
      fileName: metadata.fileName,
      departmentId: metadata.departmentId,
      visibility: metadata.visibility
    });

    for (const [index, chunk] of chunks.entries()) {
      try {
        let embedding = await this.getEmbedding(chunk.text);
        embedding = this.normalizeVector(embedding);

        const pointId = uuidv4();

        // ✅ Payload complet avec departmentId et visibility
        const payload = {
          documentId,
          chunkIndex: index,
          text: chunk.text,
          title: metadata.title || '',
          fileName: metadata.fileName || '',
          departmentId: metadata.departmentId || null,   // ✅ CRUCIAL
          visibility: metadata.visibility || 'private',  // ✅ CRUCIAL
          ...metadata,
          createdAt: new Date().toISOString()
        };

        // ✅ Log pour vérifier
        if (index === 0) {
          console.log(`📦 First chunk payload:`, {
            documentId: payload.documentId,
            departmentId: payload.departmentId,
            visibility: payload.visibility
          });
        }

        await this.qdrantClient.upsert(this.collectionName, {
          points: [{
            id: pointId,
            vector: embedding,
            payload
          }]
        });

        results.push({
          text: chunk.text,
          embedding,
          qdrantPointId: pointId,
          metadata: {
            documentId,
            chunkIndex: index,
            ...metadata
          }
        });
      } catch (error) {
        console.error(`Failed to store chunk ${index}:`, error);
      }
    }

    console.log(`✅ Stored ${results.length}/${chunks.length} chunks`);
    return results;
  }

  // ============================================
  // ✅ RECHERCHE AVEC FILTRE
  // ============================================
  async search(query, topK = 10, filter = {}) {
    try {
      console.log('🔍 Searching for:', query);

      let queryEmbedding = await this.getEmbedding(query);
      queryEmbedding = this.normalizeVector(queryEmbedding);
      console.log('✅ Query vector normalized');

      let filterCondition = undefined;
      if (filter && Object.keys(filter).length > 0) {
        filterCondition = this.buildFilter(filter);
        console.log('📊 Filter condition:', JSON.stringify(filterCondition));
      }

      const searchResult = await this.qdrantClient.search(this.collectionName, {
        vector: queryEmbedding,
        limit: topK,
        filter: filterCondition,
        with_payload: true,
        score_threshold: 0.0,
      });

      // ✅ Gérer les deux formats (1.9.0 et 1.18.0)
      let points = [];
      if (Array.isArray(searchResult)) {
        points = searchResult;
      } else if (searchResult?.points) {
        points = searchResult.points;
      }

      console.log('📊 Points extracted:', points.length);

      if (points.length === 0) {
        console.warn('⚠️ No search results returned from Qdrant');
        return [];
      }

      // ✅ Retourner avec departmentId et visibility
      return points.map(point => ({
        id: point.id,
        score: point.score || 0,
        text: point.payload?.text || '',
        documentId: point.payload?.documentId || '',
        chunkIndex: point.payload?.chunkIndex || 0,
        departmentId: point.payload?.departmentId || null,
        visibility: point.payload?.visibility || 'private',
        metadata: point.payload || {}
      }));

    } catch (error) {
      console.error('❌ Search failed:', error.message);
      return [];
    }
  }

  // ============================================
  // ✅ FILTRE QDRANT
  // ============================================
  buildFilter(filter) {
    if (!filter || Object.keys(filter).length === 0) {
      return undefined;
    }

    const must = [];

    // Un seul département
    if (filter.departmentId) {
      must.push({
        key: 'departmentId',
        match: { value: filter.departmentId }
      });
    }

    // Plusieurs départements (OR via should)
    if (filter.departmentIds && Array.isArray(filter.departmentIds) && filter.departmentIds.length > 0) {
      must.push({
        should: filter.departmentIds.map(id => ({
          key: 'departmentId',
          match: { value: id }
        })),
        min_should: 1
      });
    }

    // Visibilité
    if (filter.visibility) {
      must.push({
        key: 'visibility',
        match: { value: filter.visibility }
      });
    }

    // Dates
    if (filter.dateFrom) {
      must.push({ key: 'createdAt', range: { gte: filter.dateFrom } });
    }
    if (filter.dateTo) {
      must.push({ key: 'createdAt', range: { lte: filter.dateTo } });
    }

    if (must.length === 0) return undefined;
    return { must };
  }

  async deleteDocument(documentId) {
    try {
      let pointsToDelete = [];
      let offset = null;

      do {
        const response = await this.qdrantClient.scroll(this.collectionName, {
          filter: {
            must: [{
              key: 'documentId',
              match: { value: documentId }
            }]
          },
          limit: 100,
          offset
        });

        if (response && response.points) {
          pointsToDelete = pointsToDelete.concat(response.points.map(p => p.id));
          offset = response.next_page_offset;
        } else {
          offset = null;
        }
      } while (offset !== null);

      if (pointsToDelete.length > 0) {
        await this.qdrantClient.delete(this.collectionName, {
          points: pointsToDelete
        });
      }
    } catch (error) {
      console.error(`Failed to delete document ${documentId}:`, error);
    }
  }
}

// Helper function to chunk text
export function chunkText(text, chunkSize = 500, overlap = 50) {
  if (!text) return [];

  const chunks = [];
  const words = text.split(' ');
  let currentChunk = [];
  let currentSize = 0;

  for (const word of words) {
    const wordSize = word.length + 1;

    if (currentSize + wordSize > chunkSize && currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.join(' '),
        metadata: {
          chunkSize: currentSize,
          wordCount: currentChunk.length
        }
      });

      const overlapWords = currentChunk.slice(-Math.floor(overlap / 5));
      currentChunk = [...overlapWords];
      currentSize = currentChunk.join(' ').length + 1;
    }

    currentChunk.push(word);
    currentSize += wordSize;
  }

  if (currentChunk.length > 0) {
    chunks.push({
      text: currentChunk.join(' '),
      metadata: {
        chunkSize: currentSize,
        wordCount: currentChunk.length
      }
    });
  }

  return chunks;
}

export const embeddingService = new EmbeddingService();
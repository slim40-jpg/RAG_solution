import axios from 'axios';
import { embeddingService } from './embeddingservice.js';
import { Document, Department, AccessRequest } from '../models/index.js';
import { Op } from 'sequelize';

export class RAGService {
  constructor() {
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.llmModel = process.env.OLLAMA_LLM_MODEL || 'llama3.2:latest';
  }

  async ask(question, context = {}, topK = 5, user = null) {
    try {
      console.log('💬 RAG Ask:', question);
      console.log('👤 User:', user?.email, 'Role:', user?.role);

      // ============================================
      // 1. CONSTRUIRE LA LISTE DES DÉPARTEMENTS ACCESSIBLES
      // ============================================
      const allowedDepartmentIds = new Set();

      // Admin : accès à tout
      if (user?.role === 'admin') {
        console.log('👑 Admin: no department filter');
      } else {
        // Son propre département
        if (user?.departmentId) {
          allowedDepartmentIds.add(user.departmentId);
        }

        // + Les départements pour lesquels il a un token d'accès actif
        if (user?.id) {
          const activeAccesses = await AccessRequest.findAll({
            where: {
              requesterId: user.id,
              status: 'approved',
              expiresAt: { [Op.gt]: new Date() }
            },
            include: [{
              model: Document,
              as: 'document',
              attributes: ['departmentId']
            }]
          });

          for (const access of activeAccesses) {
            if (access.document?.departmentId) {
              allowedDepartmentIds.add(access.document.departmentId);
            }
          }
        }
      }

      const allowedDepts = [...allowedDepartmentIds];
      console.log('✅ Allowed department IDs:', allowedDepts);

      // ============================================
      // 2. RECHERCHER DANS QDRANT AVEC LE FILTRE
      // ============================================
      let filter = {};

      if (user?.role !== 'admin' && allowedDepts.length > 0) {
        // Filtrer par départements accessibles
        if (allowedDepts.length === 1) {
          filter.departmentId = allowedDepts[0];
        } else {
          filter.departmentIds = allowedDepts; // tableau
        }
      }

      console.log('📊 Filter:', filter);

      const searchResults = await embeddingService.search(question, topK, filter);
      console.log(`📊 Found ${searchResults?.length || 0} results`);

      if (!searchResults || searchResults.length === 0) {
        return {
          answer: "Je n'ai pas trouvé d'informations pertinentes dans votre département. Si l'information se trouve dans un autre département, vous pouvez demander l'accès.",
          sources: [],
          restrictedDepartments: [],
          restrictedDocuments: []
        };
      }

      // ============================================
      // 3. RÉCUPÉRER LES DÉTAILS DES DOCUMENTS
      // ============================================
      const documentIds = [...new Set(searchResults.map(r => r.documentId))];
      const documents = await Document.findAll({
        where: { id: documentIds },
        attributes: ['id', 'title', 'fileName', 'departmentId', 'visibility']
      });

      const documentMap = documents.reduce((acc, doc) => {
        acc[doc.id] = {
          id: doc.id,
          title: doc.title,
          fileName: doc.fileName,
          departmentId: doc.departmentId,
          visibility: doc.visibility || 'private'
        };
        return acc;
      }, {});

      // ============================================
      // 4. GÉNÉRER LA RÉPONSE (uniquement sur docs accessibles)
      // ============================================
      const contextText = searchResults
        .map((result, index) => {
          const doc = documentMap[result.documentId];
          const source = `[Source ${index + 1}]`;
          return `${source} (${doc?.title || 'Document'})\n${result.text || ''}`;
        })
        .join('\n\n');

      const answer = await this.generateAnswer(question, contextText);
      console.log('✅ Answer generated');

      // ============================================
      // 5. FORMATER LES SOURCES
      // ============================================
      const sources = searchResults.map(result => {
        const doc = documentMap[result.documentId];
        return {
          documentId: result.documentId,
          title: doc?.title || 'Unknown',
          fileName: doc?.fileName || 'Unknown',
          relevanceScore: result.score || 0,
          snippet: result.text?.substring(0, 200) + '...' || '',
          visibility: doc?.visibility || 'private'
        };
      });

      // ============================================
      // 6. RETOURNER LA RÉPONSE
      // ============================================
      return {
        answer,
        sources: sources.slice(0, topK),
        restrictedDepartments: [],
        restrictedDocuments: []
      };

    } catch (error) {
      console.error('❌ RAG query failed:', error);
      return {
        answer: "J'ai rencontré une erreur lors du traitement de votre question. Veuillez réessayer.",
        sources: [],
        restrictedDepartments: [],
        restrictedDocuments: [],
        error: true
      };
    }
  }

  async generateAnswer(question, context) {
    const systemPrompt = `Tu es un assistant IA pour un système d'archives documentaires.

RÈGLES IMPORTANTES:
1. Tu réponds UNIQUEMENT en te basant sur le contexte fourni ci-dessous.
2. Si la réponse ne se trouve pas dans le contexte, dis-le clairement.
3. Sois précis, concis et professionnel.
4. Cite les sources quand c'est pertinent.
5. Ne fabrique pas d'informations qui ne sont pas dans le contexte.

RÉPONDS UNIQUEMENT EN FRANÇAIS.`;

    const userPrompt = `CONTEXTE:
${context}

QUESTION: ${question}

RÉPONSE:`;

    try {
      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model: this.llmModel,
        prompt: userPrompt,
        system: systemPrompt,
        stream: false,
        options: {
          temperature: 0.3,
          top_p: 0.9,
          num_predict: 500
        }
      });

      return response.data.response || "Je n'ai pas pu générer de réponse.";
    } catch (error) {
      console.error('❌ LLM generation failed:', error.message);
      return "Je n'ai pas pu générer de réponse.";
    }
  }
}

export const ragService = new RAGService();
import axios from 'axios';
import { embeddingService } from './embeddingservice.js';
import { Document, Department } from '../models/index.js';
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

      // ✅ 1. Build the search filter
      const filter = {};
      
      // If user is employee, restrict to their department
      if (user && user.role === 'employee') {
        filter.departmentId = user.departmentId;
      }

      // If context has departmentId, use it (admin/archivist only)
      if (context.departmentId && user && (user.role === 'admin' || user.role === 'archivist')) {
        filter.departmentId = context.departmentId;
      }

      console.log('📊 Filter:', filter);

      // ✅ 2. Perform search with the filter
      const searchResults = await embeddingService.search(question, topK, filter);

      console.log(`📊 Found ${searchResults?.length || 0} results`);

      if (!searchResults || searchResults.length === 0) {
        return {
          answer: "Je n'ai pas trouvé d'informations pertinentes dans l'archive documentaire.",
          sources: [],
          restrictedDepartments: []
        };
      }

      // ✅ 3. Get document details for sources
      const documentIds = [...new Set(searchResults.map(r => r.documentId))];
      const documents = await Document.findAll({
        where: { id: documentIds },
        attributes: ['id', 'title', 'fileName', 'departmentId']
      });

      const documentMap = documents.reduce((acc, doc) => {
        acc[doc.id] = { title: doc.title, fileName: doc.fileName, departmentId: doc.departmentId };
        return acc;
      }, {});

      // ✅ 4. Build context for LLM
      const contextText = searchResults
        .map((result, index) => {
          const source = `[Source ${index + 1}]`;
          const title = documentMap[result.documentId]?.title || 'Document';
          return `${source} (${title})\n${result.text || ''}`;
        })
        .join('\n\n');

      // ✅ 5. Generate answer with LLM
      const answer = await this.generateAnswer(question, contextText);

      // ✅ 6. Format sources
      const sources = searchResults.map(result => ({
        documentId: result.documentId,
        title: documentMap[result.documentId]?.title || 'Unknown',
        fileName: documentMap[result.documentId]?.fileName || 'Unknown',
        relevanceScore: result.score || 0,
        snippet: result.text?.substring(0, 200) + '...' || ''
      }));

      return {
        answer,
        sources: sources.slice(0, topK),
        restrictedDepartments: []
      };

    } catch (error) {
      console.error('❌ RAG query failed:', error);
      return {
        answer: "J'ai rencontré une erreur lors du traitement de votre question. Veuillez réessayer.",
        sources: [],
        restrictedDepartments: [],
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
          max_tokens: 500
        }
      });

      return response.data.response || "Je n'ai pas pu générer de réponse. Veuillez réessayer.";
    } catch (error) {
      console.error('❌ LLM generation failed:', error);
      return "Je n'ai pas pu générer de réponse. Veuillez réessayer.";
    }
  }
}

export const ragService = new RAGService();
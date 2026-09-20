import fs from 'fs';
import path from 'path';
import PDFParser from 'pdf2json';
import pg from 'pg';
import { embeddingService, chunkText } from './embeddingService.js';

const { Client } = pg;

export class DocumentProcessor {
  constructor() {
    this.client = null;
  }

  async connect() {
    this.client = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'admin',
      password: process.env.DB_PASSWORD || 'admin123',
      database: process.env.DB_NAME || 'document_archive',
    });
    await this.client.connect();
    console.log('✅ DocumentProcessor connected to database');
  }

  async disconnect() {
    if (this.client) {
      await this.client.end();
    }
  }

  async processAllPendingDocuments() {
    try {
      await this.connect();

      // Find documents that need processing
      const res = await this.client.query(
        `SELECT id, title, file_path, file_type 
         FROM documents 
         WHERE status IN ('pending', 'processing') 
            OR (status = 'completed' AND (ocr_text IS NULL OR ocr_text = ''))`
      );

      if (res.rows.length === 0) {
        console.log('✅ No documents to process');
        return;
      }

      console.log(`📊 Found ${res.rows.length} documents to process`);

      for (const doc of res.rows) {
        await this.processDocument(doc);
      }

      console.log('\n🎉 All documents processed!');
      await this.disconnect();

    } catch (error) {
      console.error('❌ Error processing documents:', error);
      await this.disconnect();
    }
  }

  async processDocument(doc) {
    try {
      console.log(`\n📄 Processing: ${doc.title}`);
      console.log(`📁 File path: ${doc.file_path}`);

      // Update status to processing
      await this.client.query(
        'UPDATE documents SET status = $1 WHERE id = $2',
        ['processing', doc.id]
      );

      // Extract text based on file type
      let extractedText = '';

      if (doc.file_type === 'pdf') {
        extractedText = await this.extractTextFromPDF(doc.file_path);
      } else if (doc.file_type === 'image') {
        extractedText = await this.extractTextFromImage(doc.file_path);
      } else if (doc.file_type === 'excel') {
        extractedText = await this.extractTextFromExcel(doc.file_path);
      } else {
        console.log(`⚠️ Unsupported file type: ${doc.file_type}`);
        await this.client.query(
          'UPDATE documents SET status = $1 WHERE id = $2',
          ['failed', doc.id]
        );
        return;
      }

      if (!extractedText || extractedText.length === 0) {
        console.warn(`⚠️ No text extracted from: ${doc.title}`);
        await this.client.query(
          `UPDATE documents 
           SET status = $1, processed_at = NOW() 
           WHERE id = $2`,
          ['completed', doc.id]
        );
        return;
      }

      console.log(`✅ Extracted ${extractedText.length} characters`);

      // Update document with extracted text
      await this.client.query(
        `UPDATE documents 
         SET ocr_text = $1, 
             status = 'completed', 
             processed_at = NOW() 
         WHERE id = $2`,
        [extractedText, doc.id]
      );

      // Generate embeddings
      console.log('🧠 Generating embeddings...');
      await this.generateEmbeddings(doc.id, doc.title, extractedText);

      console.log(`✅ Document processed: ${doc.title}`);

    } catch (error) {
      console.error(`❌ Error processing document ${doc.id}:`, error);
      await this.client.query(
        'UPDATE documents SET status = $1 WHERE id = $2',
        ['failed', doc.id]
      );
    }
  }

  async extractTextFromPDF(filePath) {
    try {
      const fullPath = path.join(process.cwd(), filePath);
      if (!fs.existsSync(fullPath)) {
        console.error(`❌ File not found: ${fullPath}`);
        return '';
      }

      const dataBuffer = fs.readFileSync(fullPath);
      const pdfParser = new PDFParser();

      return new Promise((resolve, reject) => {
        pdfParser.on('pdfParser_dataError', (errData) => {
          console.error('❌ PDF parsing error:', errData);
          resolve('');
        });

        pdfParser.on('pdfParser_dataReady', (pdfData) => {
          try {
            let text = '';
            if (pdfData && pdfData.Pages) {
              pdfData.Pages.forEach(page => {
                if (page.Texts) {
                  page.Texts.forEach(textItem => {
                    if (textItem.R && textItem.R[0] && textItem.R[0].T) {
                      text += decodeURIComponent(textItem.R[0].T) + ' ';
                    }
                  });
                }
                text += '\n';
              });
            }
            resolve(text.trim());
          } catch (error) {
            reject(error);
          }
        });

        pdfParser.parseBuffer(dataBuffer);
      });
    } catch (error) {
      console.error('PDF extraction failed:', error);
      return '';
    }
  }

  async extractTextFromImage(filePath) {
    // TODO: Implement image OCR using Tesseract
    console.warn('Image OCR not yet implemented');
    return '';
  }

  async extractTextFromExcel(filePath) {
    // TODO: Implement Excel extraction
    console.warn('Excel extraction not yet implemented');
    return '';
  }

  async generateEmbeddings(documentId, title, text) {
    try {
      if (!text || text.length < 10) {
        console.log('⚠️ Text too short, skipping embeddings');
        return;
      }

      console.log(`📄 Text length: ${text.length} characters`);

      // Delete existing chunks
      await this.client.query(
        'DELETE FROM document_chunks WHERE document_id = $1',
        [documentId]
      );

      // Chunk the text
      const chunks = chunkText(text, 500, 50);
      console.log(`📝 Created ${chunks.length} chunks`);

      // Generate embeddings and store in Qdrant
      const chunksWithEmbeddings = await embeddingService.generateAndStore(
        chunks,
        documentId,
        { title }
      );

      // Save chunks to database
      for (const [index, chunk] of chunksWithEmbeddings.entries()) {
        await this.client.query(
          `INSERT INTO document_chunks 
           (id, document_id, chunk_index, chunk_text, chunk_metadata, qdrant_point_id, embedding, created_at, updated_at) 
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [
            documentId,
            index,
            chunk.text,
            chunk.metadata,
            chunk.qdrantPointId,
            chunk.embedding
          ]
        );
      }

      console.log(`✅ Stored ${chunksWithEmbeddings.length} chunks in Qdrant`);

    } catch (error) {
      console.error('❌ Error generating embeddings:', error);
    }
  }
}

export const documentProcessor = new DocumentProcessor();
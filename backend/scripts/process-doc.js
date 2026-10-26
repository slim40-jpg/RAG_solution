import sequelize from '../src/config/database.js';
import { Document, DocumentChunk } from '../src/models/index.js';
import { ocrService } from '../src/services/OCRservice.js';
import { embeddingService, chunkText } from '../src/services/embeddingservice.js';

// ✅ Clean scrambled text (for FlowCV and similar PDFs)
function cleanScrambledText(text) {
  if (!text) return '';

  // Normalize spaces
  let cleaned = text.replace(/\s+/g, ' ');

  // Detect if scrambled (spaces between every character)
  const words = cleaned.split(' ');
  const singleCharWords = words.filter(w => w.length === 1 && /[a-zA-Z]/.test(w));

  // If more than 30% are single characters → scrambled
  if (singleCharWords.length > words.length * 0.3) {
    // Remove all spaces
    cleaned = cleaned.replace(/\s/g, '');

    // Add spaces before uppercase letters (camelCase)
    cleaned = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2');

    // Add spaces around common patterns
    cleaned = cleaned.replace(/(https?:\/\/[^\s]+)/g, ' $1 ');
    cleaned = cleaned.replace(/(\.com|\.tn|\.fr|\.org)/g, '$1 ');
    cleaned = cleaned.replace(/(@[^\s]+)/g, ' $1 ');
    cleaned = cleaned.replace(/(\d{4})/g, ' $1 ');

    // Add spaces around common words
    const commonWords = ['Skills', 'Experience', 'Education', 'Projects', 'Summary', 'Profile'];
    for (const word of commonWords) {
      const regex = new RegExp(word, 'gi');
      cleaned = cleaned.replace(regex, ` ${word} `);
    }

    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
  }

  return cleaned.trim();
}

async function processAllDocuments() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Find documents that need processing
    const documents = await Document.findAll({
      where: {
        status: ['pending', 'processing', 'completed'],
      },
      include: [{ model: DocumentChunk, required: false }]
    });

    // Filter: Only process documents that have text but NO chunks
    const docsToProcess = documents.filter(doc => {
      if (doc.status === 'pending' || doc.status === 'processing') {
        return true;
      }
      if (doc.status === 'completed') {
        const hasChunks = doc.DocumentChunks && doc.DocumentChunks.length > 0;
        const hasText = doc.ocrText && doc.ocrText.length > 0;
        return hasText && !hasChunks;
      }
      return false;
    });

    console.log(`📊 Found ${docsToProcess.length} documents to process`);

    for (const doc of docsToProcess) {
      console.log(`\n📝 Processing: ${doc.title} (${doc.id})`);

      try {
        await doc.update({ status: 'processing' });

        let extractedText = doc.ocrText || '';

        // Extract text if not already present
        if (!extractedText || extractedText.length === 0) {
          console.log('🔍 Extracting text...');
          try {
            if (doc.fileType === 'pdf' || doc.fileType === 'image') {
              extractedText = await ocrService.extractText(doc.filePath);
            }
          } catch (error) {
            console.error('❌ OCR failed:', error.message);
          }
        } else {
          console.log(`📄 Existing text found (${extractedText.length} characters)`);
        }

        // ✅ Clean the text
        if (extractedText && extractedText.length > 0) {
          const cleanedText = cleanScrambledText(extractedText);
          if (cleanedText !== extractedText) {
            console.log(`🧹 Cleaned text: ${extractedText.length} → ${cleanedText.length} characters`);
            extractedText = cleanedText;
          }
        }

        if (extractedText && extractedText.length > 10) {
          console.log(`✅ Final text length: ${extractedText.length} characters`);
          console.log(`📄 Preview: ${extractedText.substring(0, 100)}...`);

          // Delete existing chunks
          await DocumentChunk.destroy({ where: { documentId: doc.id } });
          console.log(`🗑️ Deleting old Qdrant points for doc ${doc.id}...`);
          await embeddingService.deleteDocument(doc.id);
          // Chunk the text
          const chunks = chunkText(extractedText, 500, 50);
          console.log(`📝 Created ${chunks.length} chunks`);
          
          // Generate embeddings and store in Qdrant
          console.log('🧠 Generating embeddings...');
          const chunksWithEmbeddings = await embeddingService.generateAndStore(
                 chunks,
                 doc.id,
                 {
                     title: doc.title,
                     fileName: doc.fileName,
                     departmentId: doc.departmentId,        // ✅ AJOUTER
                     visibility: doc.visibility || 'private' // ✅ AJOUTER
                 }
                );
          console.log(`✅ Stored ${chunksWithEmbeddings.length} chunks in Qdrant`);

          // Save chunks to database
          for (const [index, chunk] of chunksWithEmbeddings.entries()) {
            await DocumentChunk.create({
              documentId: doc.id,
              chunkIndex: index,
              chunkText: chunk.text,
              chunkMetadata: chunk.metadata,
              qdrantPointId: chunk.qdrantPointId,
              embedding: chunk.embedding
            });
          }

          // Update document
          await doc.update({
            status: 'completed',
            ocrText: extractedText,
            processedAt: new Date()
          });

          console.log(`✅ Document ${doc.id} processed successfully`);
        } else {
          console.log(`⚠️ No text extracted from document`);
          await doc.update({
            status: 'completed',
            processedAt: new Date()
          });
        }

      } catch (error) {
        console.error(`❌ Error processing document ${doc.id}:`, error.message);
        await doc.update({ status: 'failed' });
      }
    }

    console.log('\n🎉 All documents processed!');
    const totalChunks = await DocumentChunk.count();
    console.log(`📊 Total chunks in database: ${totalChunks}`);

    // Show Qdrant count
    try {
      const response = await fetch(`http://localhost:6333/collections/${process.env.QDRANT_COLLECTION || 'document_archive'}/points/count`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();
      console.log(`📊 Qdrant points: ${data.result?.count || 0}`);
    } catch (e) {
      console.log('⚠️ Could not fetch Qdrant count');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sequelize.close();
  }
}

processAllDocuments();
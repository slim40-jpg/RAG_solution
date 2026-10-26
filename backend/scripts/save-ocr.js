import sequelize from '../src/config/database.js';
import { Document, DocumentChunk } from '../src/models/index.js';
import { ocrService } from '../src/services/OCRservice.js';
import { embeddingService, chunkText } from '../src/services/embeddingService.js';

async function saveOCRText() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // ✅ Find ALL documents that are pending or have no text
    const documents = await Document.findAll({
      where: {
        status: ['pending', 'processing']
      }
    });

    if (documents.length === 0) {
      console.log('❌ No pending documents found');
      console.log('💡 Try resetting documents with:');
      console.log('   psql -U admin -d document_archive -h localhost -c "UPDATE documents SET status = \'pending\', ocr_text = NULL;"');
      return;
    }

    console.log(`📊 Found ${documents.length} documents to process\n`);

    for (const doc of documents) {
      console.log(`📄 Processing: ${doc.title}`);
      console.log(`📁 File path: ${doc.filePath}`);

      // Extract text using OCR
      const extractedText = await ocrService.extractText(doc.filePath);
      
      if (extractedText && extractedText.length > 0) {
        console.log(`✅ Extracted ${extractedText.length} characters`);
        console.log(`📄 Preview: ${extractedText.substring(0, 200)}...`);

        // Update the document with OCR text
        await doc.update({
          ocrText: extractedText,
          status: 'completed',
          processedAt: new Date()
        });

        console.log('✅ Database updated!');
        
        // Now generate embeddings
        console.log('\n🧠 Generating embeddings...');

        // Delete existing chunks
        await DocumentChunk.destroy({ where: { documentId: doc.id } });

        // Chunk the text
        const chunks = chunkText(extractedText, 500, 50);
        console.log(`📝 Created ${chunks.length} chunks`);

        // Generate embeddings
        const chunksWithEmbeddings = await embeddingService.generateAndStore(
          chunks,
          doc.id,
          { title: doc.title, fileName: doc.fileName }
        );

        // Save chunks
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

        console.log(`✅ Stored ${chunksWithEmbeddings.length} chunks in Qdrant`);
        console.log('---\n');

      } else {
        console.log(`⚠️ No text extracted from: ${doc.title}`);
        await doc.update({ status: 'failed' });
      }
    }

    console.log('🎉 All documents processed!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sequelize.close();
  }
}

saveOCRText();
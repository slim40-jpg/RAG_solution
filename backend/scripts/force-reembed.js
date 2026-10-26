import sequelize from '../src/config/database.js';
import { Document, DocumentChunk } from '../src/models/index.js';
import { ocrService } from '../src/services/OCRservice.js';
import { embeddingService, chunkText } from '../src/services/embeddingService.js';

async function forceReembed() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // ✅ Find all documents (pending, processing, or completed)
    const documents = await Document.findAll({
      where: {
        status: ['pending', 'processing', 'completed']
      }
    });

    if (documents.length === 0) {
      console.log('❌ No documents found to process.');
      return;
    }

    console.log(`📊 Found ${documents.length} documents to process\n`);

    for (const doc of documents) {
      console.log(`📝 Processing: ${doc.title}`);
      console.log(`📁 File path: ${doc.filePath}`);

      // ✅ 1. Extract text (if not already present)
      let text = doc.ocrText;
      if (!text || text.length < 10) {
        console.log('🔍 Extracting text with OCR...');
        text = await ocrService.extractText(doc.filePath);
        if (text && text.length > 0) {
          await doc.update({ ocrText: text });
        }
      }

      if (!text || text.length < 10) {
        console.log('⚠️ No text available, skipping');
        await doc.update({ status: 'failed' });
        continue;
      }

      console.log(`✅ Text length: ${text.length} characters`);

      // ✅ 2. Delete existing chunks for this document
      await DocumentChunk.destroy({ where: { documentId: doc.id } });

      // ✅ 3. Chunk the text
      const chunks = chunkText(text, 500, 50);
      console.log(`📝 Created ${chunks.length} chunks`);

      // ✅ 4. Generate embeddings and store in Qdrant
      console.log('🧠 Generating embeddings...');
      const chunksWithEmbeddings = await embeddingService.generateAndStore(
        chunks,
        doc.id,
        { title: doc.title, fileName: doc.fileName }
      );

      // ✅ 5. Save chunks to database
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

      // ✅ 6. Update document status
      await doc.update({
        status: 'completed',
        processedAt: new Date()
      });

      console.log(`✅ Stored ${chunksWithEmbeddings.length} chunks in Qdrant for: ${doc.title}`);
      console.log('---\n');
    }

    // ✅ 7. Check Qdrant indexing status
    console.log('\n📊 Checking Qdrant indexing status...');
    try {
      const response = await fetch(`http://localhost:6333/collections/${embeddingService.collectionName}`, {
        method: 'GET'
      });
      const data = await response.json();
      console.log(`   Points count: ${data.result?.points_count || 0}`);
      console.log(`   Indexed vectors: ${data.result?.indexed_vectors_count || 0}`);
      
      if (data.result?.indexed_vectors_count === 0 && data.result?.points_count > 0) {
        console.log('   ⚠️ Vectors are NOT indexed!');
        console.log('   💡 Waiting 10 seconds for indexing...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Check again
        const response2 = await fetch(`http://localhost:6333/collections/${embeddingService.collectionName}`, {
          method: 'GET'
        });
        const data2 = await response2.json();
        console.log(`   Points count: ${data2.result?.points_count || 0}`);
        console.log(`   Indexed vectors: ${data2.result?.indexed_vectors_count || 0}`);
      }
    } catch (error) {
      console.log('   ⚠️ Could not check Qdrant status:', error.message);
    }

    console.log('\n🎉 All documents processed successfully!');
    console.log('📊 Run: node scripts/test-rag.js to test');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sequelize.close();
  }
}

forceReembed();
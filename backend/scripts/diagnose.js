import sequelize from '../src/config/database.js';
import { Document, DocumentChunk } from '../src/models/index.js';
import { embeddingService } from '../src/services/embeddingService.js';
import { ragService } from '../src/services/ragService.js';

async function diagnose() {
  console.log('🔍 DIAGNOSING SYSTEM...\n');
  console.log('=' .repeat(50));

  try {
    await sequelize.authenticate();
    console.log('✅ 1. Database connected');

    // Check documents
    const docs = await Document.findAll({
      where: { status: 'completed' }
    });
    console.log(`📄 2. Documents: ${docs.length} completed`);

    docs.forEach(doc => {
      const hasText = doc.ocrText && doc.ocrText.length > 10;
      console.log(`   - ${doc.title}: ${hasText ? `✅ ${doc.ocrText.length} chars` : '❌ No text'}`);
    });

    // Check chunks
    const chunks = await DocumentChunk.count();
    console.log(`📊 3. Chunks in DB: ${chunks}`);

    // Check Qdrant
    console.log('\n🔍 4. Checking Qdrant...');
    try {
      const count = await embeddingService.qdrantClient.post(
        `/collections/${embeddingService.collectionName}/points/count`,
        { body: {} }
      );
      console.log(`   Points in Qdrant: ${count.result?.count || 0}`);
    } catch (e) {
      console.log(`   ⚠️ Qdrant error: ${e.message}`);
    }

    // Test embedding generation
    console.log('\n🧠 5. Testing Ollama embedding...');
    try {
      const embedding = await embeddingService.getEmbedding('test');
      console.log(`   ✅ Embedding generated: ${embedding.length} dimensions`);
    } catch (e) {
      console.log(`   ❌ Ollama error: ${e.message}`);
    }

    // Test search
    console.log('\n🔍 6. Testing search for "skills"...');
    const results = await embeddingService.search('skills', 5);
    console.log(`   Results: ${results.length}`);

    if (results.length > 0) {
      console.log('   ✅ Search works!');
      console.log(`   First result score: ${results[0].score}`);
      console.log(`   Text: ${results[0].text?.substring(0, 80)}...`);
    } else {
      console.log('   ❌ Search returned no results');
      
      // Try with a lower threshold
      console.log('\n   🔍 Trying with score_threshold: 0.1...');
      try {
        const queryEmbedding = await embeddingService.getEmbedding('skills');
        const searchResult = await embeddingService.qdrantClient.search(
          embeddingService.collectionName,
          {
            vector: queryEmbedding,
            limit: 5,
            with_payload: true,
            score_threshold: 0.1,
          }
        );
        console.log(`   Results with threshold 0.1: ${searchResult.points?.length || 0}`);
        if (searchResult.points?.length > 0) {
          console.log(`   ✅ Found results with lower threshold!`);
          console.log(`   Score: ${searchResult.points[0].score}`);
        }
      } catch (e) {
        console.log(`   ❌ Error: ${e.message}`);
      }
    }

    // Test RAG
    console.log('\n💬 7. Testing RAG...');
    const ragResult = await ragService.ask('What skills does Slim Selmi have?', {}, 5);
    console.log(`   Answer: ${ragResult.answer.substring(0, 80)}...`);
    console.log(`   Sources: ${ragResult.sources?.length || 0}`);

    console.log('\n' + '='.repeat(50));
    console.log('🔍 DIAGNOSIS COMPLETE');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

diagnose();
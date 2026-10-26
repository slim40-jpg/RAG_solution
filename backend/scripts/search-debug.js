import { embeddingService } from '../src/services/embeddingService.js';

async function debugSearch() {
  console.log('🔍 DEBUGGING QDRANT SEARCH...\n');
  console.log('=' .repeat(60));

  try {
    // ============================================================
    // 1. Check what's in Qdrant (scroll points)
    // ============================================================
    console.log('\n📊 1. Checking points in Qdrant...');
    const scrollResult = await embeddingService.qdrantClient.scroll(
      embeddingService.collectionName,
      { limit: 3, with_payload: true, with_vector: true }
    );

    const points = scrollResult.points || [];
    console.log(`   ✅ Total points in Qdrant: ${points.length}`);

    if (points.length === 0) {
      console.log('   ❌ No points found in Qdrant!');
      console.log('   💡 Run: node scripts/save-ocr.js first');
      return;
    }

    // Show first point details
    const firstPoint = points[0];
    console.log('\n   📄 Sample point:');
    console.log(`   ID: ${firstPoint.id}`);
    console.log(`   Vector length: ${firstPoint.vector?.length || 0}`);
    console.log(`   Text preview: ${firstPoint.payload?.text?.substring(0, 100)}...`);
    console.log(`   Document ID: ${firstPoint.payload?.documentId}`);
    console.log(`   Chunk Index: ${firstPoint.payload?.chunkIndex}`);

    // ============================================================
    // 2. Test Ollama embedding generation
    // ============================================================
    console.log('\n🧠 2. Testing Ollama embedding generation...');
    const testQuery = 'skills';
    const testEmbedding = await embeddingService.getEmbedding(testQuery);
    console.log(`   ✅ Query: "${testQuery}"`);
    console.log(`   ✅ Embedding length: ${testEmbedding.length}`);
    console.log(`   📊 First 5 values: ${testEmbedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}`);

    // ============================================================
    // 3. Calculate cosine similarity with first point
    // ============================================================
    console.log('\n📊 3. Calculating cosine similarity...');
    const storedVector = firstPoint.vector;
    let dotProduct = 0;
    let storedMag = 0;
    let queryMag = 0;

    for (let i = 0; i < storedVector.length; i++) {
      dotProduct += storedVector[i] * testEmbedding[i];
      storedMag += storedVector[i] * storedVector[i];
      queryMag += testEmbedding[i] * testEmbedding[i];
    }

    const similarity = dotProduct / (Math.sqrt(storedMag) * Math.sqrt(queryMag));
    console.log(`   📊 Cosine Similarity: ${similarity.toFixed(6)}`);
    console.log(`   📊 Similarity %: ${(similarity * 100).toFixed(2)}%`);

    if (similarity > 0.5) {
      console.log('   ✅ Vectors are similar! Search should work.');
    } else if (similarity > 0.2) {
      console.log('   ⚠️ Vectors are somewhat similar but may not match well.');
    } else {
      console.log('   ❌ Vectors are NOT similar. This is why search fails.');
      console.log('   💡 The embedding model might be different for storage vs search.');
    }

    // ============================================================
    // 4. Test Qdrant search with different thresholds
    // ============================================================
    console.log('\n🔍 4. Testing Qdrant search with different thresholds...');

    const thresholds = [0.0, 0.01, 0.1, 0.3, 0.5, 0.7];
    
    for (const threshold of thresholds) {
      const result = await embeddingService.qdrantClient.search(
        embeddingService.collectionName,
        {
          vector: testEmbedding,
          limit: 5,
          with_payload: true,
          score_threshold: threshold,
        }
      );
      
      const count = result.points?.length || 0;
      const icon = count > 0 ? '✅' : '❌';
      console.log(`   ${icon} Threshold ${threshold}: ${count} results`);
      
      if (count > 0 && result.points.length > 0) {
        console.log(`      First score: ${result.points[0].score?.toFixed(4)}`);
        console.log(`      Text: ${result.points[0].payload?.text?.substring(0, 60)}...`);
      }
    }

    // ============================================================
    // 5. Test with a longer query
    // ============================================================
    console.log('\n🔍 5. Testing with longer queries...');
    
    const queries = [
      'skills',
      'Slim Selmi skills',
      'web development',
      'ICT Engineering Student SupCom',
      'certificates and achievements'
    ];

    for (const q of queries) {
      const qEmbedding = await embeddingService.getEmbedding(q);
      const result = await embeddingService.qdrantClient.search(
        embeddingService.collectionName,
        {
          vector: qEmbedding,
          limit: 3,
          with_payload: true,
          score_threshold: 0.0,
        }
      );
      
      const count = result.points?.length || 0;
      console.log(`   "${q}": ${count} results`);
      if (count > 0) {
        console.log(`      Best score: ${result.points[0].score?.toFixed(4)}`);
      }
    }

    // ============================================================
    // 6. Check the collection configuration
    // ============================================================
    console.log('\n📊 6. Checking collection info...');
    try {
      const info = await embeddingService.qdrantClient.getCollection(embeddingService.collectionName);
      console.log(`   ✅ Collection: ${embeddingService.collectionName}`);
      console.log(`   📊 Vector size: ${info.config?.params?.vectors?.size || 'unknown'}`);
      console.log(`   📊 Distance: ${info.config?.params?.vectors?.distance || 'unknown'}`);
      console.log(`   📊 Points count: ${info.points_count || 0}`);
    } catch (e) {
      console.log(`   ❌ Could not get collection info: ${e.message}`);
    }

    // ============================================================
    // 7. Summary and Recommendations
    // ============================================================
    console.log('\n' + '='.repeat(60));
    console.log('📋 SUMMARY & RECOMMENDATIONS');

    if (similarity > 0.3) {
      console.log('   ✅ Vectors are similar enough.');
      console.log('   💡 Set score_threshold to 0.0 or 0.01 in embeddingService.js');
    } else {
      console.log('   ❌ Vectors are NOT similar.');
      console.log('   💡 The embedding model might have changed.');
      console.log('   💡 Try: ollama pull nomic-embed-text');
      console.log('   💡 Then re-embed: node scripts/save-ocr.js');
    }

    console.log('\n🔧 Quick fixes:');
    console.log('   1. Add score_threshold: 0.0 to embeddingService.js search()');
    console.log('   2. Check OLLAMA_EMBEDDING_MODEL in .env');
    console.log('   3. Run: node scripts/save-ocr.js to re-embed');
    console.log('   4. Check Qdrant collection name in .env');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

debugSearch();
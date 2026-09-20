import { embeddingService } from '../src/services/embeddingService.js';

async function testQdrantDirect() {
  try {
    console.log('🔍 Testing Qdrant Search Directly...\n');

    // 1. Check what's in Qdrant
    console.log('📊 1. Checking Qdrant points...');
    const scrollResult = await embeddingService.qdrantClient.scroll(
      embeddingService.collectionName,
      { limit: 2, with_payload: true, with_vector: true }
    );

    if (!scrollResult.points || scrollResult.points.length === 0) {
      console.log('❌ No points found in Qdrant!');
      return;
    }

    console.log(`   ✅ Found ${scrollResult.points.length} points`);

    scrollResult.points.forEach((point, i) => {
      console.log(`\n   Point ${i+1}:`);
      console.log(`   ID: ${point.id}`);
      console.log(`   Text: ${point.payload?.text?.substring(0, 80)}...`);
      console.log(`   Document ID: ${point.payload?.documentId}`);
      console.log(`   Vector length: ${point.vector?.length || 0}`);
    });

    // 2. Get query embedding
    console.log('\n📊 2. Getting query embedding for "skills"...');
    const queryEmbedding = await embeddingService.getEmbedding('skills');
    console.log(`   ✅ Query embedding length: ${queryEmbedding.length}`);

    // 3. Search Qdrant
    console.log('\n📊 3. Searching Qdrant...');
    const searchResult = await embeddingService.qdrantClient.search(
      embeddingService.collectionName,
      {
        vector: queryEmbedding,
        limit: 10,
        with_payload: true,
        score_threshold: 0.1,  // Low threshold to catch all results
      }
    );

    console.log(`   📊 Results: ${searchResult.points?.length || 0}`);

    if (searchResult.points && searchResult.points.length > 0) {
      console.log('\n✅ SEARCH WORKS!');
      searchResult.points.forEach((p, i) => {
        console.log(`\n📄 Result ${i+1}:`);
        console.log(`   Score: ${p.score}`);
        console.log(`   Text: ${p.payload?.text?.substring(0, 80)}...`);
      });
    } else {
      console.log('\n❌ Search returned no results!');
      console.log('💡 Try searching with a different query.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testQdrantDirect();
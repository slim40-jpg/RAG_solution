import { embeddingService } from '../src/services/embeddingService.js';
import { QdrantClient } from '@qdrant/js-client-rest';

async function testDirectSearch() {
  try {
    console.log('🔍 Testing Direct Search...\n');

    const client = new QdrantClient({
      url: 'http://localhost:6333',
    });

    // 1. Get a point from Qdrant to see its vector
    console.log('📊 1. Getting a sample point...');
    const scroll = await client.scroll('document_archive', {
      limit: 1,
      with_vector: true,
      with_payload: true,
    });

    if (!scroll.points || scroll.points.length === 0) {
      console.log('❌ No points found');
      return;
    }

    const point = scroll.points[0];
    console.log(`   ✅ Found point: ${point.id}`);
    console.log(`   📝 Text: ${point.payload?.text?.substring(0, 80)}...`);
    console.log(`   📊 Vector length: ${point.vector?.length || 0}`);

    // 2. Get query embedding using the SAME model
    console.log('\n📊 2. Getting query embedding with nomic-embed-text...');
    const queryVector = await embeddingService.getEmbedding('skills');
    console.log(`   ✅ Query vector length: ${queryVector.length}`);
    console.log(`   📊 First 5 values: ${queryVector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}`);

    // 3. Search with the query
    console.log('\n📊 3. Searching Qdrant...');
    const result = await client.search('document_archive', {
      vector: queryVector,
      limit: 5,
      with_payload: true,
      score_threshold: 0.0,
    });

    console.log(`   📊 Results: ${result.points?.length || 0}`);

    if (result.points && result.points.length > 0) {
      console.log('\n✅ SEARCH WORKS!');
      result.points.forEach((p, i) => {
        console.log(`\n   Result ${i+1}:`);
        console.log(`   Score: ${p.score}`);
        console.log(`   Text: ${p.payload?.text?.substring(0, 100)}...`);
        console.log(`   Document ID: ${p.payload?.documentId}`);
      });
    } else {
      console.log('\n❌ Search returned no results');
      
      // Check if points exist
      console.log('\n📊 Checking points count...');
      const count = await client.post(`/collections/document_archive/points/count`, {
        body: {}
      });
      console.log(`   Points: ${count.result?.count || 0}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testDirectSearch();
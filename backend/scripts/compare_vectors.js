import { embeddingService } from '../src/services/embeddingService.js';
import { QdrantClient } from '@qdrant/js-client-rest';

async function compareVectors() {
  try {
    console.log('🔍 Comparing Vectors...\n');

    const client = new QdrantClient({
      url: 'http://localhost:6333',
    });

    // 1. Get a stored point
    console.log('📊 1. Getting stored point...');
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
    const storedVector = point.vector;
    console.log(`   ✅ Stored vector length: ${storedVector.length}`);
    console.log(`   📊 First 10 stored values: ${storedVector.slice(0, 10).map(v => v.toFixed(4)).join(', ')}`);

    // 2. Get query embedding
    console.log('\n📊 2. Getting query embedding...');
    const queryVector = await embeddingService.getEmbedding('skills');
    console.log(`   ✅ Query vector length: ${queryVector.length}`);
    console.log(`   📊 First 10 query values: ${queryVector.slice(0, 10).map(v => v.toFixed(4)).join(', ')}`);

    // 3. Compare the vectors
    console.log('\n📊 3. Comparing vectors...');
    console.log(`   Stored vector type: ${typeof storedVector[0]}`);
    console.log(`   Query vector type: ${typeof queryVector[0]}`);

    // Check if values are in similar range
    const storedMean = storedVector.reduce((a, b) => a + b, 0) / storedVector.length;
    const queryMean = queryVector.reduce((a, b) => a + b, 0) / queryVector.length;
    console.log(`   Stored vector mean: ${storedMean.toFixed(4)}`);
    console.log(`   Query vector mean: ${queryMean.toFixed(4)}`);

    // 4. Try to search with the stored vector itself
    console.log('\n📊 4. Searching with stored vector (should return itself)...');
    const selfSearch = await client.search('document_archive', {
      vector: storedVector,
      limit: 1,
      with_payload: true,
      score_threshold: 0.0,
    });
    console.log(`   Results: ${selfSearch.points?.length || 0}`);
    if (selfSearch.points && selfSearch.points.length > 0) {
      console.log(`   ✅ Self-search works! Score: ${selfSearch.points[0].score}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

compareVectors();
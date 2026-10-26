import { embeddingService } from '../src/services/embeddingService.js';
import { QdrantClient } from '@qdrant/js-client-rest';

async function testRawSearch() {
  try {
    console.log('🔍 Testing RAW Search...\n');

    const client = new QdrantClient({
      url: 'http://localhost:6333',
    });

    // 1. Get a stored vector directly
    console.log('📊 1. Getting stored vector...');
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
    console.log(`   📝 Text: ${point.payload?.text?.substring(0, 80)}...`);

    // 2. Search with the EXACT SAME vector
    console.log('\n📊 2. Searching with the EXACT SAME vector...');
    const result = await client.search('document_archive', {
      vector: storedVector,
      limit: 5,
      with_payload: true,
      score_threshold: 0.0,
    });

    console.log(`   📊 Results: ${result.points?.length || 0}`);

    if (result.points && result.points.length > 0) {
      console.log('\n✅ SEARCH WORKS WITH STORED VECTOR!');
      result.points.forEach((p, i) => {
        console.log(`   Result ${i+1}: Score: ${p.score}`);
        console.log(`   Text: ${p.payload?.text?.substring(0, 60)}...`);
      });
    } else {
      console.log('\n❌ Search with stored vector returned 0 results!');
      console.log('💡 This means Qdrant cannot find itself. The issue is in Qdrant.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testRawSearch();
import { embeddingService } from '../src/services/embeddingService.js';
import { QdrantClient } from '@qdrant/js-client-rest';

async function checkModelMismatch() {
  try {
    console.log('🔍 Checking if the embedding model is the same...\n');

    const client = new QdrantClient({
      url: 'http://localhost:6333',
    });

    // 1. Get a stored vector
    const scroll = await client.scroll('document_archive', {
      limit: 1,
      with_vector: true,
      with_payload: true,
    });

    if (!scroll.points || scroll.points.length === 0) {
      console.log('❌ No stored vectors found.');
      return;
    }

    const storedVector = scroll.points[0].vector;

    // 2. Generate a fresh embedding for the same text
    const sameText = scroll.points[0].payload?.text || 'skills';
    const freshVector = await embeddingService.getEmbedding(sameText);

    // 3. Compare them
    let dot = 0,
      mag1 = 0,
      mag2 = 0;
    for (let i = 0; i < storedVector.length; i++) {
      dot += storedVector[i] * freshVector[i];
      mag1 += storedVector[i] * storedVector[i];
      mag2 += freshVector[i] * freshVector[i];
    }
    const similarity = dot / (Math.sqrt(mag1) * Math.sqrt(mag2));

    console.log(`📊 Similarity between stored and fresh embedding for the SAME text:`);
    console.log(`   → ${similarity.toFixed(4)}`);

    if (similarity > 0.98) {
      console.log('✅ The model is IDENTICAL. Vectors match perfectly.');
    } else if (similarity > 0.7) {
      console.log('⚠️ The model is SIMILAR but not identical.');
      console.log('   → Run: node scripts/force-reembed.js');
    } else {
      console.log('❌ The model is DIFFERENT. This is your problem.');
      console.log('   → Run: node scripts/force-reembed.js');
    }

    console.log('\n💡 What this means:');
    console.log(`   - If the similarity is < 0.7, you used a different model/version.`);
    console.log(`   - If the similarity is > 0.98, the problem is NOT the embedding model.`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkModelMismatch();
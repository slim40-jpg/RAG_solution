import { embeddingService } from '../src/services/embeddingservice.js';

async function test() {
  console.log('='.repeat(60));
  console.log('🔍 TEST COMPLET');
  console.log('='.repeat(60));

  // Test 1 : embedding direct
  console.log('\n📊 1. Embedding Ollama pour "cinema ar":');
  const embedding = await embeddingService.getEmbedding('cinema ar');
  console.log(`   Dimensions: ${embedding.length}`);
  console.log(`   5 premières: ${embedding.slice(0, 5).join(', ')}`);

  // Test 2 : normalisation
  console.log('\n📊 2. Après normalisation:');
  const normalized = embeddingService.normalizeVector(embedding);
  console.log(`   5 premières: ${normalized.slice(0, 5).join(', ')}`);

  // Test 3 : search()
  console.log('\n📊 3. Search via embeddingService:');
  const results = await embeddingService.search('cinema ar', 3);
  console.log(`   Résultats: ${results.length}`);
  if (results.length > 0) {
    console.log(`   Score: ${results[0].score}`);
    console.log(`   Texte: ${results[0].text?.substring(0, 60)}...`);
  }

  // Test 4 : search direct Qdrant
  console.log('\n📊 4. Search direct Qdrant (sans filtre):');
  const direct = await embeddingService.qdrantClient.search(
    embeddingService.collectionName,
    {
      vector: normalized,
      limit: 3,
      with_payload: true,
    }
  );
  console.log(`   Résultats: ${direct.points?.length || 0}`);
  if (direct.points?.length > 0) {
    console.log(`   Score: ${direct.points[0].score}`);
  }

  console.log('\n' + '='.repeat(60));
}

test().catch(console.error);
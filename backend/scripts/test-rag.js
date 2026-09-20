import { ragService } from '../src/services/ragService.js';
import { embeddingService } from '../src/services/embeddingService.js';
import sequelize from '../src/config/database.js';

async function testRAG() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // TEST 1: Direct Search
    console.log('🔍 TEST 1: Direct Search');
    console.log(`   Collection: ${embeddingService.collectionName}`);

    const searchResults = await embeddingService.search('skills', 10);
    console.log(`   Found ${searchResults.length} results`);

    if (searchResults.length > 0) {
      console.log('   ✅ Search is working!');
      console.log(`   First result: ${searchResults[0].text?.substring(0, 100)}...`);
      console.log(`   Score: ${searchResults[0].score}`);
    } else {
      console.log('   ❌ Search returned no results');

      // Check Qdrant points directly
      console.log('\n📊 Checking Qdrant points directly...');
      try {
        const points = await embeddingService.qdrantClient.scroll(
          embeddingService.collectionName,
          { limit: 2, with_payload: true }
        );
        console.log(`   Points in Qdrant: ${points.points?.length || 0}`);
        if (points.points && points.points.length > 0) {
          console.log(`   Sample text: ${points.points[0].payload?.text?.substring(0, 80)}...`);
          console.log(`   Document ID: ${points.points[0].payload?.documentId}`);
        }
      } catch (e) {
        console.log('   ⚠️ Could not fetch Qdrant points:', e.message);
      }
    }

    // TEST 2: RAG Ask
    console.log('\n' + '='.repeat(50));
    console.log('\n💬 TEST 2: RAG Ask');

    const result = await ragService.ask('What skills does Slim Selmi have?', {}, 10);
    console.log(`   Answer: ${result.answer}`);
    console.log(`   Sources: ${result.sources?.length || 0}`);

    if (result.sources && result.sources.length > 0) {
      console.log('   ✅ RAG is working!');
      result.sources.forEach((s, i) => {
        console.log(`   Source ${i+1}: ${s.title} (Score: ${s.relevanceScore?.toFixed(2) || 'N/A'})`);
      });
    } else {
      console.log('   ❌ RAG returned no sources');
    }

    // TEST 3: Specific Questions
    console.log('\n' + '='.repeat(50));
    console.log('\n📋 TEST 3: Specific Questions');

    const questions = [
      'What is Slim Selmi\'s email?',
      'Where is Slim Selmi located?',
      'What projects has Slim Selmi worked on?'
    ];

    for (const q of questions) {
      console.log(`\n📝 Question: "${q}"`);
      const r = await ragService.ask(q, {}, 5);
      console.log(`   Answer: ${r.answer.substring(0, 150)}...`);
      console.log(`   Sources: ${r.sources?.length || 0}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await sequelize.close();
  }
}

testRAG();
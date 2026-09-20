import { execSync } from 'child_process';

console.log('🚀 Running complete workflow...\n');

// 1. Clear Qdrant
console.log('📊 1. Clearing Qdrant...');
try {
  execSync('curl.exe -X POST "http://localhost:6333/collections/document_archive/points/delete" -H "Content-Type: application/json" -d "{\\"filter\\":{\\"must\\":[]}}"', { stdio: 'inherit' });
} catch (e) {}

// 2. Clear chunks
console.log('\n📊 2. Clearing chunks...');
execSync('psql -U admin -d document_archive -h localhost -c "DELETE FROM document_chunks;"', { stdio: 'inherit' });

// 3. Reset documents
console.log('\n📊 3. Resetting documents...');
execSync('psql -U admin -d document_archive -h localhost -c "UPDATE documents SET status = \'pending\';"', { stdio: 'inherit' });

// 4. Process documents
console.log('\n📊 4. Processing documents...');
execSync('node scripts/process-doc.js', { stdio: 'inherit' });

// 5. Test RAG
console.log('\n📊 5. Testing RAG...');
execSync('node scripts/test-rag.js', { stdio: 'inherit' });

console.log('\n🎉 All done!');
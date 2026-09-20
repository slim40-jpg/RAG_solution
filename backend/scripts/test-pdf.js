import { ocrService } from '../src/services/OCRservice.js';

async function testScannedPDF() {
  try {
    const pdfPath = process.argv[2];
    if (!pdfPath) {
      console.log('Usage: node scripts/test-scanned-pdf.js "path/to/scanned.pdf"');
      return;
    }

    console.log('🔍 Testing scanned PDF OCR...\n');
    const text = await ocrService.extractText(pdfPath);
    
    console.log('\n✅ Extraction complete!');
    console.log(`📊 Characters: ${text.length}`);
    console.log('\n--- First 500 characters ---');
    console.log(text.substring(0, 500));
    console.log('---\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testScannedPDF();
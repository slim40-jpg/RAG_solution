import fs from 'fs';
import path from 'path';
import PDFParser from 'pdf2json';

async function extractCVText() {
  try {
    console.log('📖 Extracting text from CV PDF using pdf2json...');
    
    // Find the PDF file
    const uploadsDir = path.join(process.cwd(), 'uploads', 'general');
    if (!fs.existsSync(uploadsDir)) {
      console.log('⚠️ Uploads directory not found');
      return;
    }

    const files = fs.readdirSync(uploadsDir);
    console.log(`📁 Found ${files.length} files in uploads/general`);
    
    // Find the CV file (using the ID pattern)
    const pdfFile = files.find(f => f.includes('7ef1047b') || f.includes('slim-selmi'));
    if (!pdfFile) {
      console.log('⚠️ CV PDF not found. Files:', files);
      return;
    }

    const pdfPath = path.join(uploadsDir, pdfFile);
    console.log(`📄 Testing PDF: ${pdfPath}`);
    console.log(`📦 File size: ${fs.statSync(pdfPath).size} bytes`);

    const dataBuffer = fs.readFileSync(pdfPath);
    
    const pdfParser = new PDFParser();
    
    return new Promise((resolve, reject) => {
      pdfParser.on('pdfParser_dataError', (errData) => {
        console.error('❌ PDF parsing error:', errData);
        reject(errData);
      });
      
      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        try {
          let text = '';
          if (pdfData && pdfData.Pages) {
            pdfData.Pages.forEach(page => {
              if (page.Texts) {
                page.Texts.forEach(textItem => {
                  if (textItem.R && textItem.R[0] && textItem.R[0].T) {
                    text += decodeURIComponent(textItem.R[0].T) + ' ';
                  }
                });
              }
              text += '\n';
            });
          }
          
          const cleanedText = text.trim();
          console.log(`✅ Extracted ${cleanedText.length} characters from PDF`);
          console.log('\n--- First 500 characters ---');
          console.log(cleanedText.substring(0, 500));
          console.log('---\n');
          
          resolve(cleanedText);
        } catch (error) {
          console.error('❌ PDF processing error:', error);
          reject(error);
        }
      });
      
      pdfParser.parseBuffer(dataBuffer);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

extractCVText();
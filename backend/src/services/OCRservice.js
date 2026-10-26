import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);
const execAsync = promisify(exec);
const unlinkAsync = promisify(fs.unlink);
const rmdirAsync = promisify(fs.rm);

// ✅ CHEMIN ABSOLU VERS PDFTOPPM
const PDFTOPPM_PATH = 'C:\\poppler\\poppler-26.02.0\\Library\\bin\\pdftoppm.exe';

export class OCRService {
  constructor() {
    this.worker = null;
    this.tempDir = path.join(process.cwd(), 'temp');
    this.ensureTempDir();
  }

  async ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      await mkdirAsync(this.tempDir, { recursive: true });
    }
  }

  async initTesseract() {
    if (!this.worker) {
      const Tesseract = await import('tesseract.js');
      this.worker = await Tesseract.createWorker('eng');
      console.log('✅ Tesseract worker initialized');
    }
    return this.worker;
  }

  // ✅ MAIN METHOD: Extract text from any file
  async extractText(filePath) {
    try {
      console.log(`📄 Processing file: ${path.basename(filePath)}`);
      const fileType = this.getFileType(filePath);

      switch (fileType) {
        case 'pdf':
          return await this.extractFromScannedPDF(filePath);
        case 'image':
          return await this.extractFromImage(filePath);
        case 'excel':
          return await this.extractFromExcel(filePath);
        default:
          console.warn(`Unsupported file type: ${fileType}`);
          return '';
      }
    } catch (error) {
      console.error('Extraction failed:', error);
      return '';
    }
  }

  // ✅ FOR SCANNED PDFS: Convert to images → OCR
  async extractFromScannedPDF(pdfPath) {
    console.log('🔄 Processing scanned PDF with OCR...');
    
    try {
      // 1. Create temp directory for images
      const imageDir = path.join(this.tempDir, `pdf_${Date.now()}`);
      await mkdirAsync(imageDir, { recursive: true });

      // 2. Convert PDF to images using pdftoppm (CHEMIN ABSOLU)
      const outputPrefix = path.join(imageDir, 'page');
      
      // ✅ Utiliser le chemin absolu
      const command = `"${PDFTOPPM_PATH}" -png -f 1 -l 10 "${pdfPath}" "${outputPrefix}"`;
      
      console.log('🖼️ Converting PDF to images...');
      console.log(`📦 Command: ${command}`);
      
      try {
        await execAsync(command);
      } catch (error) {
        console.warn('⚠️ pdftoppm failed:', error.message);
        // Try alternative: jpeg
        const altCommand = `"${PDFTOPPM_PATH}" -jpeg -f 1 -l 10 "${pdfPath}" "${outputPrefix}"`;
        await execAsync(altCommand);
      }

      // 3. Find all generated images
      const files = fs.readdirSync(imageDir);
      const imageFiles = files
        .filter(f => f.startsWith('page') && (f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')))
        .sort();

      if (imageFiles.length === 0) {
        console.log('⚠️ No images generated from PDF');
        return '';
      }

      console.log(`🖼️ Found ${imageFiles.length} images from PDF`);

      // 4. Run OCR on each image
      const worker = await this.initTesseract();
      let fullText = '';

      for (let i = 0; i < imageFiles.length; i++) {
        const imagePath = path.join(imageDir, imageFiles[i]);
        console.log(`📄 OCRing page ${i + 1}/${imageFiles.length}...`);
        
        try {
          const imageBuffer = await readFileAsync(imagePath);
          const { data: { text } } = await worker.recognize(imageBuffer);
          fullText += `\n--- Page ${i + 1} ---\n${text || ''}\n`;
        } catch (error) {
          console.warn(`⚠️ OCR failed for page ${i + 1}:`, error.message);
        }

        // Clean up image file
        try {
          await unlinkAsync(imagePath);
        } catch (e) { /* ignore */ }
      }

      // 5. Clean up temp directory
      try {
        await rmdirAsync(imageDir, { recursive: true });
      } catch (e) { /* ignore */ }

      console.log(`✅ Extracted ${fullText.length} characters from scanned PDF`);
      return fullText;

    } catch (error) {
      console.error('❌ Scanned PDF OCR failed:', error);
      return '';
    }
  }

  // ✅ FOR IMAGES: Direct OCR
  async extractFromImage(filePath) {
    try {
      console.log('🖼️ Running OCR on image...');
      const imageBuffer = await readFileAsync(filePath);
      const worker = await this.initTesseract();
      const { data: { text } } = await worker.recognize(imageBuffer);
      return text || '';
    } catch (error) {
      console.error('Image OCR failed:', error);
      return '';
    }
  }

  // ✅ FOR EXCEL: Simple extraction
  async extractFromExcel(filePath) {
    try {
      console.log('📊 Extracting text from Excel...');
      const fileBuffer = await readFileAsync(filePath);
      const xlsx = await import('xlsx');
      const workbook = xlsx.read(fileBuffer, { type: "buffer" });
      
      let extractedText = "";
      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: ""
        });
        extractedText += `Sheet: ${sheetName}\n`;
        rows.forEach((row) => {
          extractedText += row.join(" ") + "\n";
        });
        extractedText += "\n";
      });
      
      return extractedText;
    } catch (error) {
      console.error('Excel extraction failed:', error);
      return '';
    }
  }

  getFileType(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif'];
    const pdfExtensions = ['pdf'];
    const excelExtensions = ['xls', 'xlsx', 'csv'];
    
    if (imageExtensions.includes(ext)) return 'image';
    if (pdfExtensions.includes(ext)) return 'pdf';
    if (excelExtensions.includes(ext)) return 'excel';
    return 'unknown';
  }

  async cleanup() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
    try {
      if (fs.existsSync(this.tempDir)) {
        await rmdirAsync(this.tempDir, { recursive: true });
      }
    } catch (e) { /* ignore */ }
  }
}

export const ocrService = new OCRService();
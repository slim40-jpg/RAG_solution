import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const unlinkAsync = promisify(fs.unlink);
const readFileAsync = promisify(fs.readFile);

export class StorageService {
  constructor() {
    this.storageType = process.env.STORAGE_TYPE || 'local';
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
  }

  async saveFile(file, departmentId = 'general') {
    // File is already saved by multer
    // We just return the path and metadata
    return {
      path: file.path,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype
    };
  }

  async getFile(filePath) {
    try {
      const fullPath = path.join(process.cwd(), filePath);
      const data = await readFileAsync(fullPath);
      return data;
    } catch (error) {
      throw new Error(`File not found: ${filePath}`);
    }
  }

  async deleteFile(filePath) {
    try {
      const fullPath = path.join(process.cwd(), filePath);
      await unlinkAsync(fullPath);
      return true;
    } catch (error) {
      console.error(`Failed to delete file: ${filePath}`, error);
      return false;
    }
  }

  getFileExtension(filename) {
    return path.extname(filename).toLowerCase();
  }

  getFileType(mimeType) {
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'word';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'excel';
    if (mimeType.includes('image')) return 'image';
    return 'other';
  }
}

export const storageService = new StorageService();
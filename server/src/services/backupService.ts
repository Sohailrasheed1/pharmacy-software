import fs from 'node:fs';
import path from 'node:path';
import { DB_PATH } from '../config/database.js';

export class BackupService {
  private backupDir: string;

  constructor(customBackupDir?: string) {
    this.backupDir = customBackupDir || path.resolve(process.cwd(), 'backups');
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Create an instant snapshot copy of the SQLite database
   */
  public createBackupNow(label: string = 'manual'): { success: boolean; filePath: string; fileName: string; sizeBytes: number } {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `pharmacy_backup_${label}_${timestamp}.db`;
    const destinationPath = path.join(this.backupDir, fileName);

    if (!fs.existsSync(DB_PATH)) {
      throw new Error(`Database file not found at ${DB_PATH}`);
    }

    fs.copyFileSync(DB_PATH, destinationPath);
    const stats = fs.statSync(destinationPath);

    return {
      success: true,
      filePath: destinationPath,
      fileName,
      sizeBytes: stats.size
    };
  }

  /**
   * List available local backups
   */
  public listBackups() {
    if (!fs.existsSync(this.backupDir)) return [];
    const files = fs.readdirSync(this.backupDir).filter(f => f.endsWith('.db'));
    return files.map(file => {
      const fullPath = path.join(this.backupDir, file);
      const stat = fs.statSync(fullPath);
      return {
        fileName: file,
        sizeBytes: stat.size,
        createdAt: stat.mtime.toISOString()
      };
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

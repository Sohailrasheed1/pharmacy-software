import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DB_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

export const DB_PATH = path.join(DB_DIR, 'pharmacy.db');

export interface DbWrapper {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: any[]): { lastInsertRowid: number | bigint; changes: number | bigint };
    get(...params: any[]): any;
    all(...params: any[]): any[];
  };
  transaction<T>(fn: () => T): () => T;
  close(): void;
}

export function createDbConnection(dbFilePath: string = DB_PATH): DbWrapper {
  const sqlite = new DatabaseSync(dbFilePath);
  
  // Pragmas for WAL, speed & crash-proofing
  sqlite.exec('PRAGMA journal_mode = WAL;');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec('PRAGMA synchronous = NORMAL;');

  return {
    exec: (sql: string) => sqlite.exec(sql),
    prepare: (sql: string) => {
      const stmt = sqlite.prepare(sql);
      return {
        run: (...params: any[]) => stmt.run(...params),
        get: (...params: any[]) => stmt.get(...params),
        all: (...params: any[]) => stmt.all(...params)
      };
    },
    transaction: <T>(fn: () => T) => {
      return () => {
        let inTransaction = false;
        try {
          sqlite.exec('BEGIN TRANSACTION;');
          inTransaction = true;
        } catch {
          // If transaction is already active, create a SAVEPOINT
          const spName = `sp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          sqlite.exec(`SAVEPOINT ${spName};`);
          try {
            const res = fn();
            sqlite.exec(`RELEASE SAVEPOINT ${spName};`);
            return res;
          } catch (err) {
            sqlite.exec(`ROLLBACK TO SAVEPOINT ${spName};`);
            throw err;
          }
        }

        if (inTransaction) {
          try {
            const res = fn();
            sqlite.exec('COMMIT;');
            return res;
          } catch (err) {
            sqlite.exec('ROLLBACK;');
            throw err;
          }
        }

        return fn();
      };
    },
    close: () => sqlite.close()
  };
}

export const db = createDbConnection();

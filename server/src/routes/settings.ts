import { Router } from 'express';
import { db } from '../config/database.js';
import { BackupService } from '../services/backupService.js';

export const settingsRouter = Router();
const backupService = new BackupService();

// GET /api/settings - get shop settings
settingsRouter.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM settings').all() as any[];
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value;
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings - update settings
settingsRouter.post('/', (req, res) => {
  try {
    const entries = Object.entries(req.body);
    const stmt = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    for (const [key, val] of entries) {
      stmt.run(key, String(val));
    }
    res.json({ message: 'Settings updated' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings/backup - trigger manual backup now
settingsRouter.post('/backup', (req, res) => {
  try {
    const backup = backupService.createBackupNow('manual');
    res.json(backup);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/backups - list all backups
settingsRouter.get('/backups', (req, res) => {
  try {
    const backups = backupService.listBackups();
    res.json(backups);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/audit-logs - get audit trail
settingsRouter.get('/audit-logs', (req, res) => {
  try {
    const logs = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 50').all();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/users - get users list
settingsRouter.get('/users', (req, res) => {
  try {
    const users = db.prepare('SELECT id, username, role, name, created_at FROM users').all();
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

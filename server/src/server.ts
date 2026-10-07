import express from 'express';
import cors from 'cors';
import { runMigrations } from './db/migrate.js';
import { itemsRouter } from './routes/items.js';
import { stockRouter } from './routes/stock.js';
import { salesRouter } from './routes/sales.js';
import { customersRouter } from './routes/customers.js';

import { purchasesRouter } from './routes/purchases.js';
import { reportsRouter } from './routes/reports.js';
import { settingsRouter } from './routes/settings.js';
import { authRouter } from './routes/auth.js';
import { BackupService } from './services/backupService.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Auto-run migrations on start
runMigrations();

// Scheduled Daily Automatic SQLite Backup (runs every 24 hours)
const backupService = new BackupService();
try {
  backupService.createBackupNow('daily_boot');
} catch (e) {
  console.error('Initial backup warning:', e);
}
setInterval(() => {
  try {
    backupService.createBackupNow('daily_auto');
    console.log('Daily automatic backup created successfully.');
  } catch (err) {
    console.error('Daily automatic backup failed:', err);
  }
}, 24 * 60 * 60 * 1000);

// API routes
app.use('/api/items', itemsRouter);
app.use('/api/stock', stockRouter);
app.use('/api/sales', salesRouter);
app.use('/api/customers', customersRouter);
app.use('/api/purchases', purchasesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/auth', authRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Pharmacy server running locally at http://localhost:${PORT}`);
});

export default app;

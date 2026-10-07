import { Router } from 'express';
import { db } from '../config/database.js';
import { StockService } from '../services/stockService.js';

export const stockRouter = Router();
const stockService = new StockService(db);

// GET /api/stock - get stock list filtered by near expiry, expired, low stock, search
stockRouter.get('/', (req, res) => {
  try {
    const search = req.query.search ? String(req.query.search) : undefined;
    const status = (req.query.status as any) || 'all';

    const list = stockService.getStockList({ search, status });
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/stock/stats - dashboard summary metrics
stockRouter.get('/stats', (req, res) => {
  try {
    const today = new Date();
    const currentYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const d90 = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
    const nearYM = `${d90.getFullYear()}-${String(d90.getMonth() + 1).padStart(2, '0')}`;

    // Near / Expired count
    const expOrNearCount = db.prepare(`
      SELECT COUNT(*) as count 
      FROM batches 
      WHERE expiry_date <= ? AND quantity_units > 0
    `).get(nearYM) as { count: number };

    // Low stock count
    const lowStockCount = db.prepare(`
      SELECT COUNT(DISTINCT i.id) as count
      FROM items i
      JOIN batches b ON i.id = b.item_id
      GROUP BY i.id
      HAVING SUM(b.quantity_units) <= (i.reorder_level * i.pack_size)
    `).all().length;

    // Udhaar to collect
    const udhaarTotal = db.prepare(`
      SELECT COALESCE(SUM(current_baqaya_paisa), 0) as total
      FROM customers
    `).get() as { total: number };

    res.json({
      nearOrExpiredBatches: expOrNearCount?.count || 0,
      lowStockItems: lowStockCount,
      totalUdhaarPaisa: udhaarTotal?.total || 0
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/stock/batches - add new batch or top-up batch
stockRouter.post('/batches', (req, res) => {
  try {
    const {
      item_id,
      batch_number,
      expiry_date, // YYYY-MM
      quantity_units,
      purchase_rate_paisa,
      sale_rate_paisa,
      notes
    } = req.body;

    if (!item_id || !batch_number || !expiry_date) {
      return res.status(400).json({ error: 'Item, batch number, and expiry date are required.' });
    }

    // Check if batch already exists for this item
    let batch = db.prepare('SELECT * FROM batches WHERE item_id = ? AND batch_number = ?').get(item_id, batch_number) as any;

    let batchId: number;
    if (batch) {
      batchId = batch.id;
      // Update rates if provided
      db.prepare(`
        UPDATE batches 
        SET purchase_rate_paisa = ?, sale_rate_paisa = ?, expiry_date = ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(purchase_rate_paisa ?? batch.purchase_rate_paisa, sale_rate_paisa ?? batch.sale_rate_paisa, expiry_date, batchId);
    } else {
      const insertResult = db.prepare(`
        INSERT INTO batches 
          (item_id, batch_number, expiry_date, quantity_units, purchase_rate_paisa, sale_rate_paisa)
        VALUES 
          (?, ?, ?, 0, ?, ?)
      `).run(item_id, batch_number, expiry_date, purchase_rate_paisa || 0, sale_rate_paisa || 0);
      batchId = Number(insertResult.lastInsertRowid);
    }

    // If initial quantity given, adjust stock via central service
    if (quantity_units && quantity_units > 0) {
      stockService.changeStock({
        batchId,
        movementType: 'ADJUSTMENT',
        quantityChangeUnits: Number(quantity_units),
        referenceType: 'batch_entry',
        notes: notes || 'New batch stock entry'
      });
    }

    res.status(201).json({ batchId, message: 'Batch saved successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/stock/adjust - manual stock adjustment (audited)
stockRouter.post('/adjust', (req, res) => {
  try {
    const { batch_id, quantity_change, notes } = req.body;
    if (!batch_id || quantity_change === undefined) {
      return res.status(400).json({ error: 'batch_id and quantity_change are required.' });
    }

    const result = stockService.changeStock({
      batchId: Number(batch_id),
      movementType: 'ADJUSTMENT',
      quantityChangeUnits: Number(quantity_change),
      referenceType: 'manual_adjustment',
      notes: notes || 'Manual stock adjustment'
    });

    res.json({ message: 'Stock adjusted successfully', result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

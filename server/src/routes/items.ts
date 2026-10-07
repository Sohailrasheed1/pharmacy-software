import { Router } from 'express';
import { db } from '../config/database.js';
import { StockService } from '../services/stockService.js';

export const itemsRouter = Router();
const stockService = new StockService(db);

// GET /api/items - list items with current stock count & batches
itemsRouter.get('/', (req, res) => {
  try {
    const search = req.query.search ? String(req.query.search).trim() : '';
    let sql = `
      SELECT 
        i.*,
        COALESCE(SUM(b.quantity_units), 0) as total_units_in_stock,
        COALESCE(
          (SELECT sale_rate_paisa FROM batches WHERE item_id = i.id AND quantity_units > 0 ORDER BY expiry_date ASC LIMIT 1),
          (SELECT sale_rate_paisa FROM batches WHERE item_id = i.id ORDER BY id DESC LIMIT 1),
          0
        ) as sale_rate_paisa
      FROM items i
      LEFT JOIN batches b ON i.id = b.item_id
    `;
    const params: any[] = [];
    if (search) {
      sql += ` WHERE LOWER(i.name) LIKE ? OR LOWER(COALESCE(i.generic_name, '')) LIKE ? OR LOWER(i.company) LIKE ? OR i.barcode = ?`;
      const s = `%${search.toLowerCase()}%`;
      params.push(s, s, s, search);
    }
    sql += ` GROUP BY i.id ORDER BY i.name ASC`;
    const items = db.prepare(sql).all(...params);
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/items/:id - item details with all batches
itemsRouter.get('/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    const batches = db.prepare('SELECT * FROM batches WHERE item_id = ? ORDER BY expiry_date ASC').all(req.params.id);
    res.json({ item, batches });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/items - create new item
itemsRouter.post('/', (req, res) => {
  try {
    const {
      name,
      generic_name,
      company,
      form,
      pack_size = 1,
      loose_price_paisa = null,
      barcode = null,
      reorder_level = 10,
      is_controlled = 0
    } = req.body;

    if (!name || !company || !form) {
      return res.status(400).json({ error: 'Name, company, and form are required.' });
    }

    const stmt = db.prepare(`
      INSERT INTO items 
        (name, generic_name, company, form, pack_size, loose_price_paisa, barcode, reorder_level, is_controlled)
      VALUES 
        (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      name.trim(),
      generic_name?.trim() || null,
      company.trim(),
      form.trim(),
      Number(pack_size) || 1,
      loose_price_paisa ? Number(loose_price_paisa) : null,
      barcode?.trim() || null,
      Number(reorder_level) || 10,
      is_controlled ? 1 : 0
    );

    res.status(201).json({ id: result.lastInsertRowid, message: 'Item created successfully' });
  } catch (error: any) {
    if (error.message.includes('UNIQUE constraint failed: items.barcode')) {
      return res.status(400).json({ error: 'Barcode already registered with another item.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/items/:id - update item with pack_size protection guard
itemsRouter.put('/:id', (req, res) => {
  try {
    const itemId = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const {
      name,
      generic_name,
      company,
      form,
      pack_size,
      loose_price_paisa,
      barcode,
      reorder_level,
      is_controlled
    } = req.body;

    // Check pack_size guard if pack_size changed
    if (pack_size !== undefined && Number(pack_size) !== existing.pack_size) {
      const guard = stockService.canUpdateItemPackSize(itemId);
      if (!guard.allowed) {
        return res.status(400).json({ error: guard.reason });
      }
    }

    db.prepare(`
      UPDATE items SET
        name = COALESCE(?, name),
        generic_name = COALESCE(?, generic_name),
        company = COALESCE(?, company),
        form = COALESCE(?, form),
        pack_size = COALESCE(?, pack_size),
        loose_price_paisa = ?,
        barcode = ?,
        reorder_level = COALESCE(?, reorder_level),
        is_controlled = COALESCE(?, is_controlled),
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      name?.trim(),
      generic_name?.trim(),
      company?.trim(),
      form?.trim(),
      pack_size ? Number(pack_size) : null,
      loose_price_paisa !== undefined ? loose_price_paisa : existing.loose_price_paisa,
      barcode !== undefined ? barcode : existing.barcode,
      reorder_level !== undefined ? Number(reorder_level) : null,
      is_controlled !== undefined ? (is_controlled ? 1 : 0) : null,
      itemId
    );

    res.json({ message: 'Item updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

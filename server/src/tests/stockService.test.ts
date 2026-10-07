import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createDbConnection, DbWrapper } from '../config/database.js';
import { StockService } from '../services/stockService.js';
import fs from 'node:fs';
import path from 'node:path';

describe('StockService & Inventory Business Logic', () => {
  let db: DbWrapper;
  let stockService: StockService;
  const testDbPath = path.resolve(process.cwd(), 'data', 'test_pharmacy.db');

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
    db = createDbConnection(testDbPath);
    db.exec(`
      CREATE TABLE items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        generic_name TEXT,
        company TEXT NOT NULL,
        form TEXT NOT NULL,
        pack_size INTEGER NOT NULL DEFAULT 1,
        loose_price_paisa INTEGER,
        barcode TEXT,
        reorder_level INTEGER NOT NULL DEFAULT 10,
        is_controlled INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL,
        batch_number TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        quantity_units INTEGER NOT NULL DEFAULT 0,
        purchase_rate_paisa INTEGER NOT NULL DEFAULT 0,
        sale_rate_paisa INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batch_id INTEGER NOT NULL,
        movement_type TEXT NOT NULL,
        quantity_change INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        reference_type TEXT,
        reference_id INTEGER,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    stockService = new StockService(db);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
  });

  describe('Central Stock Movement Ledger', () => {
    it('should add stock and create a stock_movement audit record', () => {
      const bRes = db.prepare(`
        INSERT INTO batches (item_id, batch_number, expiry_date, quantity_units, purchase_rate_paisa, sale_rate_paisa)
        VALUES (1, 'BATCH01', '2026-12', 0, 1000, 1500)
      `).run();
      const batchId = Number(bRes.lastInsertRowid);

      const result = stockService.changeStock({
        batchId,
        movementType: 'PURCHASE',
        quantityChangeUnits: 50,
        notes: 'GRN received'
      });

      assert.equal(result.newBalance, 50);

      const batch = db.prepare('SELECT quantity_units FROM batches WHERE id = ?').get(batchId) as any;
      assert.equal(batch.quantity_units, 50);

      const movement = db.prepare('SELECT * FROM stock_movements WHERE id = ?').get(result.movementId) as any;
      assert.equal(movement.movement_type, 'PURCHASE');
      assert.equal(movement.quantity_change, 50);
      assert.equal(movement.balance_after, 50);
      assert.equal(movement.notes, 'GRN received');
    });

    it('should deduct stock on sale and prevent negative inventory', () => {
      const bRes = db.prepare(`
        INSERT INTO batches (item_id, batch_number, expiry_date, quantity_units, purchase_rate_paisa, sale_rate_paisa)
        VALUES (1, 'BATCH01', '2026-12', 20, 1000, 1500)
      `).run();
      const batchId = Number(bRes.lastInsertRowid);

      const result = stockService.changeStock({
        batchId,
        movementType: 'SALE',
        quantityChangeUnits: -15,
        referenceType: 'sale',
        referenceId: 101
      });

      assert.equal(result.newBalance, 5);

      assert.throws(() => {
        stockService.changeStock({
          batchId,
          movementType: 'SALE',
          quantityChangeUnits: -10
        });
      }, /Insufficient stock/);

      const batch = db.prepare('SELECT quantity_units FROM batches WHERE id = ?').get(batchId) as any;
      assert.equal(batch.quantity_units, 5);
    });
  });

  describe('Loose-Unit Pricing Rules', () => {
    it('calculates loose price rounded to whole rupee when no override is set', () => {
      const price1 = stockService.calculateLoosePricePaisa(4000, 10);
      assert.equal(price1, 400);

      const price2 = stockService.calculateLoosePricePaisa(76000, 6);
      assert.equal(price2, 12667);
    });

    it('uses loose_price override when configured on item', () => {
      const price = stockService.calculateLoosePricePaisa(76000, 6, 13000);
      assert.equal(price, 13000);
    });

    it('returns pack rate for items with pack_size 1 (syrups, bottles, sachets)', () => {
      const price = stockService.calculateLoosePricePaisa(12000, 1);
      assert.equal(price, 12000);
    });
  });

  describe('Pack Size Modification Guard', () => {
    it('blocks modifying pack size if item has batches with active stock', () => {
      const iRes = db.prepare(`
        INSERT INTO items (name, company, form, pack_size) VALUES ('Panadol', 'GSK', 'tablet', 10)
      `).run();
      const itemId = Number(iRes.lastInsertRowid);

      db.prepare(`
        INSERT INTO batches (item_id, batch_number, expiry_date, quantity_units)
        VALUES (?, 'B1', '2026-12', 50)
      `).run(itemId);

      const check = stockService.canUpdateItemPackSize(itemId);
      assert.equal(check.allowed, false);
      assert.match(check.reason || '', /existing active stock/);
    });

    it('permits modifying pack size if item has 0 stock', () => {
      const iRes = db.prepare(`
        INSERT INTO items (name, company, form, pack_size) VALUES ('New Medicine', 'GSK', 'tablet', 10)
      `).run();
      const itemId = Number(iRes.lastInsertRowid);

      const check = stockService.canUpdateItemPackSize(itemId);
      assert.equal(check.allowed, true);
    });
  });

  describe('Unit Formatter (Packs + Loose display)', () => {
    it('formats base units into packs and loose units', () => {
      assert.equal(StockService.formatPackLoose(25, 10), '2 strips + 5 loose');
      assert.equal(StockService.formatPackLoose(30, 10), '3 strips');
      assert.equal(StockService.formatPackLoose(4, 10), '4 loose');
      assert.equal(StockService.formatPackLoose(5, 1, 'bottle'), '5 bottles');
    });
  });
});

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createDbConnection, DbWrapper } from '../config/database.js';
import { SaleService } from '../services/saleService.js';
import fs from 'node:fs';
import path from 'node:path';

describe('SaleService - POS, FEFO, Loose Sales & Returns', () => {
  let db: DbWrapper;
  let saleService: SaleService;
  const testDbPath = path.resolve(process.cwd(), 'data', 'test_pos_pharmacy.db');

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

      CREATE TABLE customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        current_baqaya_paisa INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_number TEXT NOT NULL UNIQUE,
        customer_id INTEGER,
        payment_type TEXT NOT NULL DEFAULT 'Cash',
        subtotal_paisa INTEGER NOT NULL,
        discount_paisa INTEGER NOT NULL DEFAULT 0,
        total_paisa INTEGER NOT NULL,
        paid_paisa INTEGER NOT NULL,
        change_paisa INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'COMPLETED',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        batch_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        is_loose INTEGER NOT NULL DEFAULT 0,
        quantity_units INTEGER NOT NULL,
        unit_price_paisa INTEGER NOT NULL,
        total_paisa INTEGER NOT NULL
      );

      CREATE TABLE audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        entity_name TEXT NOT NULL,
        entity_id INTEGER,
        details TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    saleService = new SaleService(db);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
  });

  it('FEFO deduction: sells from earliest expiry batch first', () => {
    // Item: Panadol (pack_size 10)
    const itemRes = db.prepare(`
      INSERT INTO items (name, company, form, pack_size) VALUES ('Panadol 500mg', 'GSK', 'tablet', 10)
    `).run();
    const itemId = Number(itemRes.lastInsertRowid);

    // Batch 1: Expiry 2026-11 (Earliest), 15 tablets
    const b1Res = db.prepare(`
      INSERT INTO batches (item_id, batch_number, expiry_date, quantity_units, sale_rate_paisa)
      VALUES (?, 'BATCH-EARLY', '2026-11', 15, 4000)
    `).run(itemId);
    const batch1Id = Number(b1Res.lastInsertRowid);

    // Batch 2: Expiry 2027-05 (Later), 50 tablets
    const b2Res = db.prepare(`
      INSERT INTO batches (item_id, batch_number, expiry_date, quantity_units, sale_rate_paisa)
      VALUES (?, 'BATCH-LATE', '2027-05', 50, 4000)
    `).run(itemId);
    const batch2Id = Number(b2Res.lastInsertRowid);

    // Sell 2 strips = 20 tablets
    const saleResult = saleService.processSale({
      items: [{ itemId, isLoose: false, quantity: 2 }],
      paymentType: 'Cash'
    });

    assert.ok(saleResult.saleId > 0);
    assert.match(saleResult.billNumber, /^INV-/);

    // Batch 1 should be completely exhausted (15 deducted => 0 left)
    const b1 = db.prepare('SELECT quantity_units FROM batches WHERE id = ?').get(batch1Id) as any;
    assert.equal(b1.quantity_units, 0);

    // Batch 2 should have 5 deducted (50 - 5 = 45 left)
    const b2 = db.prepare('SELECT quantity_units FROM batches WHERE id = ?').get(batch2Id) as any;
    assert.equal(b2.quantity_units, 45);

    // Verify stock_movements recorded
    const movements = db.prepare('SELECT * FROM stock_movements WHERE reference_type = ?').all('sale') as any[];
    assert.equal(movements.length, 2);
  });

  it('Never sells an expired batch: blocks checkout with clear message', () => {
    const itemRes = db.prepare(`
      INSERT INTO items (name, company, form, pack_size) VALUES ('Arinac Forte', 'Abbott', 'tablet', 10)
    `).run();
    const itemId = Number(itemRes.lastInsertRowid);

    // Expired Batch in 2024-01
    db.prepare(`
      INSERT INTO batches (item_id, batch_number, expiry_date, quantity_units, sale_rate_paisa)
      VALUES (?, 'EXPIRED-BATCH', '2024-01', 20, 8000)
    `).run(itemId);

    assert.throws(() => {
      saleService.processSale({
        items: [{ itemId, isLoose: false, quantity: 1 }],
        paymentType: 'Cash'
      });
    }, /Cannot sell 'Arinac Forte': All remaining stock has expired/);
  });

  it('Loose tablet sale pricing & deduction', () => {
    // Augmentin pack of 6 tabs, pack price Rs 760 (76000 paisa)
    // loose price = 76000 / 6 = 12667 paisa (~Rs 127)
    const itemRes = db.prepare(`
      INSERT INTO items (name, company, form, pack_size) VALUES ('Augmentin 625mg', 'GSK', 'tablet', 6)
    `).run();
    const itemId = Number(itemRes.lastInsertRowid);

    const bRes = db.prepare(`
      INSERT INTO batches (item_id, batch_number, expiry_date, quantity_units, sale_rate_paisa)
      VALUES (?, 'AG9921', '2027-01', 30, 76000)
    `).run(itemId);
    const batchId = Number(bRes.lastInsertRowid);

    // Sell 3 loose tablets
    const saleResult = saleService.processSale({
      items: [{ itemId, isLoose: true, quantity: 3 }],
      paymentType: 'Cash'
    });

    // 3 * 12667 = 38001 paisa
    assert.equal(saleResult.subtotalPaisa, 38001);

    // 3 tablets deducted from batch (30 - 3 = 27)
    const b = db.prepare('SELECT quantity_units FROM batches WHERE id = ?').get(batchId) as any;
    assert.equal(b.quantity_units, 27);
  });

  it('Udhaar sale correctly links and updates customer khata baqaya', () => {
    const custRes = db.prepare(`
      INSERT INTO customers (name, phone, current_baqaya_paisa) VALUES ('Bushra Bibi', '0321 7654321', 10000)
    `).run();
    const customerId = Number(custRes.lastInsertRowid);

    const itemRes = db.prepare(`
      INSERT INTO items (name, company, form, pack_size) VALUES ('Brufen 400mg', 'Abbott', 'tablet', 10)
    `).run();
    const itemId = Number(itemRes.lastInsertRowid);

    db.prepare(`
      INSERT INTO batches (item_id, batch_number, expiry_date, quantity_units, sale_rate_paisa)
      VALUES (?, 'BR1187', '2027-01', 50, 9500)
    `).run(itemId);

    // Sell 2 strips on Udhaar (2 * 9500 = 19000 paisa / Rs 190)
    const sale = saleService.processSale({
      items: [{ itemId, isLoose: false, quantity: 2 }],
      paymentType: 'Udhaar',
      customerId
    });

    assert.equal(sale.totalPaisa, 19000);

    // Customer baqaya must now be 10000 + 19000 = 29000 paisa
    const customer = db.prepare('SELECT current_baqaya_paisa FROM customers WHERE id = ?').get(customerId) as any;
    assert.equal(customer.current_baqaya_paisa, 29000);
  });

  it('Sale return restores stock to the same batch and reverses amount', () => {
    const itemRes = db.prepare(`
      INSERT INTO items (name, company, form, pack_size) VALUES ('Panadol', 'GSK', 'tablet', 10)
    `).run();
    const itemId = Number(itemRes.lastInsertRowid);

    const bRes = db.prepare(`
      INSERT INTO batches (item_id, batch_number, expiry_date, quantity_units, sale_rate_paisa)
      VALUES (?, 'B01', '2027-01', 50, 4000)
    `).run(itemId);
    const batchId = Number(bRes.lastInsertRowid);

    // Sell 20 tablets (2 strips)
    const sale = saleService.processSale({
      items: [{ itemId, isLoose: false, quantity: 2 }],
      paymentType: 'Cash'
    });

    const bAfterSale = db.prepare('SELECT quantity_units FROM batches WHERE id = ?').get(batchId) as any;
    assert.equal(bAfterSale.quantity_units, 30);

    // Fetch sale item ID
    const saleItem = db.prepare('SELECT id FROM sale_items WHERE sale_id = ?').get(sale.saleId) as any;

    // Return 10 tablets (1 strip of Rs 40 = 4000 paisa)
    const returnRes = saleService.processSaleReturn(sale.saleId, [
      { saleItemId: saleItem.id, quantityUnitsToReturn: 10 }
    ]);

    assert.equal(returnRes.totalRefundPaisa, 4000);

    // Stock should be restored: 30 + 10 = 40
    const bAfterReturn = db.prepare('SELECT quantity_units FROM batches WHERE id = ?').get(batchId) as any;
    assert.equal(bAfterReturn.quantity_units, 40);

    // Check return stock movement in audit ledger
    const returnMovement = db.prepare(`
      SELECT * FROM stock_movements WHERE movement_type = 'RETURN_SALE'
    `).get() as any;
    assert.ok(returnMovement);
    assert.equal(returnMovement.quantity_change, 10);
  });
});

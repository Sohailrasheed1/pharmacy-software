import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createDbConnection, DbWrapper } from '../config/database.js';
import { PurchaseService } from '../services/purchaseService.js';
import fs from 'node:fs';
import path from 'node:path';

describe('PurchaseService - GRN, Supplier Ledger & Expiry Returns', () => {
  let db: DbWrapper;
  let purchaseService: PurchaseService;
  const testDbPath = path.resolve(process.cwd(), 'data', 'test_purchases_pharmacy.db');

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

      CREATE TABLE suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        company_name TEXT,
        phone TEXT,
        address TEXT,
        balance_paisa INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER NOT NULL,
        invoice_number TEXT NOT NULL,
        invoice_date TEXT NOT NULL,
        total_amount_paisa INTEGER NOT NULL,
        paid_amount_paisa INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'COMPLETED',
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE purchase_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchase_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        batch_id INTEGER NOT NULL,
        batch_number TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        quantity_packs INTEGER NOT NULL,
        total_units INTEGER NOT NULL,
        purchase_rate_paisa INTEGER NOT NULL,
        sale_rate_paisa INTEGER NOT NULL,
        total_amount_paisa INTEGER NOT NULL
      );

      CREATE TABLE supplier_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER NOT NULL,
        purchase_id INTEGER,
        payment_date TEXT NOT NULL,
        amount_paisa INTEGER NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'Cash',
        reference_number TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE supplier_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER NOT NULL,
        batch_id INTEGER NOT NULL,
        quantity_units INTEGER NOT NULL,
        refund_amount_paisa INTEGER NOT NULL,
        reason TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    purchaseService = new PurchaseService(db);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
  });

  it('creates purchase entry (GRN), creates batch, adds stock, and updates supplier balance', () => {
    // 1. Supplier: Al-Fateh
    const suppRes = db.prepare(`
      INSERT INTO suppliers (name, balance_paisa) VALUES ('Al-Fateh Distributors', 0)
    `).run();
    const supplierId = Number(suppRes.lastInsertRowid);

    // 2. Item: Panadol
    const itemRes = db.prepare(`
      INSERT INTO items (name, company, form, pack_size) VALUES ('Panadol 500mg', 'GSK', 'tablet', 10)
    `).run();
    const itemId = Number(itemRes.lastInsertRowid);

    // 3. Receive GRN: 20 packs @ Rs 32 (3200 paisa), sale @ Rs 40 (4000 paisa)
    // Total = 20 * 3200 = 64000 paisa (Rs 640), paid 20000 paisa (Rs 200)
    const result = purchaseService.createPurchase({
      supplierId,
      invoiceNumber: 'INV-AF-991',
      items: [{
        itemId,
        batchNumber: 'PN9901',
        expiryDate: '2027-08',
        quantityPacks: 20,
        purchaseRatePaisa: 3200,
        saleRatePaisa: 4000
      }],
      paidAmountPaisa: 20000
    });

    assert.equal(result.totalAmountPaisa, 64000);
    assert.equal(result.netPayablePaisa, 44000);

    // Verify batch created with 200 units (20 packs * 10)
    const batch = db.prepare('SELECT * FROM batches WHERE item_id = ?').get(itemId) as any;
    assert.equal(batch.batch_number, 'PN9901');
    assert.equal(batch.quantity_units, 200);

    // Verify stock_movements audit record
    const movement = db.prepare(`
      SELECT * FROM stock_movements WHERE reference_type = 'purchase'
    `).get() as any;
    assert.equal(movement.movement_type, 'PURCHASE');
    assert.equal(movement.quantity_change, 200);

    // Verify supplier balance increased by net unpaid 44000 paisa
    const supplier = db.prepare('SELECT balance_paisa FROM suppliers WHERE id = ?').get(supplierId) as any;
    assert.equal(supplier.balance_paisa, 44000);
  });

  it('records payment to supplier and reduces payable ledger balance', () => {
    const suppRes = db.prepare(`
      INSERT INTO suppliers (name, balance_paisa) VALUES ('Medico Traders', 100000)
    `).run();
    const supplierId = Number(suppRes.lastInsertRowid);

    // Pay Rs 600 (60000 paisa)
    const payRes = purchaseService.recordSupplierPayment({
      supplierId,
      amountPaisa: 60000,
      paymentMethod: 'Cash',
      notes: 'Weekly clearance'
    });

    assert.equal(payRes.newBalancePaisa, 40000);

    const supplier = db.prepare('SELECT balance_paisa FROM suppliers WHERE id = ?').get(supplierId) as any;
    assert.equal(supplier.balance_paisa, 40000);
  });

  it('returns near-expiry batch to distributor: reduces stock and reduces amount owed', () => {
    const suppRes = db.prepare(`
      INSERT INTO suppliers (name, balance_paisa) VALUES ('Sehat Link', 50000)
    `).run();
    const supplierId = Number(suppRes.lastInsertRowid);

    const itemRes = db.prepare(`
      INSERT INTO items (name, company, form, pack_size) VALUES ('Calpol', 'GSK', 'bottle', 1)
    `).run();
    const itemId = Number(itemRes.lastInsertRowid);

    const bRes = db.prepare(`
      INSERT INTO batches (item_id, batch_number, expiry_date, quantity_units, purchase_rate_paisa)
      VALUES (?, 'CP-EXP', '2026-11', 10, 1000)
    `).run(itemId);
    const batchId = Number(bRes.lastInsertRowid);

    // Return 5 bottles to distributor @ Rs 10 each = 5000 paisa refund
    purchaseService.returnBatchToSupplier({
      supplierId,
      batchId,
      quantityUnits: 5,
      refundAmountPaisa: 5000,
      reason: 'Batch expiring soon'
    });

    // Stock should be 5
    const batch = db.prepare('SELECT quantity_units FROM batches WHERE id = ?').get(batchId) as any;
    assert.equal(batch.quantity_units, 5);

    // Supplier balance should be reduced: 50000 - 5000 = 45000
    const supplier = db.prepare('SELECT balance_paisa FROM suppliers WHERE id = ?').get(supplierId) as any;
    assert.equal(supplier.balance_paisa, 45000);

    // Check stock_movements ledger
    const movement = db.prepare(`
      SELECT * FROM stock_movements WHERE movement_type = 'RETURN_SUPPLIER'
    `).get() as any;
    assert.equal(movement.quantity_change, -5);
  });
});

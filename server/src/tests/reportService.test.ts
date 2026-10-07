import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createDbConnection, DbWrapper } from '../config/database.js';
import { ReportService } from '../services/reportService.js';
import fs from 'node:fs';
import path from 'node:path';

describe('ReportService & Customer Khata Balances', () => {
  let db: DbWrapper;
  let reportService: ReportService;
  const testDbPath = path.resolve(process.cwd(), 'data', 'test_reports_pharmacy.db');

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
    db = createDbConnection(testDbPath);

    db.exec(`
      CREATE TABLE customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        current_baqaya_paisa INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE customer_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        transaction_type TEXT NOT NULL,
        amount_paisa INTEGER NOT NULL,
        balance_after_paisa INTEGER NOT NULL,
        reference_type TEXT,
        notes TEXT,
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
    `);

    reportService = new ReportService(db);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
  });

  it('receives customer udhaar payment, decreases baqaya, and logs transaction', () => {
    const cRes = db.prepare(`
      INSERT INTO customers (name, current_baqaya_paisa) VALUES ('Mohammad Aslam', 345000)
    `).run();
    const customerId = Number(cRes.lastInsertRowid);

    // Pay Rs 1000 (100000 paisa)
    const result = reportService.receiveCustomerPayment(customerId, 100000, 'Partial cash payment');

    assert.equal(result.newBalancePaisa, 245000);

    const cust = db.prepare('SELECT current_baqaya_paisa FROM customers WHERE id = ?').get(customerId) as any;
    assert.equal(cust.current_baqaya_paisa, 245000);

    const tx = db.prepare('SELECT * FROM customer_transactions WHERE customer_id = ?').get(customerId) as any;
    assert.equal(tx.transaction_type, 'PAYMENT_CREDIT');
    assert.equal(tx.amount_paisa, 100000);
    assert.equal(tx.balance_after_paisa, 245000);
  });

  it('calculates daily sales close summary', () => {
    const today = new Date().toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO sales (bill_number, payment_type, subtotal_paisa, discount_paisa, total_paisa, paid_paisa, created_at)
      VALUES 
        ('B1', 'Cash', 1000, 0, 1000, 1000, ?),
        ('B2', 'Cash', 2000, 100, 1900, 1900, ?),
        ('B3', 'Udhaar', 5000, 0, 5000, 0, ?)
    `).run(today, today, today);

    const closeReport = reportService.getDailySalesClose(today);
    assert.equal(closeReport.bills.length, 3);
    assert.equal(closeReport.summary.length, 2); // Cash & Udhaar
  });

  it('generates Excel and PDF buffers successfully', async () => {
    const excelBuffer = await reportService.exportToExcel(
      'Test Sheet',
      [{ header: 'Name', key: 'name' }, { header: 'Amt', key: 'amt' }],
      [{ name: 'Item A', amt: 100 }, { name: 'Item B', amt: 200 }]
    );
    assert.ok(excelBuffer.length > 0);

    const pdfBuffer = await reportService.exportToPDF(
      'Test Report',
      ['Name', 'Amt'],
      [['Item A', '100'], ['Item B', '200']]
    );
    assert.ok(pdfBuffer.length > 0);
  });
});

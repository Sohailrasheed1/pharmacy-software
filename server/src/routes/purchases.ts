import { Router } from 'express';
import { db } from '../config/database.js';
import { PurchaseService } from '../services/purchaseService.js';

export const purchasesRouter = Router();
const purchaseService = new PurchaseService(db);

// GET /api/purchases/suppliers - list all suppliers with balance owed
purchasesRouter.get('/suppliers', (req, res) => {
  try {
    const suppliers = db.prepare(`
      SELECT 
        s.*,
        (SELECT MAX(invoice_date) FROM purchases WHERE supplier_id = s.id) as last_purchase_date
      FROM suppliers s
      ORDER BY s.name ASC
    `).all();
    res.json(suppliers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/purchases/suppliers - create new supplier
purchasesRouter.post('/suppliers', (req, res) => {
  try {
    const { name, company_name, phone, address } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Supplier name is required' });
    }
    const stmt = db.prepare(`
      INSERT INTO suppliers (name, company_name, phone, address, balance_paisa)
      VALUES (?, ?, ?, ?, 0)
    `);
    const r = stmt.run(name.trim(), company_name?.trim() || null, phone?.trim() || null, address?.trim() || null);
    res.status(201).json({ id: r.lastInsertRowid, message: 'Supplier added' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/purchases - list purchases (GRNs)
purchasesRouter.get('/', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT 
        p.*,
        s.name as supplier_name,
        s.company_name as supplier_company
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      ORDER BY p.id DESC
      LIMIT 50
    `).all();
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/purchases - enter new GRN (purchase)
purchasesRouter.post('/', (req, res) => {
  try {
    const { supplierId, invoiceNumber, invoiceDate, items, paidAmountPaisa, notes } = req.body;
    const result = purchaseService.createPurchase({
      supplierId: Number(supplierId),
      invoiceNumber,
      invoiceDate,
      items,
      paidAmountPaisa: paidAmountPaisa ? Number(paidAmountPaisa) : 0,
      notes
    });
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/purchases/payments - pay distributor
purchasesRouter.post('/payments', (req, res) => {
  try {
    const { supplierId, amountPaisa, paymentMethod, referenceNumber, notes } = req.body;
    const result = purchaseService.recordSupplierPayment({
      supplierId: Number(supplierId),
      amountPaisa: Number(amountPaisa),
      paymentMethod,
      referenceNumber,
      notes
    });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/purchases/expiry-returns - get near-expiry batches ready for return to distributor
purchasesRouter.get('/expiry-returns', (req, res) => {
  try {
    const list = purchaseService.getExpiryReturnList();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/purchases/returns - process return to distributor
purchasesRouter.post('/returns', (req, res) => {
  try {
    const { supplierId, batchId, quantityUnits, refundAmountPaisa, reason } = req.body;
    const result = purchaseService.returnBatchToSupplier({
      supplierId: Number(supplierId),
      batchId: Number(batchId),
      quantityUnits: Number(quantityUnits),
      refundAmountPaisa: Number(refundAmountPaisa),
      reason
    });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

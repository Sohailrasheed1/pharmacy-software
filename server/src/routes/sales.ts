import { Router } from 'express';
import { db } from '../config/database.js';
import { SaleService } from '../services/saleService.js';

export const salesRouter = Router();
const saleService = new SaleService(db);

// GET /api/sales/stats/today - today's sales summary
salesRouter.get('/stats/today', (req, res) => {
  try {
    const todayRow = db.prepare("SELECT date('now', 'localtime') as today").get() as any;
    const today = todayRow?.today || new Date().toLocaleDateString('en-CA');

    const stats = db.prepare(`
      SELECT 
        COUNT(*) as bills_count,
        COALESCE(SUM(total_paisa), 0) as total_sales_paisa,
        COALESCE(SUM(discount_paisa), 0) as discount_paisa,
        COALESCE(SUM(CASE WHEN payment_type = 'Cash' THEN total_paisa ELSE 0 END), 0) as cash_sales_paisa,
        COALESCE(SUM(CASE WHEN payment_type = 'Udhaar' THEN total_paisa ELSE 0 END), 0) as udhaar_sales_paisa
      FROM sales
      WHERE created_at LIKE ?
    `).get(`${today}%`) as any;

    res.json({
      today,
      billsCount: stats?.bills_count || 0,
      totalSalesPaisa: stats?.total_sales_paisa || 0,
      discountPaisa: stats?.discount_paisa || 0,
      cashSalesPaisa: stats?.cash_sales_paisa || 0,
      udhaarSalesPaisa: stats?.udhaar_sales_paisa || 0
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sales - list bills with filters (date, search, paymentType)
salesRouter.get('/', (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const date = req.query.date ? String(req.query.date) : null;
    const search = req.query.search ? String(req.query.search).trim() : null;
    const paymentType = req.query.paymentType ? String(req.query.paymentType) : null;

    let sql = `
      SELECT 
        s.*,
        c.name as customer_name,
        c.phone as customer_phone,
        COUNT(si.id) as items_count
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (date) {
      sql += ` AND s.created_at LIKE ?`;
      params.push(`${date}%`);
    }

    if (search) {
      sql += ` AND (s.bill_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (paymentType) {
      sql += ` AND s.payment_type = ?`;
      params.push(paymentType);
    }

    sql += ` GROUP BY s.id ORDER BY s.id DESC LIMIT ?`;
    params.push(limit);

    const sales = db.prepare(sql).all(...params);

    res.json(sales);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sales/next-bill - preview next bill number
salesRouter.get('/next-bill', (req, res) => {
  try {
    const nextBillNo = saleService.generateBillNumber();
    res.json({ nextBillNo });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/sales/:id - full bill receipt details
salesRouter.get('/:id', (req, res) => {
  try {
    const data = saleService.getSaleReceiptData(Number(req.params.id));
    if (!data) {
      return res.status(404).json({ error: 'Bill not found' });
    }
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/sales/checkout - complete sale with FEFO & Loose Pricing
salesRouter.post('/checkout', (req, res) => {
  try {
    const { items, discountPaisa, paymentType, customerId, paidPaisa } = req.body;

    const result = saleService.processSale({
      items,
      discountPaisa: discountPaisa ? Number(discountPaisa) : 0,
      paymentType,
      customerId: customerId ? Number(customerId) : null,
      paidPaisa: paidPaisa !== undefined ? Number(paidPaisa) : undefined
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/sales/:id/return - process sale return
salesRouter.post('/:id/return', (req, res) => {
  try {
    const { returnItems, reason } = req.body;
    const saleId = Number(req.params.id);

    const result = saleService.processSaleReturn(saleId, returnItems, reason);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

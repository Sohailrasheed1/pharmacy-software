import { Router } from 'express';
import { db } from '../config/database.js';
import { ReportService } from '../services/reportService.js';

export const customersRouter = Router();
const reportService = new ReportService(db);

// GET /api/customers - list customers for Udhaar selection
customersRouter.get('/', (req, res) => {
  try {
    const customers = db.prepare('SELECT * FROM customers ORDER BY name ASC').all();
    res.json(customers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/customers - quick add customer from POS counter
customersRouter.post('/', (req, res) => {
  try {
    const { name, phone, address } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    const result = db.prepare(`
      INSERT INTO customers (name, phone, address, current_baqaya_paisa)
      VALUES (?, ?, ?, 0)
    `).run(name.trim(), phone?.trim() || null, address?.trim() || null);

    res.status(201).json({ id: result.lastInsertRowid, name, phone });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/customers/:id/payment - receive Udhaar payment
customersRouter.post('/:id/payment', (req, res) => {
  try {
    const { amountPaisa, notes } = req.body;
    const customerId = Number(req.params.id);
    const result = reportService.receiveCustomerPayment(customerId, Number(amountPaisa), notes);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

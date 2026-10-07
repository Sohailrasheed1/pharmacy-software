import { Router } from 'express';
import { db } from '../config/database.js';
import { ReportService } from '../services/reportService.js';

export const reportsRouter = Router();
const reportService = new ReportService(db);

// GET /api/reports/daily-close
reportsRouter.get('/daily-close', (req, res) => {
  try {
    const date = req.query.date ? String(req.query.date) : undefined;
    const data = reportService.getDailySalesClose(date);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/profit-by-item
reportsRouter.get('/profit-by-item', (req, res) => {
  try {
    const list = reportService.getProfitByItem();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/controlled-drugs
reportsRouter.get('/controlled-drugs', (req, res) => {
  try {
    const list = reportService.getControlledDrugsRegister();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/export/excel
reportsRouter.get('/export/excel', async (req, res) => {
  try {
    const reportType = String(req.query.type || 'profit');
    let title = 'Pharmacy Report';
    let columns: any[] = [];
    let rows: any[] = [];

    if (reportType === 'profit') {
      title = 'Profit by Item';
      columns = [
        { header: 'Medicine Name', key: 'name', width: 25 },
        { header: 'Company', key: 'company', width: 18 },
        { header: 'Units Sold', key: 'units', width: 14 },
        { header: 'Revenue (Rs)', key: 'rev', width: 16 },
        { header: 'Cost (Rs)', key: 'cost', width: 16 },
        { header: 'Profit (Rs)', key: 'profit', width: 16 }
      ];
      const data = reportService.getProfitByItem();
      rows = data.map((d: any) => ({
        name: d.item_name,
        company: d.company,
        units: d.total_units_sold,
        rev: Math.round(d.revenue_paisa / 100),
        cost: Math.round(d.cost_paisa / 100),
        profit: Math.round(d.profit_paisa / 100)
      }));
    } else if (reportType === 'controlled') {
      title = 'Controlled Drugs Register';
      columns = [
        { header: 'Date & Time', key: 'date', width: 20 },
        { header: 'Bill Number', key: 'bill', width: 16 },
        { header: 'Medicine', key: 'item', width: 22 },
        { header: 'Batch', key: 'batch', width: 14 },
        { header: 'Quantity Sold', key: 'qty', width: 14 },
        { header: 'Customer', key: 'cust', width: 20 }
      ];
      const data = reportService.getControlledDrugsRegister();
      rows = data.map((d: any) => ({
        date: d.created_at,
        bill: d.bill_number,
        item: d.item_name,
        batch: d.batch_number,
        qty: d.quantity_units,
        cust: d.customer_name || 'Walk-in'
      }));
    }

    const buffer = await reportService.exportToExcel(title, columns, rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${reportType}-report.xlsx"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/export/pdf
reportsRouter.get('/export/pdf', async (req, res) => {
  try {
    const reportType = String(req.query.type || 'profit');
    let title = 'Pharmacy Report';
    let headers: string[] = [];
    let rows: string[][] = [];

    if (reportType === 'profit') {
      title = 'Profit by Item Report';
      headers = ['Item Name', 'Company', 'Sold', 'Revenue', 'Cost', 'Profit'];
      const data = reportService.getProfitByItem();
      rows = data.map((d: any) => [
        d.item_name,
        d.company,
        String(d.total_units_sold),
        `Rs ${Math.round(d.revenue_paisa / 100)}`,
        `Rs ${Math.round(d.cost_paisa / 100)}`,
        `Rs ${Math.round(d.profit_paisa / 100)}`
      ]);
    } else if (reportType === 'controlled') {
      title = 'Controlled Drugs Inspection Register';
      headers = ['Bill #', 'Date', 'Medicine', 'Batch', 'Qty', 'Customer'];
      const data = reportService.getControlledDrugsRegister();
      rows = data.map((d: any) => [
        d.bill_number,
        d.created_at?.split(' ')[0],
        d.item_name,
        d.batch_number,
        String(d.quantity_units),
        d.customer_name || 'Walk-in'
      ]);
    }

    const buffer = await reportService.exportToPDF(title, headers, rows);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${reportType}-report.pdf"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

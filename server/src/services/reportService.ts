import { DbWrapper } from '../config/database.js';
import { db } from '../config/database.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export class ReportService {
  private database: DbWrapper;

  constructor(database: DbWrapper = db) {
    this.database = database;
  }

  /**
   * Daily Sales & Cash Close Report
   */
  public getDailySalesClose(dateStr?: string) {
    let targetDate = dateStr;
    if (!targetDate) {
      try {
        const row = this.database.prepare("SELECT date('now', 'localtime') as today").get() as any;
        targetDate = row?.today || new Date().toLocaleDateString('en-CA');
      } catch {
        targetDate = new Date().toLocaleDateString('en-CA');
      }
    }

    const sales = this.database.prepare(`
      SELECT 
        payment_type,
        COUNT(*) as count,
        SUM(subtotal_paisa) as subtotal_paisa,
        SUM(discount_paisa) as discount_paisa,
        SUM(total_paisa) as total_paisa,
        SUM(paid_paisa) as paid_paisa
      FROM sales
      WHERE created_at LIKE ?
      GROUP BY payment_type
    `).all(`${targetDate}%`) as any[];

    const bills = this.database.prepare(`
      SELECT s.*, c.name as customer_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.created_at LIKE ?
      ORDER BY s.id DESC
    `).all(`${targetDate}%`) as any[];

    // Khata payments received today
    const khataCollected = this.database.prepare(`
      SELECT COALESCE(SUM(amount_paisa), 0) as total
      FROM customer_transactions
      WHERE transaction_type = 'PAYMENT_CREDIT' AND created_at LIKE ?
    `).get(`${targetDate}%`) as any;

    return {
      date: targetDate,
      summary: sales,
      bills,
      khataCollectedPaisa: khataCollected?.total || 0
    };
  }

  /**
   * Profit by Item Report
   */
  public getProfitByItem() {
    return this.database.prepare(`
      SELECT 
        i.name as item_name,
        i.company,
        i.generic_name,
        SUM(si.quantity_units) as total_units_sold,
        SUM(si.total_paisa) as revenue_paisa,
        SUM(ROUND((si.quantity_units * b.purchase_rate_paisa) / i.pack_size)) as cost_paisa,
        SUM(si.total_paisa) - SUM(ROUND((si.quantity_units * b.purchase_rate_paisa) / i.pack_size)) as profit_paisa
      FROM sale_items si
      JOIN items i ON si.item_id = i.id
      JOIN batches b ON si.batch_id = b.id
      GROUP BY i.id
      ORDER BY profit_paisa DESC
    `).all();
  }

  /**
   * Controlled Drugs Register
   */
  public getControlledDrugsRegister() {
    return this.database.prepare(`
      SELECT 
        si.id,
        s.bill_number,
        s.created_at,
        c.name as customer_name,
        c.phone as customer_phone,
        i.name as item_name,
        b.batch_number,
        si.quantity_units,
        si.total_paisa
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN items i ON si.item_id = i.id
      JOIN batches b ON si.batch_id = b.id
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE i.is_controlled = 1
      ORDER BY s.created_at DESC
    `).all();
  }

  /**
   * Customer Khata Ledger
   */
  public getCustomerKhataLedger(customerId: number) {
    const customer = this.database.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    const transactions = this.database.prepare(`
      SELECT * FROM customer_transactions
      WHERE customer_id = ?
      ORDER BY id DESC
    `).all(customerId);

    return { customer, transactions };
  }

  /**
   * Receive Customer Udhaar Payment
   */
  public receiveCustomerPayment(customerId: number, amountPaisa: number, notes?: string) {
    const runInTx = this.database.transaction(() => {
      const cust = this.database.prepare('SELECT current_baqaya_paisa FROM customers WHERE id = ?').get(customerId) as any;
      if (!cust) throw new Error('Customer not found');

      const newBalance = Math.max(0, cust.current_baqaya_paisa - amountPaisa);

      this.database.prepare(`
        UPDATE customers SET current_baqaya_paisa = ? WHERE id = ?
      `).run(newBalance, customerId);

      this.database.prepare(`
        INSERT INTO customer_transactions 
          (customer_id, transaction_type, amount_paisa, balance_after_paisa, reference_type, notes)
        VALUES 
          (?, 'PAYMENT_CREDIT', ?, ?, 'payment', ?)
      `).run(customerId, amountPaisa, newBalance, notes || 'Udhaar payment received');

      return { customerId, newBalancePaisa: newBalance };
    });

    return runInTx();
  }

  /**
   * Export Table Data to Excel Buffer (.xlsx)
   */
  public async exportToExcel(title: string, columns: Array<{ header: string; key: string; width?: number }>, rows: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(title);

    sheet.columns = columns.map(c => ({
      header: c.header,
      key: c.key,
      width: c.width || 18
    }));

    // Header styling
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '0D6B54' } // clinical green
    };

    for (const r of rows) {
      sheet.addRow(r);
    }

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  /**
   * Export Table Data to PDF Buffer
   */
  public exportToPDF(title: string, headers: string[], rows: string[][]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Header
      doc.fontSize(16).fillColor('#0D6B54').text(title, { align: 'center' });
      doc.fontSize(10).fillColor('#666').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(1.5);

      // Render table rows
      doc.fontSize(9).fillColor('#000');
      doc.text(headers.join('   |   '), { underline: true });
      doc.moveDown(0.5);

      for (const row of rows) {
        doc.text(row.join('   |   '));
      }

      doc.end();
    });
  }
}

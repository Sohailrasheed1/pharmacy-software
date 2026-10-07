import { DbWrapper } from '../config/database.js';
import { db } from '../config/database.js';
import { StockService } from './stockService.js';

export interface PurchaseItemEntry {
  itemId: number;
  batchNumber: string;
  expiryDate: string; // YYYY-MM
  quantityPacks: number;
  purchaseRatePaisa: number;
  saleRatePaisa: number;
}

export interface CreatePurchaseParams {
  supplierId: number;
  invoiceNumber: string;
  invoiceDate?: string;
  items: PurchaseItemEntry[];
  paidAmountPaisa?: number;
  notes?: string;
}

export interface SupplierPaymentParams {
  supplierId: number;
  amountPaisa: number;
  paymentMethod?: string;
  referenceNumber?: string;
  notes?: string;
}

export interface ReturnToSupplierParams {
  supplierId: number;
  batchId: number;
  quantityUnits: number;
  refundAmountPaisa: number;
  reason?: string;
}

export class PurchaseService {
  private database: DbWrapper;
  private stockService: StockService;

  constructor(database: DbWrapper = db) {
    this.database = database;
    this.stockService = new StockService(database);
  }

  /**
   * Process Purchase (GRN):
   * 1. Creates/tops up batches
   * 2. Adds stock via central stockService (writes stock_movements)
   * 3. Increases supplier balance (what we owe) by net unpaid amount
   */
  public createPurchase(params: CreatePurchaseParams): any {
    const {
      supplierId,
      invoiceNumber,
      invoiceDate = new Date().toISOString().split('T')[0],
      items,
      paidAmountPaisa = 0,
      notes
    } = params;

    if (!items || items.length === 0) {
      throw new Error('Purchase entry must contain at least one item.');
    }

    const supplier = this.database.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId) as any;
    if (!supplier) {
      throw new Error(`Supplier ID ${supplierId} not found.`);
    }

    const runInTx = this.database.transaction(() => {
      let totalAmountPaisa = 0;

      for (const it of items) {
        totalAmountPaisa += it.quantityPacks * it.purchaseRatePaisa;
      }

      // 1. Insert Purchase Record
      const purchaseRes = this.database.prepare(`
        INSERT INTO purchases 
          (supplier_id, invoice_number, invoice_date, total_amount_paisa, paid_amount_paisa, status, notes)
        VALUES 
          (?, ?, ?, ?, ?, 'COMPLETED', ?)
      `).run(supplierId, invoiceNumber.trim(), invoiceDate, totalAmountPaisa, paidAmountPaisa, notes || null);

      const purchaseId = Number(purchaseRes.lastInsertRowid);

      // 2. Process Items & Batches
      const insertPurchaseItem = this.database.prepare(`
        INSERT INTO purchase_items 
          (purchase_id, item_id, batch_id, batch_number, expiry_date, quantity_packs, total_units, purchase_rate_paisa, sale_rate_paisa, total_amount_paisa)
        VALUES 
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const line of items) {
        const item = this.database.prepare('SELECT * FROM items WHERE id = ?').get(line.itemId) as any;
        if (!item) {
          throw new Error(`Item ID ${line.itemId} not found.`);
        }

        const packSize = item.pack_size || 1;
        const totalUnitsToAdd = line.quantityPacks * packSize;
        const lineTotalPaisa = line.quantityPacks * line.purchaseRatePaisa;

        // Check if batch exists
        let batch = this.database.prepare(
          'SELECT * FROM batches WHERE item_id = ? AND batch_number = ?'
        ).get(line.itemId, line.batchNumber.trim().toUpperCase()) as any;

        let batchId: number;
        if (batch) {
          batchId = batch.id;
          // Update rates and expiry
          this.database.prepare(`
            UPDATE batches 
            SET purchase_rate_paisa = ?, sale_rate_paisa = ?, expiry_date = ?, updated_at = datetime('now', 'localtime')
            WHERE id = ?
          `).run(line.purchaseRatePaisa, line.saleRatePaisa, line.expiryDate, batchId);
        } else {
          const batchRes = this.database.prepare(`
            INSERT INTO batches 
              (item_id, batch_number, expiry_date, quantity_units, purchase_rate_paisa, sale_rate_paisa)
            VALUES 
              (?, ?, ?, 0, ?, ?)
          `).run(line.itemId, line.batchNumber.trim().toUpperCase(), line.expiryDate, line.purchaseRatePaisa, line.saleRatePaisa);
          batchId = Number(batchRes.lastInsertRowid);
        }

        insertPurchaseItem.run(
          purchaseId,
          line.itemId,
          batchId,
          line.batchNumber.trim().toUpperCase(),
          line.expiryDate,
          line.quantityPacks,
          totalUnitsToAdd,
          line.purchaseRatePaisa,
          line.saleRatePaisa,
          lineTotalPaisa
        );

        // Add inventory via Central Stock Service (writes stock_movements)
        this.stockService.changeStock({
          batchId,
          movementType: 'PURCHASE',
          quantityChangeUnits: totalUnitsToAdd,
          referenceType: 'purchase',
          referenceId: purchaseId,
          notes: `GRN Inv #${invoiceNumber}`
        });
      }

      // 3. Update Supplier Ledger Balance
      // Remaining payable = totalAmount - paidAmount
      const netPayablePaisa = totalAmountPaisa - paidAmountPaisa;
      this.database.prepare(`
        UPDATE suppliers 
        SET balance_paisa = balance_paisa + ? 
        WHERE id = ?
      `).run(netPayablePaisa, supplierId);

      if (paidAmountPaisa > 0) {
        this.database.prepare(`
          INSERT INTO supplier_payments (supplier_id, purchase_id, payment_date, amount_paisa, notes)
          VALUES (?, ?, ?, ?, 'Immediate payment upon invoice')
        `).run(supplierId, purchaseId, invoiceDate, paidAmountPaisa);
      }

      return {
        purchaseId,
        invoiceNumber,
        totalAmountPaisa,
        paidAmountPaisa,
        netPayablePaisa
      };
    });

    return runInTx();
  }

  /**
   * Record Supplier Payment:
   * Decreases what we owe the distributor
   */
  public recordSupplierPayment(params: SupplierPaymentParams): any {
    const { supplierId, amountPaisa, paymentMethod = 'Cash', referenceNumber, notes } = params;

    if (amountPaisa <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    const supplier = this.database.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId) as any;
    if (!supplier) {
      throw new Error(`Supplier ID ${supplierId} not found.`);
    }

    const runInTx = this.database.transaction(() => {
      const today = new Date().toISOString().split('T')[0];
      const res = this.database.prepare(`
        INSERT INTO supplier_payments 
          (supplier_id, payment_date, amount_paisa, payment_method, reference_number, notes)
        VALUES 
          (?, ?, ?, ?, ?, ?)
      `).run(supplierId, today, amountPaisa, paymentMethod, referenceNumber || null, notes || null);

      // Deduct from supplier balance
      this.database.prepare(`
        UPDATE suppliers 
        SET balance_paisa = balance_paisa - ? 
        WHERE id = ?
      `).run(amountPaisa, supplierId);

      const updated = this.database.prepare('SELECT balance_paisa FROM suppliers WHERE id = ?').get(supplierId) as any;

      return {
        paymentId: Number(res.lastInsertRowid),
        newBalancePaisa: updated.balance_paisa
      };
    });

    return runInTx();
  }

  /**
   * Return Near-Expiry or Expired batch to Supplier:
   * Deducts stock via stockService and reduces what we owe (or claims refund)
   */
  public returnBatchToSupplier(params: ReturnToSupplierParams): any {
    const { supplierId, batchId, quantityUnits, refundAmountPaisa, reason } = params;

    const runInTx = this.database.transaction(() => {
      // 1. Deduct stock via StockService
      this.stockService.changeStock({
        batchId,
        movementType: 'RETURN_SUPPLIER',
        quantityChangeUnits: -quantityUnits,
        referenceType: 'supplier_return',
        notes: `Returned to supplier: ${reason || 'Expiry return'}`
      });

      // 2. Insert record
      const res = this.database.prepare(`
        INSERT INTO supplier_returns 
          (supplier_id, batch_id, quantity_units, refund_amount_paisa, reason)
        VALUES 
          (?, ?, ?, ?, ?)
      `).run(supplierId, batchId, quantityUnits, refundAmountPaisa, reason || null);

      // 3. Deduct from supplier balance we owe
      this.database.prepare(`
        UPDATE suppliers 
        SET balance_paisa = balance_paisa - ? 
        WHERE id = ?
      `).run(refundAmountPaisa, supplierId);

      return {
        returnId: Number(res.lastInsertRowid),
        refundAmountPaisa
      };
    });

    return runInTx();
  }

  /**
   * Get Near Expiry Batches grouped for return
   */
  public getExpiryReturnList() {
    const today = new Date();
    const d90 = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
    const nearYM = `${d90.getFullYear()}-${String(d90.getMonth() + 1).padStart(2, '0')}`;

    return this.database.prepare(`
      SELECT 
        b.id as batch_id,
        b.batch_number,
        b.expiry_date,
        b.quantity_units,
        b.purchase_rate_paisa,
        i.id as item_id,
        i.name as item_name,
        i.company,
        i.pack_size,
        i.form,
        ROUND((b.quantity_units * b.purchase_rate_paisa) / i.pack_size) as estimated_claim_paisa
      FROM batches b
      JOIN items i ON b.item_id = i.id
      WHERE b.expiry_date <= ? AND b.quantity_units > 0
      ORDER BY b.expiry_date ASC, i.company ASC
    `).all(nearYM);
  }
}

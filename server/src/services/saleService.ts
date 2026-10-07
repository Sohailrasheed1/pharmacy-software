import { DbWrapper } from '../config/database.js';
import { db } from '../config/database.js';
import { StockService } from './stockService.js';

export interface CartSaleItem {
  itemId: number;
  isLoose: boolean;
  quantity: number; // number of packs OR loose tablets
}

export interface SaleCheckoutParams {
  items: CartSaleItem[];
  discountPaisa?: number;
  paymentType: 'Cash' | 'Udhaar' | 'Easypaisa' | 'JazzCash';
  customerId?: number | null;
  paidPaisa?: number;
}

export interface SaleReturnItemParams {
  saleItemId: number;
  quantityUnitsToReturn: number;
}

export class SaleService {
  private database: DbWrapper;
  private stockService: StockService;

  constructor(database: DbWrapper = db) {
    this.database = database;
    this.stockService = new StockService(database);
  }

  /**
   * Generates a sequential bill number: INV-YYYYMM-XXXX
   */
  public generateBillNumber(): string {
    const today = new Date();
    const prefix = `INV-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const row = this.database.prepare(`
      SELECT COUNT(*) as count FROM sales WHERE bill_number LIKE ?
    `).get(`${prefix}-%`) as { count: number };

    const nextSeq = (row?.count || 0) + 1;
    return `${prefix}-${String(nextSeq).padStart(4, '0')}`;
  }

  /**
   * Complete Sale with FEFO (First-Expiry-First-Out) deduction & Loose Pricing.
   * Runs atomically in a single transaction.
   */
  public processSale(params: SaleCheckoutParams): any {
    const { items, discountPaisa = 0, paymentType, customerId, paidPaisa } = params;

    if (!items || items.length === 0) {
      throw new Error('Sale cart is empty.');
    }

    if (paymentType === 'Udhaar' && !customerId) {
      throw new Error('Udhaar sales must be linked to a customer khata.');
    }

    const today = new Date();
    const currentYM = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const runInTx = this.database.transaction(() => {
      let subtotalPaisa = 0;
      const resolvedSaleItems: Array<{
        itemId: number;
        batchId: number;
        isLoose: number;
        unitsDeducted: number;
        unitPricePaisa: number;
        totalPaisa: number;
      }> = [];

      // 1. Process each cart item and allocate batches via FEFO
      for (const line of items) {
        const item = this.database.prepare('SELECT * FROM items WHERE id = ?').get(line.itemId) as any;
        if (!item) {
          throw new Error(`Item ID ${line.itemId} not found.`);
        }

        const packSize = item.pack_size || 1;
        const totalUnitsRequested = line.isLoose ? line.quantity : line.quantity * packSize;
        if (totalUnitsRequested <= 0) {
          continue;
        }

        // Fetch available non-expired batches for this item, sorted by expiry ascending (FEFO)
        const availableBatches = this.database.prepare(`
          SELECT * FROM batches 
          WHERE item_id = ? AND quantity_units > 0
          ORDER BY expiry_date ASC, id ASC
        `).all(line.itemId) as any[];

        if (availableBatches.length === 0) {
          throw new Error(`Item '${item.name}' out of stock.`);
        }

        // Check if the only stock is expired
        const validBatches = availableBatches.filter((b) => b.expiry_date >= currentYM);
        if (validBatches.length === 0) {
          throw new Error(
            `Cannot sell '${item.name}': All remaining stock has expired (${availableBatches[0].batch_number} expired on ${availableBatches[0].expiry_date}).`
          );
        }

        // Determine unit price in paisa
        // If line is loose: use loose unit price; if pack: use pack sale rate
        let unitsRemainingToDeduct = totalUnitsRequested;

        for (const batch of validBatches) {
          if (unitsRemainingToDeduct <= 0) break;

          const unitsFromThisBatch = Math.min(batch.quantity_units, unitsRemainingToDeduct);

          // Calculate unit price for this batch
          const loosePrice = this.stockService.calculateLoosePricePaisa(
            batch.sale_rate_paisa,
            packSize,
            item.loose_price_paisa
          );

          const lineTotalPaisa = line.isLoose
            ? unitsFromThisBatch * loosePrice
            : Math.round((unitsFromThisBatch / packSize) * batch.sale_rate_paisa);

          subtotalPaisa += lineTotalPaisa;

          resolvedSaleItems.push({
            itemId: item.id,
            batchId: batch.id,
            isLoose: line.isLoose ? 1 : 0,
            unitsDeducted: unitsFromThisBatch,
            unitPricePaisa: line.isLoose ? loosePrice : batch.sale_rate_paisa,
            totalPaisa: lineTotalPaisa
          });

          unitsRemainingToDeduct -= unitsFromThisBatch;
        }

        if (unitsRemainingToDeduct > 0) {
          throw new Error(
            `Insufficient non-expired stock for '${item.name}'. Short by ${unitsRemainingToDeduct} base units.`
          );
        }
      }

      // Calculate totals
      const actualDiscountPaisa = Math.min(Math.max(discountPaisa, 0), subtotalPaisa);
      const totalPaisa = subtotalPaisa - actualDiscountPaisa;
      const actualPaidPaisa = paidPaisa !== undefined ? paidPaisa : (paymentType === 'Udhaar' ? 0 : totalPaisa);
      const changePaisa = Math.max(0, actualPaidPaisa - totalPaisa);

      const billNumber = this.generateBillNumber();

      // 2. Insert Sale Record
      const saleResult = this.database.prepare(`
        INSERT INTO sales 
          (bill_number, customer_id, payment_type, subtotal_paisa, discount_paisa, total_paisa, paid_paisa, change_paisa, status)
        VALUES 
          (?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED')
      `).run(
        billNumber,
        customerId || null,
        paymentType,
        subtotalPaisa,
        actualDiscountPaisa,
        totalPaisa,
        actualPaidPaisa,
        changePaisa
      );

      const saleId = Number(saleResult.lastInsertRowid);

      // 3. Insert Sale Items & Deduct Stock via Central StockService
      const insertSaleItem = this.database.prepare(`
        INSERT INTO sale_items 
          (sale_id, batch_id, item_id, is_loose, quantity_units, unit_price_paisa, total_paisa)
        VALUES 
          (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const itemLine of resolvedSaleItems) {
        insertSaleItem.run(
          saleId,
          itemLine.batchId,
          itemLine.itemId,
          itemLine.isLoose,
          itemLine.unitsDeducted,
          itemLine.unitPricePaisa,
          itemLine.totalPaisa
        );

        // Deduct stock and record in stock_movements ledger
        this.stockService.changeStock({
          batchId: itemLine.batchId,
          movementType: 'SALE',
          quantityChangeUnits: -itemLine.unitsDeducted,
          referenceType: 'sale',
          referenceId: saleId,
          notes: `Bill #${billNumber}`
        });
      }

      // 4. If payment is Udhaar, update customer khata baqaya
      if (paymentType === 'Udhaar' && customerId) {
        const remainingUdhaar = totalPaisa - actualPaidPaisa;
        if (remainingUdhaar > 0) {
          this.database.prepare(`
            UPDATE customers 
            SET current_baqaya_paisa = current_baqaya_paisa + ? 
            WHERE id = ?
          `).run(remainingUdhaar, customerId);
        }
      }

      return {
        saleId,
        billNumber,
        subtotalPaisa,
        discountPaisa: actualDiscountPaisa,
        totalPaisa,
        paidPaisa: actualPaidPaisa,
        changePaisa,
        paymentType
      };
    });

    return runInTx();
  }

  /**
   * Process Sale Return:
   * Restores inventory to original batches via centralized stockService and adjusts customer baqaya if udhaar.
   */
  public processSaleReturn(saleId: number, returnItems: SaleReturnItemParams[], reason?: string): any {
    const sale = this.database.prepare('SELECT * FROM sales WHERE id = ?').get(saleId) as any;
    if (!sale) {
      throw new Error(`Sale ID ${saleId} not found.`);
    }

    const runInTx = this.database.transaction(() => {
      let totalRefundPaisa = 0;

      for (const ret of returnItems) {
        const saleItem = this.database.prepare('SELECT * FROM sale_items WHERE id = ? AND sale_id = ?').get(
          ret.saleItemId,
          saleId
        ) as any;

        if (!saleItem) {
          throw new Error(`Sale item ID ${ret.saleItemId} not found in bill #${sale.bill_number}.`);
        }

        if (ret.quantityUnitsToReturn > saleItem.quantity_units) {
          throw new Error(
            `Cannot return ${ret.quantityUnitsToReturn} units. Maximum purchased in this line was ${saleItem.quantity_units}.`
          );
        }

        // Calculate refund amount
        const itemRefundPaisa = Math.round(
          (ret.quantityUnitsToReturn / saleItem.quantity_units) * saleItem.total_paisa
        );
        totalRefundPaisa += itemRefundPaisa;

        // Restore stock to the exact same batch
        this.stockService.changeStock({
          batchId: saleItem.batch_id,
          movementType: 'RETURN_SALE',
          quantityChangeUnits: ret.quantityUnitsToReturn,
          referenceType: 'sale_return',
          referenceId: saleId,
          notes: `Return on Bill #${sale.bill_number}: ${reason || 'Customer returned item'}`
        });
      }

      // If original bill was Udhaar, reverse from customer's baqaya
      if (sale.payment_type === 'Udhaar' && sale.customer_id) {
        this.database.prepare(`
          UPDATE customers 
          SET current_baqaya_paisa = MAX(0, current_baqaya_paisa - ?)
          WHERE id = ?
        `).run(totalRefundPaisa, sale.customer_id);
      }

      // Record in audit log
      this.database.prepare(`
        INSERT INTO audit_logs (action, entity_name, entity_id, details)
        VALUES ('SALE_RETURN', 'sales', ?, ?)
      `).run(saleId, `Returned ${returnItems.length} items. Total refund: ${totalRefundPaisa} paisa`);

      return {
        saleId,
        billNumber: sale.bill_number,
        totalRefundPaisa
      };
    });

    return runInTx();
  }

  /**
   * Fetch full bill details for 80mm thermal receipt
   */
  public getSaleReceiptData(saleId: number) {
    const sale = this.database.prepare('SELECT * FROM sales WHERE id = ?').get(saleId) as any;
    if (!sale) return null;

    const items = this.database.prepare(`
      SELECT 
        si.*,
        i.name as item_name,
        i.pack_size,
        i.form,
        b.batch_number,
        b.expiry_date
      FROM sale_items si
      JOIN items i ON si.item_id = i.id
      JOIN batches b ON si.batch_id = b.id
      WHERE si.sale_id = ?
    `).all(saleId) as any[];

    const customer = sale.customer_id
      ? (this.database.prepare('SELECT * FROM customers WHERE id = ?').get(sale.customer_id) as any)
      : null;

    const settingsRows = this.database.prepare('SELECT * FROM settings').all() as any[];
    const settings: Record<string, string> = {};
    for (const s of settingsRows) {
      settings[s.key] = s.value;
    }

    return {
      sale,
      items,
      customer,
      settings
    };
  }
}

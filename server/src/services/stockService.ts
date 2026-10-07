import { DbWrapper } from '../config/database.js';
import { db } from '../config/database.js';

export type MovementType =
  | 'SALE'
  | 'PURCHASE'
  | 'RETURN_SALE'
  | 'RETURN_SUPPLIER'
  | 'ADJUSTMENT';

export interface StockChangeParams {
  batchId: number;
  movementType: MovementType;
  quantityChangeUnits: number; // positive to add stock, negative to deduct
  referenceType?: string;      // e.g. 'sale', 'purchase', 'adjustment'
  referenceId?: number;
  notes?: string;
}

export interface BatchRecord {
  id: number;
  item_id: number;
  batch_number: string;
  expiry_date: string;
  quantity_units: number;
  purchase_rate_paisa: number;
  sale_rate_paisa: number;
}

export interface ItemRecord {
  id: number;
  name: string;
  generic_name: string | null;
  company: string;
  form: string;
  pack_size: number;
  loose_price_paisa: number | null;
  barcode: string | null;
  reorder_level: number;
  is_controlled: number;
}

export class StockService {
  private database: DbWrapper;

  constructor(database: DbWrapper = db) {
    this.database = database;
  }

  /**
   * Centralized Single Service Function for all stock changes.
   * Every alteration of batch quantity MUST pass through this method.
   * Runs in an atomic SQLite transaction and records a stock_movements entry.
   */
  public changeStock(params: StockChangeParams): { newBalance: number; movementId: number } {
    const { batchId, movementType, quantityChangeUnits, referenceType, referenceId, notes } = params;

    if (quantityChangeUnits === 0) {
      throw new Error('Stock quantity change cannot be zero.');
    }

    const runInTx = this.database.transaction(() => {
      // 1. Fetch current batch
      const batch = this.database.prepare('SELECT * FROM batches WHERE id = ?').get(batchId) as BatchRecord | undefined;
      if (!batch) {
        throw new Error(`Batch with ID ${batchId} not found.`);
      }

      const newBalance = batch.quantity_units + quantityChangeUnits;
      if (newBalance < 0) {
        throw new Error(
          `Insufficient stock in batch ${batch.batch_number}. Available: ${batch.quantity_units}, requested change: ${quantityChangeUnits}`
        );
      }

      // 2. Update batch quantity
      this.database.prepare(`
        UPDATE batches 
        SET quantity_units = ?, updated_at = datetime('now', 'localtime') 
        WHERE id = ?
      `).run(newBalance, batchId);

      // 3. Record stock movement
      const movementResult = this.database.prepare(`
        INSERT INTO stock_movements 
          (batch_id, movement_type, quantity_change, balance_after, reference_type, reference_id, notes)
        VALUES 
          (?, ?, ?, ?, ?, ?, ?)
      `).run(
        batchId,
        movementType,
        quantityChangeUnits,
        newBalance,
        referenceType || null,
        referenceId || null,
        notes || null
      );

      return {
        newBalance,
        movementId: Number(movementResult.lastInsertRowid)
      };
    });

    return runInTx();
  }

  /**
   * Loose Unit Pricing Calculation
   * Rule:
   * 1. If item has a loose_price_paisa override, use it.
   * 2. Otherwise: round(pack_rate_paisa / pack_size)
   */
  public calculateLoosePricePaisa(packRatePaisa: number, packSize: number, loosePriceOverridePaisa?: number | null): number {
    if (loosePriceOverridePaisa != null && loosePriceOverridePaisa > 0) {
      return loosePriceOverridePaisa;
    }
    if (packSize <= 1) {
      return packRatePaisa;
    }
    return Math.round(packRatePaisa / packSize);
  }

  /**
   * Safe Item Pack Size Guard
   * Prevents changing pack_size if any batches already have non-zero stock
   */
  public canUpdateItemPackSize(itemId: number): { allowed: boolean; reason?: string } {
    const stockRow = this.database.prepare(`
      SELECT SUM(quantity_units) as total_units FROM batches WHERE item_id = ?
    `).get(itemId) as { total_units: number | null };

    const total = stockRow?.total_units ?? 0;
    if (total > 0) {
      return {
        allowed: false,
        reason: `Cannot change pack size: item has existing active stock (${total} units). Create a new item instead.`
      };
    }
    return { allowed: true };
  }

  /**
   * Stock query with Near Expiry, Expired, Low Stock filters
   */
  public getStockList(filters?: { search?: string; status?: 'all' | 'near' | 'exp' | 'low' }) {
    const search = filters?.search ? `%${filters.search.trim().toLowerCase()}%` : null;
    const status = filters?.status || 'all';

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentYM = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    const d90 = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
    const nearYM = `${d90.getFullYear()}-${String(d90.getMonth() + 1).padStart(2, '0')}`;

    let query = `
      SELECT 
        COALESCE(b.id, 0) as batch_id,
        COALESCE(b.batch_number, '—') as batch_number,
        COALESCE(b.expiry_date, '—') as expiry_date,
        COALESCE(b.quantity_units, 0) as quantity_units,
        COALESCE(b.purchase_rate_paisa, 0) as purchase_rate_paisa,
        COALESCE(b.sale_rate_paisa, 0) as sale_rate_paisa,
        i.id as item_id,
        i.name as item_name,
        i.generic_name,
        i.company,
        i.form,
        i.pack_size,
        i.loose_price_paisa,
        i.reorder_level,
        i.is_controlled,
        i.barcode,
        CASE
          WHEN b.id IS NULL THEN 'low'
          WHEN b.expiry_date < ? THEN 'exp'
          WHEN b.expiry_date <= ? THEN 'near'
          WHEN b.quantity_units <= (i.reorder_level * i.pack_size) THEN 'low'
          ELSE 'ok'
        END as stock_status
      FROM items i
      LEFT JOIN batches b ON i.id = b.item_id
      WHERE 1=1
    `;

    const params: any[] = [currentYM, nearYM];

    if (search) {
      query += ` AND (LOWER(i.name) LIKE ? OR LOWER(i.company) LIKE ? OR LOWER(COALESCE(i.generic_name, '')) LIKE ? OR LOWER(COALESCE(b.batch_number, '')) LIKE ? OR i.barcode = ?)`;
      params.push(search, search, search, search, filters?.search?.trim());
    }

    if (status !== 'all') {
      if (status === 'exp') {
        query += ` AND b.expiry_date < ?`;
        params.push(currentYM);
      } else if (status === 'near') {
        query += ` AND b.expiry_date >= ? AND b.expiry_date <= ?`;
        params.push(currentYM, nearYM);
      } else if (status === 'low') {
        query += ` AND (b.id IS NULL OR (b.quantity_units <= (i.reorder_level * i.pack_size) AND b.expiry_date >= ?))`;
        params.push(currentYM);
      }
    }

    query += ` ORDER BY CASE WHEN b.id IS NULL THEN 1 ELSE 0 END ASC, b.expiry_date ASC, i.name ASC`;

    return this.database.prepare(query).all(...params);
  }

  public static formatPackLoose(units: number, packSize: number, form: string = 'tablet'): string {
    if (packSize <= 1) {
      return `${units} ${form}s`;
    }
    const packs = Math.floor(units / packSize);
    const loose = units % packSize;
    if (packs === 0) {
      return `${loose} loose`;
    }
    if (loose === 0) {
      return `${packs} strip${packs > 1 ? 's' : ''}`;
    }
    return `${packs} strip${packs > 1 ? 's' : ''} + ${loose} loose`;
  }
}

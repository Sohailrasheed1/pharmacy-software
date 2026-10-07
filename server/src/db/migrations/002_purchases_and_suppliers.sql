-- 002_purchases_and_suppliers.sql
-- Purchases (GRN) and Supplier Ledgers

-- 1. Purchases table
CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    invoice_number TEXT NOT NULL,
    invoice_date TEXT NOT NULL, -- YYYY-MM-DD
    total_amount_paisa INTEGER NOT NULL,
    paid_amount_paisa INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'COMPLETED', -- COMPLETED, CANCELLED
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_invoice ON purchases(invoice_number);

-- 2. Purchase items table
CREATE TABLE IF NOT EXISTS purchase_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    batch_id INTEGER NOT NULL,
    batch_number TEXT NOT NULL,
    expiry_date TEXT NOT NULL, -- YYYY-MM
    quantity_packs INTEGER NOT NULL,
    total_units INTEGER NOT NULL,
    purchase_rate_paisa INTEGER NOT NULL, -- per pack in paisa
    sale_rate_paisa INTEGER NOT NULL,     -- per pack in paisa
    total_amount_paisa INTEGER NOT NULL,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
    FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE RESTRICT
);

-- 3. Supplier Payments & Ledger
CREATE TABLE IF NOT EXISTS supplier_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    purchase_id INTEGER,
    payment_date TEXT NOT NULL, -- YYYY-MM-DD
    amount_paisa INTEGER NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'Cash', -- Cash, Bank, Cheque, Online
    reference_number TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE SET NULL
);

-- 4. Supplier Expiry Returns (Batches returned back to distributor)
CREATE TABLE IF NOT EXISTS supplier_returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    batch_id INTEGER NOT NULL,
    quantity_units INTEGER NOT NULL,
    refund_amount_paisa INTEGER NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE RESTRICT
);

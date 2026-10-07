-- 001_initial_schema.sql
-- Pharmacy Management System - Base Schema

-- 1. Items table
CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    generic_name TEXT,
    company TEXT NOT NULL,
    form TEXT NOT NULL,             -- tablet, capsule, syrup, injection, cream, sachet, bottle, etc.
    pack_size INTEGER NOT NULL DEFAULT 1, -- e.g. 10 tablets per strip/pack, or 1 for syrup
    loose_price_paisa INTEGER,      -- optional override for loose unit sale price in paisa
    barcode TEXT UNIQUE,
    reorder_level INTEGER NOT NULL DEFAULT 10,
    is_controlled INTEGER NOT NULL DEFAULT 0, -- 1 = Narcotic / psychotropic
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Index for fast lookup by name, generic, barcode
CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
CREATE INDEX IF NOT EXISTS idx_items_generic ON items(generic_name);
CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode);

-- 2. Batches table
-- Quantity is stored in base units (loose tablets, capsules, bottles, sachets)
CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    batch_number TEXT NOT NULL,
    expiry_date TEXT NOT NULL,          -- YYYY-MM
    quantity_units INTEGER NOT NULL DEFAULT 0, -- Total base units in stock
    purchase_rate_paisa INTEGER NOT NULL DEFAULT 0, -- per pack in paisa
    sale_rate_paisa INTEGER NOT NULL DEFAULT 0,     -- per pack in paisa
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_batches_item ON batches(item_id);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_batches_number ON batches(batch_number);

-- 3. Stock Movements (Central audit ledger for all inventory changes)
CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    movement_type TEXT NOT NULL, -- SALE, PURCHASE, RETURN_SALE, RETURN_SUPPLIER, ADJUSTMENT
    quantity_change INTEGER NOT NULL, -- +ve for addition, -ve for deduction (in base units)
    balance_after INTEGER NOT NULL,   -- base units in this batch after movement
    reference_type TEXT,              -- 'sale', 'purchase', 'adjustment', 'manual'
    reference_id INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_batch ON stock_movements(batch_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);

-- 4. Suppliers (Distributors)
CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    company_name TEXT,
    phone TEXT,
    address TEXT,
    balance_paisa INTEGER NOT NULL DEFAULT 0, -- what we owe in paisa
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 5. Customers (Udhaar Khata)
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    current_baqaya_paisa INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 6. Sales
CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER,
    payment_type TEXT NOT NULL DEFAULT 'Cash', -- Cash, Udhaar, Easypaisa, JazzCash
    subtotal_paisa INTEGER NOT NULL,
    discount_paisa INTEGER NOT NULL DEFAULT 0,
    total_paisa INTEGER NOT NULL,
    paid_paisa INTEGER NOT NULL,
    change_paisa INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'COMPLETED', -- COMPLETED, RETURNED
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- 7. Sale Items
CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    batch_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    is_loose INTEGER NOT NULL DEFAULT 0,
    quantity_units INTEGER NOT NULL,
    unit_price_paisa INTEGER NOT NULL,
    total_paisa INTEGER NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE RESTRICT,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT
);

-- 8. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 9. Settings
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES
('shop_name', 'Al-Shifa Pharmacy'),
('address', 'Main Bazar, Lahore, Pakistan'),
('phone', '0300-1234567'),
('receipt_footer', 'Get well soon! Check medicines before leaving.');

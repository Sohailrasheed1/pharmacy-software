-- 003_khata_and_reports.sql
-- Customer Khata Transactions & Ledger

CREATE TABLE IF NOT EXISTS customer_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    transaction_type TEXT NOT NULL, -- SALE_DEBIT, PAYMENT_CREDIT, RETURN_CREDIT
    amount_paisa INTEGER NOT NULL,
    balance_after_paisa INTEGER NOT NULL,
    reference_type TEXT,            -- 'sale', 'payment', 'return'
    reference_id INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_cust_trans_customer ON customer_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_cust_trans_date ON customer_transactions(created_at);

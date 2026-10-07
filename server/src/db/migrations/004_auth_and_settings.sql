-- 004_auth_and_settings.sql
-- Users, Roles, Audit Logs, and Enhanced Settings

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Cashier', -- Owner, Cashier
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Seed default Owner and Cashier
INSERT OR IGNORE INTO users (id, username, password_hash, role, name) VALUES
(1, 'owner', 'owner123', 'Owner', 'Pharmacist / Malik Sahib'),
(2, 'cashier', 'cashier123', 'Cashier', 'Counter Staff');

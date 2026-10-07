import { StockService } from '../services/stockService.js';
import { db } from '../config/database.js';

export function seedDatabase(database = db) {
  console.log('Seeding sample data for retail pharmacy...');

  const stockService = new StockService(database);

  // Clear existing data for fresh seed (in reverse dependency order)
  database.exec(`
    DELETE FROM stock_movements;
    DELETE FROM sale_items;
    DELETE FROM sales;
    DELETE FROM batches;
    DELETE FROM items;
    DELETE FROM suppliers;
    DELETE FROM customers;
  `);

  // 1. Insert Sample Items
  const insertItem = database.prepare(`
    INSERT INTO items 
      (name, generic_name, company, form, pack_size, loose_price_paisa, barcode, reorder_level, is_controlled)
    VALUES 
      (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const panadolId = Number(insertItem.run(
    'Panadol 500mg', 'Paracetamol', 'GSK', 'tablet', 10, 400, '8964000123456', 40, 0
  ).lastInsertRowid); // 10 tabs/strip, Rs 40/strip => loose Rs 4

  const augmentinId = Number(insertItem.run(
    'Augmentin 625mg', 'Amoxicillin + Clavulanic Acid', 'GSK', 'tablet', 6, 13000, '8964000234567', 10, 0
  ).lastInsertRowid); // 6 tabs/pack, Rs 760/pack => loose Rs 130

  const risekId = Number(insertItem.run(
    'Risek 40mg', 'Omeprazole', 'Getz Pharma', 'capsule', 14, 3800, '8964000345678', 10, 0
  ).lastInsertRowid); // 14 caps/pack, Rs 530/pack => loose Rs 38

  const brufenId = Number(insertItem.run(
    'Brufen 400mg', 'Ibuprofen', 'Abbott', 'tablet', 10, 1000, '8964000456789', 15, 0
  ).lastInsertRowid); // 10 tabs/strip, Rs 95/strip => loose Rs 10

  const calpolId = Number(insertItem.run(
    'Calpol 120mg/5ml', 'Paracetamol Syrup', 'GSK', 'bottle', 1, null, '8964000567890', 12, 0
  ).lastInsertRowid); // pack_size 1, bottle

  const orsId = Number(insertItem.run(
    'ORS Sachet (Nimkol)', 'Oral Rehydration Salts', 'Local', 'sachet', 1, null, '8964000678901', 50, 0
  ).lastInsertRowid); // pack_size 1, sachet

  const arinacId = Number(insertItem.run(
    'Arinac Forte', 'Ibuprofen + Pseudoephedrine', 'Abbott', 'tablet', 10, 800, '8964000789012', 10, 0
  ).lastInsertRowid);

  const flagylId = Number(insertItem.run(
    'Flagyl 400mg', 'Metronidazole', 'Sanofi', 'tablet', 10, 700, '8964000890123', 20, 0
  ).lastInsertRowid);

  const surbexId = Number(insertItem.run(
    'Surbex-Z', 'Zinc + High Potency B-Complex', 'Abbott', 'bottle', 1, null, '8964000901234', 8, 0
  ).lastInsertRowid);

  const lexotanilId = Number(insertItem.run(
    'Lexotanil 3mg', 'Bromazepam (Controlled)', 'Martin Dow', 'tablet', 30, null, '8964000011223', 5, 1
  ).lastInsertRowid); // Controlled drug example

  // 2. Insert Batches and stock movements
  const insertBatch = database.prepare(`
    INSERT INTO batches 
      (item_id, batch_number, expiry_date, quantity_units, purchase_rate_paisa, sale_rate_paisa)
    VALUES 
      (?, ?, ?, ?, ?, ?)
  `);

  // Helper date generators relative to now
  const now = new Date();
  const getRelativeYM = (offsetMonths: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const batchesToCreate = [
    // Panadol: 2 batches (1 near expiry ~ 1.5 months, 1 fresh ~ 14 months)
    { itemId: panadolId, num: 'PN2371', exp: getRelativeYM(1), units: 18 * 10, pRate: 3200, sRate: 4000 },
    { itemId: panadolId, num: 'PN2418', exp: getRelativeYM(14), units: 120 * 10, pRate: 3200, sRate: 4000 },
    // Augmentin: 9 packs of 6 tabs = 54 tabs
    { itemId: augmentinId, num: 'AG9921', exp: getRelativeYM(8), units: 9 * 6, pRate: 64000, sRate: 76000 },
    // Risek: 24 packs of 14 = 336 caps
    { itemId: risekId, num: 'RK5530', exp: getRelativeYM(11), units: 24 * 14, pRate: 44000, sRate: 53000 },
    // Brufen: near expiry (2 months)
    { itemId: brufenId, num: 'BR1187', exp: getRelativeYM(2), units: 31 * 10, pRate: 7500, sRate: 9500 },
    // Calpol: low stock (6 bottles)
    { itemId: calpolId, num: 'CP7714', exp: getRelativeYM(6), units: 6, pRate: 9800, sRate: 12000 },
    // Arinac Forte: EXPIRED batch (-1 month)
    { itemId: arinacId, num: 'AR3306', exp: getRelativeYM(-1), units: 14 * 10, pRate: 6200, sRate: 8000 },
    // Flagyl: 44 strips
    { itemId: flagylId, num: 'FL4402', exp: getRelativeYM(16), units: 44 * 10, pRate: 5400, sRate: 7000 },
    // ORS: 150 sachets
    { itemId: orsId, num: 'OR0912', exp: getRelativeYM(20), units: 150, pRate: 1800, sRate: 2500 },
    // Surbex-Z: near expiry (2 months)
    { itemId: surbexId, num: 'SZ6620', exp: getRelativeYM(2), units: 11, pRate: 26000, sRate: 31000 },
    // Lexotanil: controlled drug
    { itemId: lexotanilId, num: 'LX1092', exp: getRelativeYM(12), units: 60, pRate: 30000, sRate: 38000 }
  ];

  for (const b of batchesToCreate) {
    const batchId = Number(insertBatch.run(b.itemId, b.num, b.exp, 0, b.pRate, b.sRate).lastInsertRowid);
    // Use stockService to properly credit initial stock & audit movement
    stockService.changeStock({
      batchId,
      movementType: 'PURCHASE',
      quantityChangeUnits: b.units,
      referenceType: 'initial_seed',
      notes: 'Initial sample batch inventory'
    });
  }

  // 3. Insert Sample Suppliers
  const insertSupp = database.prepare(`
    INSERT INTO suppliers (name, company_name, phone, address, balance_paisa)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertSupp.run('Al-Fateh Distributors', 'GSK & Abbott Distributor', '0301-8889991', 'Circular Road, Lahore', 18450000); // Rs 184,500
  insertSupp.run('Medico Traders', 'Getz & Sanofi Partner', '0322-7776662', 'Katchery Bazar, Faisalabad', 9230000);     // Rs 92,300
  insertSupp.run('Sehat Pharma Link', 'Local Generics & Surgicals', '0334-5554443', 'Rawalpindi', 4100000);              // Rs 41,000

  // 4. Insert Sample Customers (Udhaar Khata)
  const insertCust = database.prepare(`
    INSERT INTO customers (name, phone, address, current_baqaya_paisa)
    VALUES (?, ?, ?, ?)
  `);
  insertCust.run('Mohammad Aslam', '0300 1234567', 'House #12, St 3', 345000); // Rs 3,450
  insertCust.run('Bushra Bibi', '0321 7654321', 'Main Bazar', 128000);          // Rs 1,280
  insertCust.run('Chaudhry Traders (staff)', '0333 5550101', 'Shop #4', 890000); // Rs 8,900
  insertCust.run('Dr. Tariq Clinic', '0345 2223344', 'Opposite Hospital', 0);

  console.log('Sample data seeded successfully.');
}

if (process.argv[1]?.includes('seed')) {
  try {
    seedDatabase();
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

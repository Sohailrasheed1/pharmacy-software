'use client';

import React, { useState, useEffect } from 'react';
import { formatCurrency, formatExpiry, formatPacksAndLoose } from '../utils/formatters';
import { AddItemModal } from '../components/AddItemModal';
import { AddBatchModal } from '../components/AddBatchModal';

export const StockPage: React.FC = () => {
  const [stockList, setStockList] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'near' | 'exp' | 'low'>('all');
  const [loading, setLoading] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isAddBatchOpen, setIsAddBatchOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);

  const fetchStock = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (filter !== 'all') query.set('status', filter);

      const res = await fetch(`/api/stock?${query.toString()}`);
      const data = await res.json();
      setStockList(data);
    } catch (err) {
      console.error('Failed to fetch stock:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/items');
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStock();
    fetchItems();
  }, [filter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStock();
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const pillText = {
    ok: 'OK',
    near: 'Near expiry',
    low: 'Low stock',
    exp: 'Expired'
  };

  return (
    <section>
      <div className="bar">
        <h2>Stock</h2>
        <span className="meta">Batch aur expiry ke hisaab se</span>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <div className="filters">
          <div className="field">
            <label htmlFor="stockSearch">Search</label>
            <input
              className="input"
              id="stockSearch"
              type="search"
              placeholder="Item, formula, company ya barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="field">
            <label htmlFor="stockFilter">Show</label>
            <select
              className="input"
              id="stockFilter"
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
            >
              <option value="all">All batches</option>
              <option value="near">Near expiry (&le; 90 days)</option>
              <option value="exp">Expired</option>
              <option value="low">Low stock (Reorder required)</option>
            </select>
          </div>

          <div className="field" style={{ flex: '0 0 auto', justifyContent: 'flex-end', flexDirection: 'row', gap: 8 }}>
            <button
              className="btn"
              type="button"
              onClick={() => setIsAddBatchOpen(true)}
            >
              + Add Batch
            </button>
            <button
              className="btn primary"
              type="button"
              onClick={() => setIsAddItemOpen(true)}
            >
              + Naya Item
            </button>
          </div>
        </div>

        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Batch</th>
                <th>Expiry</th>
                <th className="num">Stock Units</th>
                <th className="num">Price / Strip</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="empty">Loading inventory data...</td>
                </tr>
              ) : stockList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">Is filter se koi item nahi mila.</td>
                </tr>
              ) : (
                stockList.map((row) => (
                  <tr key={`${row.item_id}-${row.batch_id}`}>
                    <td>
                      <strong>{row.item_name}</strong>
                      {row.is_controlled === 1 && (
                        <span style={{ marginLeft: 6, color: 'var(--bad)', fontSize: 11, fontWeight: 700 }}>
                          [Controlled]
                        </span>
                      )}
                      <span className="sub">
                        {row.company} {row.generic_name ? `· (${row.generic_name})` : ''}
                      </span>
                    </td>
                    <td className="mono">{row.batch_number}</td>
                    <td className="nowrap mono">
                      {formatExpiry(row.expiry_date)}
                    </td>
                    <td className="num mono">
                      {formatPacksAndLoose(row.quantity_units, row.pack_size, row.form)}
                    </td>
                    <td className="num mono">
                      {formatCurrency(row.sale_rate_paisa)}
                      {row.pack_size > 1 && (
                        <span className="sub mono">
                          {formatCurrency(
                            row.loose_price_paisa || Math.round(row.sale_rate_paisa / row.pack_size)
                          )}{' '}
                          loose
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`pill ${row.stock_status}`}>
                        {pillText[row.stock_status as keyof typeof pillText]}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AddItemModal
        isOpen={isAddItemOpen}
        onClose={() => setIsAddItemOpen(false)}
        onSuccess={() => {
          fetchStock();
          fetchItems();
        }}
      />

      <AddBatchModal
        isOpen={isAddBatchOpen}
        onClose={() => setIsAddBatchOpen(false)}
        onSuccess={() => fetchStock()}
        items={items}
      />
    </section>
  );
};

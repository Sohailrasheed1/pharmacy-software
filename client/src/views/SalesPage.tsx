'use client';

import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../utils/formatters';
import { ThermalReceiptModal } from '../components/ThermalReceiptModal';

export const SalesPage: React.FC = () => {
  const [sales, setSales] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    billsCount: 0,
    totalSalesPaisa: 0,
    discountPaisa: 0,
    cashSalesPaisa: 0,
    udhaarSalesPaisa: 0
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toLocaleDateString('en-CA'));
  const [paymentType, setPaymentType] = useState<string>('all');
  const [expandedSaleId, setExpandedSaleId] = useState<number | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<number, any[]>>({});
  const [receiptData, setReceiptData] = useState<any | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  const loadStats = async () => {
    try {
      const res = await fetch('/api/sales/stats/today');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching sales stats:', err);
    }
  };

  const loadSales = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedDate) params.append('date', selectedDate);
      if (search.trim()) params.append('search', search.trim());
      if (paymentType && paymentType !== 'all') params.append('paymentType', paymentType);
      params.append('limit', '100');

      const res = await fetch(`/api/sales?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSales(data);
      }
    } catch (err) {
      console.error('Error fetching sales:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadSales();
  }, [selectedDate, paymentType]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadSales();
  };

  const handleOpenReceipt = async (saleId: number) => {
    try {
      const res = await fetch(`/api/sales/${saleId}`);
      if (res.ok) {
        const data = await res.json();
        setReceiptData(data);
        setIsReceiptOpen(true);
      }
    } catch (err) {
      console.error('Error fetching receipt data:', err);
    }
  };

  const toggleExpand = async (saleId: number) => {
    if (expandedSaleId === saleId) {
      setExpandedSaleId(null);
      return;
    }

    setExpandedSaleId(saleId);
    if (!expandedItems[saleId]) {
      try {
        const res = await fetch(`/api/sales/${saleId}`);
        if (res.ok) {
          const data = await res.json();
          setExpandedItems((prev) => ({ ...prev, [saleId]: data.items || [] }));
        }
      } catch (err) {
        console.error('Error fetching sale items:', err);
      }
    }
  };

  const setTodayDate = () => {
    setSelectedDate(new Date().toLocaleDateString('en-CA'));
  };

  const setAllDates = () => {
    setSelectedDate('');
  };

  return (
    <section>
      <div className="bar">
        <div>
          <h2>Sales & Bills Record (Sales History)</h2>
          <span className="meta">Cashier aur counter ki tamam sales, bills aur receipt prints</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn small"
            onClick={() => {
              loadStats();
              loadSales();
            }}
          >
            Refresh List
          </button>
        </div>
      </div>

      {/* Stats Summary for Today */}
      <div className="stats" style={{ marginTop: 14 }}>
        <div className="stat">
          <div className="k">Today's Sales (Kul Sale)</div>
          <div className="v" style={{ color: 'var(--accent)' }}>
            {formatCurrency(stats.totalSalesPaisa)}
          </div>
        </div>
        <div className="stat">
          <div className="k">Today's Bills Count</div>
          <div className="v mono">{stats.billsCount}</div>
        </div>
        <div className="stat">
          <div className="k">Cash Sales</div>
          <div className="v ok" style={{ color: 'var(--good)' }}>
            {formatCurrency(stats.cashSalesPaisa)}
          </div>
        </div>
        <div className="stat">
          <div className="k">Udhaar Sales</div>
          <div className="v warn">
            {formatCurrency(stats.udhaarSalesPaisa)}
          </div>
        </div>
      </div>

      {/* Search and Filter Panel */}
      <div className="panel" style={{ marginTop: 14 }}>
        <header>
          <h3>Bills Filter & Talash</h3>
          <span className="meta mono">{sales.length} bills found</span>
        </header>

        <form onSubmit={handleSearchSubmit} className="filters">
          <div className="field" style={{ flex: '2 1 240px' }}>
            <label htmlFor="searchSale">Bill # ya Customer Name/Phone</label>
            <input
              id="searchSale"
              className="input"
              type="search"
              placeholder="e.g. INV-202610-0004 ya customer name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="field" style={{ flex: '1 1 140px' }}>
            <label htmlFor="saleDate">Date</label>
            <input
              id="saleDate"
              className="input mono"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="field" style={{ flex: '1 1 120px' }}>
            <label htmlFor="paymentFilter">Payment Type</label>
            <select
              id="paymentFilter"
              className="input"
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value)}
            >
              <option value="all">Tamam (All)</option>
              <option value="Cash">Cash</option>
              <option value="Udhaar">Udhaar</option>
              <option value="Easypaisa">Easypaisa</option>
              <option value="JazzCash">JazzCash</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <button type="submit" className="btn primary">
              Talash Karein
            </button>
            <button
              type="button"
              className="btn small"
              style={{ height: 36 }}
              onClick={setTodayDate}
            >
              Aaj (Today)
            </button>
            <button
              type="button"
              className="btn small"
              style={{ height: 36 }}
              onClick={setAllDates}
            >
              Sab (All)
            </button>
          </div>
        </form>

        {/* Bills Table */}
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Waqt / Tareekh</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Payment</th>
                <th className="num">Subtotal</th>
                <th className="num">Dis</th>
                <th className="num">Net Total</th>
                <th style={{ textAlign: 'center' }}>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="empty">Bills load ho rahe hain...</td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty">
                    Koi bill nahi mila. (Try selecting "Sab (All)" ya clearing filters)
                  </td>
                </tr>
              ) : (
                sales.map((s) => {
                  const isExpanded = expandedSaleId === s.id;
                  const formattedTime = new Date(s.created_at).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  });

                  return (
                    <React.Fragment key={s.id}>
                      <tr style={{ background: isExpanded ? 'var(--accent-soft)' : undefined }}>
                        <td className="mono" style={{ fontWeight: 700 }}>
                          <button
                            type="button"
                            onClick={() => toggleExpand(s.id)}
                            style={{
                              background: 'none',
                              border: 0,
                              cursor: 'pointer',
                              color: 'var(--accent)',
                              fontFamily: 'inherit',
                              fontWeight: 700,
                              padding: 0,
                              textDecoration: 'underline'
                            }}
                            title="Click to view line items"
                          >
                            {s.bill_number}
                          </button>
                        </td>
                        <td className="mono" style={{ fontSize: 12 }}>
                          {formattedTime}
                        </td>
                        <td>
                          <strong>{s.customer_name || 'Walk-in Cash'}</strong>
                          {s.customer_phone && (
                            <span className="sub mono">{s.customer_phone}</span>
                          )}
                        </td>
                        <td className="mono">
                          <button
                            type="button"
                            className="btn small"
                            style={{ fontSize: 11, padding: '1px 6px' }}
                            onClick={() => toggleExpand(s.id)}
                          >
                            {s.items_count || 1} items {isExpanded ? '▲' : '▼'}
                          </button>
                        </td>
                        <td>
                          <span
                            className={`pill ${
                              s.payment_type === 'Cash'
                                ? 'ok'
                                : s.payment_type === 'Udhaar'
                                ? 'near'
                                : 'ok'
                            }`}
                          >
                            {s.payment_type}
                          </span>
                        </td>
                        <td className="num mono">{formatCurrency(s.subtotal_paisa)}</td>
                        <td className="num mono">
                          {s.discount_paisa > 0 ? (
                            <span style={{ color: 'var(--bad)' }}>
                              -{formatCurrency(s.discount_paisa)}
                            </span>
                          ) : (
                            '0'
                          )}
                        </td>
                        <td className="num mono" style={{ fontWeight: 700, fontSize: 13 }}>
                          {formatCurrency(s.total_paisa)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn small primary"
                            style={{ fontSize: 11, padding: '3px 8px' }}
                            onClick={() => handleOpenReceipt(s.id)}
                          >
                            Print Receipt
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Line Items Detail */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} style={{ padding: '8px 24px', background: 'var(--bg)' }}>
                            <div style={{ margin: '4px 0' }}>
                              <h4 style={{ fontSize: 12, marginBottom: 6, color: 'var(--muted)' }}>
                                Bill Items ({s.bill_number}):
                              </h4>
                              {expandedItems[s.id] ? (
                                <table style={{ background: 'var(--surface)', fontSize: 12 }}>
                                  <thead>
                                    <tr>
                                      <th>Medicine</th>
                                      <th>Batch</th>
                                      <th>Expiry</th>
                                      <th>Type</th>
                                      <th className="num">Qty</th>
                                      <th className="num">Rate</th>
                                      <th className="num">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {expandedItems[s.id].map((it: any) => (
                                      <tr key={it.id}>
                                        <td><strong>{it.item_name}</strong></td>
                                        <td className="mono">{it.batch_number}</td>
                                        <td className="mono">{it.expiry_date}</td>
                                        <td>{it.is_loose ? 'Loose Unit' : 'Full Pack'}</td>
                                        <td className="num mono">{it.units_deducted}</td>
                                        <td className="num mono">{formatCurrency(it.unit_price_paisa)}</td>
                                        <td className="num mono" style={{ fontWeight: 600 }}>
                                          {formatCurrency(it.total_paisa)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <p style={{ fontSize: 12 }}>Loading items...</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 80mm Thermal Receipt Modal */}
      <ThermalReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        receiptData={receiptData}
      />
    </section>
  );
};

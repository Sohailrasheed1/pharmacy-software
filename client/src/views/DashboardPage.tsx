'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatExpiry, formatPacksAndLoose } from '../utils/formatters';
import { ThermalReceiptModal } from '../components/ThermalReceiptModal';

interface DashboardPageProps {
  onNavigateToSales?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateToSales }) => {
  const router = useRouter();
  const handleNavSales = onNavigateToSales || (() => router.push('/sales'));
  const [stats, setStats] = useState<any>({
    nearOrExpiredBatches: 0,
    lowStockItems: 0,
    totalUdhaarPaisa: 0
  });
  const [todaySales, setTodaySales] = useState<any>({
    billsCount: 0,
    totalSalesPaisa: 0,
    discountPaisa: 0,
    cashSalesPaisa: 0,
    udhaarSalesPaisa: 0
  });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [nearBatches, setNearBatches] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [receiptData, setReceiptData] = useState<any | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  useEffect(() => {
    // Inventory stats
    fetch('/api/stock/stats')
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(console.error);

    // Today's live sales summary
    fetch('/api/sales/stats/today')
      .then((r) => r.json())
      .then((d) => setTodaySales(d))
      .catch(console.error);

    // Recent bills
    fetch('/api/sales?limit=6')
      .then((r) => r.json())
      .then((d) => setRecentSales(d))
      .catch(console.error);

    // Expiry warnings
    fetch('/api/stock?status=near')
      .then((r) => r.json())
      .then((d) => setNearBatches(d))
      .catch(console.error);

    // Low stock warnings
    fetch('/api/stock?status=low')
      .then((r) => r.json())
      .then((d) => setLowStockItems(d))
      .catch(console.error);
  }, []);

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

  return (
    <section>
      <div className="bar">
        <div>
          <h2>Dashboard</h2>
          <span className="meta">Aaj ka mukammal summary & counter status</span>
        </div>
        <button
          type="button"
          className="btn small"
          onClick={handleNavSales}
        >
          Tamam Bills Record (Sales History) →
        </button>
      </div>

      <div className="stats" style={{ marginTop: 14 }}>
        <div className="stat">
          <div className="k">Sales today (Aaj ki Sale)</div>
          <div className="v" style={{ color: 'var(--accent)' }}>
            {formatCurrency(todaySales.totalSalesPaisa)}
          </div>
        </div>
        <div className="stat">
          <div className="k">Bills today (Aaj ke Bills)</div>
          <div className="v mono">{todaySales.billsCount}</div>
        </div>
        <div className="stat">
          <div className="k">Expiring or expired</div>
          <div className="v warn">{stats.nearOrExpiredBatches}</div>
        </div>
        <div className="stat">
          <div className="k">Udhaar to collect</div>
          <div className="v">{formatCurrency(stats.totalUdhaarPaisa)}</div>
        </div>
      </div>

      {/* Recent Bills Section on Dashboard */}
      <div className="panel" style={{ marginTop: 16 }}>
        <header>
          <h3>Haal Hi Ki Sales (Recent Bills / Invoices)</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="meta mono">{recentSales.length} bills</span>
            <button
              type="button"
              className="btn small"
              onClick={handleNavSales}
              style={{ fontSize: 11 }}
            >
              View All
            </button>
          </div>
        </header>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Waqt / Time</th>
                <th>Customer</th>
                <th>Payment</th>
                <th className="num">Dis</th>
                <th className="num">Net Amount</th>
                <th style={{ textAlign: 'center' }}>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {recentSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">Abhi tak koi sale record nahi hui hai.</td>
                </tr>
              ) : (
                recentSales.map((s) => {
                  const formattedTime = new Date(s.created_at).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  });

                  return (
                    <tr key={s.id}>
                      <td className="mono" style={{ fontWeight: 700 }}>
                        {s.bill_number}
                      </td>
                      <td className="mono" style={{ fontSize: 12 }}>
                        {formattedTime}
                      </td>
                      <td>
                        <strong>{s.customer_name || 'Walk-in Cash'}</strong>
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
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          onClick={() => handleOpenReceipt(s.id)}
                        >
                          Print / View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="cols" style={{ marginTop: 16 }}>
        <div className="panel">
          <header>
            <h3>Expiry within 90 days</h3>
            <span className="meta mono">{nearBatches.length} batches</span>
          </header>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Batch</th>
                  <th>Expiry</th>
                  <th className="num">Qty</th>
                </tr>
              </thead>
              <tbody>
                {nearBatches.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty">Koi batch near expiry nahi hai.</td>
                  </tr>
                ) : (
                  nearBatches.slice(0, 5).map((b) => (
                    <tr key={b.batch_id}>
                      <td>
                        <strong>{b.item_name}</strong>
                        <span className="sub">{b.company}</span>
                      </td>
                      <td className="mono">{b.batch_number}</td>
                      <td className="nowrap mono">
                        {formatExpiry(b.expiry_date)}{' '}
                        <span className="pill near">Near expiry</span>
                      </td>
                      <td className="num mono">
                        {formatPacksAndLoose(b.quantity_units, b.pack_size, b.form)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <header>
            <h3>Low stock, reorder</h3>
            <span className="meta mono">{lowStockItems.length} items</span>
          </header>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="num">In stock</th>
                  <th className="num">Reorder at</th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="empty">Stock standard levels par hai.</td>
                  </tr>
                ) : (
                  lowStockItems.slice(0, 5).map((it) => (
                    <tr key={it.batch_id || it.item_id}>
                      <td>
                        <strong>{it.item_name}</strong>
                        <span className="sub">{it.company}</span>
                      </td>
                      <td className="num mono">
                        {formatPacksAndLoose(it.quantity_units, it.pack_size, it.form)}
                      </td>
                      <td className="num mono">{it.reorder_level} packs</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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

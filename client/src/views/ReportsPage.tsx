'use client';

import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../utils/formatters';

export const ReportsPage: React.FC = () => {
  const [activeReport, setActiveReport] = useState<'daily' | 'profit' | 'controlled'>('daily');
  const [dailyData, setDailyData] = useState<any | null>(null);
  const [profitData, setProfitData] = useState<any[]>([]);
  const [controlledData, setControlledData] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toLocaleDateString('en-CA'));

  const loadDailyReport = async (dateStr: string) => {
    try {
      const res = await fetch(`/api/reports/daily-close?date=${dateStr}`);
      const data = await res.json();
      setDailyData(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadProfitReport = async () => {
    try {
      const res = await fetch('/api/reports/profit-by-item');
      const data = await res.json();
      setProfitData(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadControlledReport = async () => {
    try {
      const res = await fetch('/api/reports/controlled-drugs');
      const data = await res.json();
      setControlledData(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeReport === 'daily') loadDailyReport(selectedDate);
    if (activeReport === 'profit') loadProfitReport();
    if (activeReport === 'controlled') loadControlledReport();
  }, [activeReport, selectedDate]);

  return (
    <section>
      <div className="bar">
        <h2>Reports & Registers</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn small"
            type="button"
            style={{ fontWeight: activeReport === 'daily' ? 700 : 400 }}
            onClick={() => setActiveReport('daily')}
          >
            Daily Close & Cash
          </button>
          <button
            className="btn small"
            type="button"
            style={{ fontWeight: activeReport === 'profit' ? 700 : 400 }}
            onClick={() => setActiveReport('profit')}
          >
            Profit by Item
          </button>
          <button
            className="btn small"
            type="button"
            style={{ fontWeight: activeReport === 'controlled' ? 700 : 400 }}
            onClick={() => setActiveReport('controlled')}
          >
            Controlled Register
          </button>
        </div>
      </div>

      {activeReport === 'daily' && (
        <div className="panel" style={{ marginTop: 14 }}>
          <header>
            <h3>Daily Sales & Cash Close (Shift End)</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="input mono"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ width: 140 }}
              />
            </div>
          </header>

          <div style={{ padding: 14 }}>
            <div className="stats">
              <div className="stat">
                <div className="k">Total Bills</div>
                <div className="v">{dailyData?.bills?.length || 0}</div>
              </div>
              <div className="stat">
                <div className="k">Total Sales</div>
                <div className="v">
                  {formatCurrency(
                    dailyData?.summary?.reduce((a: any, b: any) => a + (b.total_paisa || 0), 0) || 0
                  )}
                </div>
              </div>
              <div className="stat">
                <div className="k">Cash in Hand</div>
                <div className="v" style={{ color: 'var(--good)' }}>
                  {formatCurrency(
                    (dailyData?.summary?.find((s: any) => s.payment_type === 'Cash')?.paid_paisa || 0) +
                      (dailyData?.khataCollectedPaisa || 0)
                  )}
                </div>
              </div>
              <div className="stat">
                <div className="k">Udhaar Sold Today</div>
                <div className="v warn">
                  {formatCurrency(
                    dailyData?.summary?.find((s: any) => s.payment_type === 'Udhaar')?.total_paisa || 0
                  )}
                </div>
              </div>
            </div>

            <h4 style={{ marginTop: 16 }}>Bills List for {selectedDate}</h4>
            <div className="tablewrap" style={{ marginTop: 8 }}>
              <table>
                <thead>
                  <tr>
                    <th>Bill #</th>
                    <th>Customer</th>
                    <th>Payment</th>
                    <th className="num">Subtotal</th>
                    <th className="num">Discount</th>
                    <th className="num">Net Total</th>
                  </tr>
                </thead>
                <tbody>
                  {!dailyData?.bills || dailyData.bills.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="empty">Is tareeq ka koi bill nahi mila.</td>
                    </tr>
                  ) : (
                    dailyData.bills.map((b: any) => (
                      <tr key={b.id}>
                        <td className="mono"><strong>{b.bill_number}</strong></td>
                        <td>{b.customer_name || 'Walk-in'}</td>
                        <td>{b.payment_type}</td>
                        <td className="num mono">{formatCurrency(b.subtotal_paisa)}</td>
                        <td className="num mono">{formatCurrency(b.discount_paisa)}</td>
                        <td className="num mono"><strong>{formatCurrency(b.total_paisa)}</strong></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeReport === 'profit' && (
        <div className="panel" style={{ marginTop: 14 }}>
          <header>
            <h3>Profit by Item Report</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href="/api/reports/export/excel?type=profit" className="btn small primary" download>
                Export Excel (.xlsx)
              </a>
              <a href="/api/reports/export/pdf?type=profit" className="btn small" download>
                Export PDF
              </a>
            </div>
          </header>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Company</th>
                  <th className="num">Units Sold</th>
                  <th className="num">Revenue</th>
                  <th className="num">Estimated Cost</th>
                  <th className="num">Net Profit</th>
                </tr>
              </thead>
              <tbody>
                {profitData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty">Koi sales history nahi mili.</td>
                  </tr>
                ) : (
                  profitData.map((r, i) => (
                    <tr key={i}>
                      <td><strong>{r.item_name}</strong></td>
                      <td>{r.company}</td>
                      <td className="num mono">{r.total_units_sold}</td>
                      <td className="num mono">{formatCurrency(r.revenue_paisa)}</td>
                      <td className="num mono">{formatCurrency(r.cost_paisa)}</td>
                      <td className="num mono">
                        <strong style={{ color: r.profit_paisa >= 0 ? 'var(--good)' : 'var(--bad)' }}>
                          {formatCurrency(r.profit_paisa)}
                        </strong>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeReport === 'controlled' && (
        <div className="panel" style={{ marginTop: 14 }}>
          <header>
            <h3>Controlled & Narcotic Drugs Register</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href="/api/reports/export/excel?type=controlled" className="btn small primary" download>
                Export Excel (.xlsx)
              </a>
              <a href="/api/reports/export/pdf?type=controlled" className="btn small" download>
                Export PDF (Inspection)
              </a>
            </div>
          </header>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Bill #</th>
                  <th>Medicine</th>
                  <th>Batch #</th>
                  <th className="num">Units Sold</th>
                  <th>Customer / Patient</th>
                </tr>
              </thead>
              <tbody>
                {controlledData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty">Controlled medicines ki koi sale nahi hui.</td>
                  </tr>
                ) : (
                  controlledData.map((c) => (
                    <tr key={c.id}>
                      <td className="nowrap">{c.created_at?.split(' ')[0]}</td>
                      <td className="mono">{c.bill_number}</td>
                      <td><strong>{c.item_name}</strong></td>
                      <td className="mono">{c.batch_number}</td>
                      <td className="num mono">{c.quantity_units}</td>
                      <td>{c.customer_name || 'Walk-in'} {c.customer_phone ? `(${c.customer_phone})` : ''}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};

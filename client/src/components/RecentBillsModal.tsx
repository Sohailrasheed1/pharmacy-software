'use client';

import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../utils/formatters';

interface RecentBillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewReceipt: (saleId: number) => void;
}

export const RecentBillsModal: React.FC<RecentBillsModalProps> = ({
  isOpen,
  onClose,
  onViewReceipt
}) => {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRecentBills = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sales?limit=15');
      if (res.ok) {
        const data = await res.json();
        setBills(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRecentBills();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 640 }}>
        <header className="modal-header">
          <div>
            <h3>Haal Hi Ke Bills (Recent Invoices)</h3>
            <span className="meta" style={{ fontSize: 12 }}>
              Cashier counter ke aakhri 15 bills ka mukammal record
            </span>
          </div>
          <button className="btn small" onClick={onClose} type="button">✕</button>
        </header>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Bill #</th>
                  <th>Waqt</th>
                  <th>Customer</th>
                  <th>Pay</th>
                  <th className="num">Total</th>
                  <th style={{ textAlign: 'center' }}>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="empty">Loading bills...</td>
                  </tr>
                ) : bills.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty">Abhi koi bills nahi hain.</td>
                  </tr>
                ) : (
                  bills.map((b) => {
                    const timeStr = new Date(b.created_at).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    });

                    return (
                      <tr key={b.id}>
                        <td className="mono" style={{ fontWeight: 700 }}>{b.bill_number}</td>
                        <td className="mono" style={{ fontSize: 12 }}>{timeStr}</td>
                        <td><strong>{b.customer_name || 'Walk-in Cash'}</strong></td>
                        <td>
                          <span className={`pill ${b.payment_type === 'Cash' ? 'ok' : 'near'}`}>
                            {b.payment_type}
                          </span>
                        </td>
                        <td className="num mono" style={{ fontWeight: 700 }}>
                          {formatCurrency(b.total_paisa)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn small primary"
                            style={{ fontSize: 11, padding: '2px 8px' }}
                            onClick={() => {
                              onViewReceipt(b.id);
                            }}
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="btn" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

'use client';

import React, { useState } from 'react';
import { formatCurrency } from '../utils/formatters';

interface SaleReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const SaleReturnModal: React.FC<SaleReturnModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [billNumber, setBillNumber] = useState('');
  const [saleData, setSaleData] = useState<any>(null);
  const [returnQtys, setReturnQtys] = useState<{ [saleItemId: number]: number }>({});
  const [reason, setReason] = useState('Customer returned / Exchanged medicine');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSearchBill = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSaleData(null);

    try {
      // Find bill by bill number
      const res = await fetch(`/api/sales?limit=100`);
      const allSales = await res.json();
      const matched = allSales.find(
        (s: any) => s.bill_number.toLowerCase() === billNumber.trim().toLowerCase()
      );

      if (!matched) {
        throw new Error(`Bill number '${billNumber}' nahi mila.`);
      }

      // Fetch full bill details
      const detailRes = await fetch(`/api/sales/${matched.id}`);
      const fullData = await detailRes.json();
      setSaleData(fullData);

      const initQtys: any = {};
      for (const it of fullData.items) {
        initQtys[it.id] = 0;
      }
      setReturnQtys(initQtys);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessReturn = async () => {
    setLoading(true);
    setError('');

    const returnItems = Object.entries(returnQtys)
      .filter(([_, q]) => Number(q) > 0)
      .map(([id, q]) => ({
        saleItemId: Number(id),
        quantityUnitsToReturn: Number(q)
      }));

    if (returnItems.length === 0) {
      setError('Wapis karne ke liye kam az kam aik item ki quantity chunein.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/sales/${saleData.sale.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnItems, reason })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process return');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 540 }}>
        <header className="modal-header">
          <h3>Sale Return (Bill Wapsi)</h3>
          <button className="btn small" onClick={onClose} type="button">✕</button>
        </header>

        <div className="modal-body">
          {error && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{error}</div>}

          {!saleData ? (
            <form onSubmit={handleSearchBill} style={{ display: 'flex', gap: 8 }}>
              <input
                className="input mono"
                placeholder="Bill number e.g. INV-202610-0001"
                required
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
              />
              <button className="btn primary" type="submit" disabled={loading}>
                {loading ? 'Searching...' : 'Dhoondein'}
              </button>
            </form>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <strong>{saleData.sale.bill_number}</strong>
                  <div className="meta">{saleData.sale.payment_type} · Total: {formatCurrency(saleData.sale.total_paisa)}</div>
                </div>
                <button
                  className="btn small"
                  type="button"
                  onClick={() => {
                    setSaleData(null);
                    setBillNumber('');
                  }}
                >
                  Change Bill
                </button>
              </div>

              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="num">Bought</th>
                      <th className="num">Return Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saleData.items.map((it: any) => (
                      <tr key={it.id}>
                        <td>
                          <strong>{it.item_name}</strong>
                          <span className="sub mono">Batch {it.batch_number}</span>
                        </td>
                        <td className="num mono">
                          {it.quantity_units} {it.is_loose ? 'tab' : 'units'}
                        </td>
                        <td className="num">
                          <input
                            className="input mono"
                            type="number"
                            min="0"
                            max={it.quantity_units}
                            style={{ width: 80, textAlign: 'right' }}
                            value={returnQtys[it.id] || 0}
                            onChange={(e) => {
                              const v = Math.min(it.quantity_units, Math.max(0, Number(e.target.value)));
                              setReturnQtys({ ...returnQtys, [it.id]: v });
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="field" style={{ marginTop: 12 }}>
                <label>Reason for return</label>
                <input
                  className="input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <footer className="modal-footer">
          <button className="btn" type="button" onClick={onClose}>Cancel</button>
          {saleData && (
            <button className="btn primary" type="button" onClick={handleProcessReturn} disabled={loading}>
              {loading ? 'Processing...' : 'Confirm Return & Restore Stock'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};

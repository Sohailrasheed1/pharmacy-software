'use client';

import React, { useState } from 'react';

interface NewGRNModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  suppliers: any[];
  items: any[];
}

export const NewGRNModal: React.FC<NewGRNModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  suppliers,
  items
}) => {
  const [supplierId, setSupplierId] = useState<number>(suppliers[0]?.id || 0);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [paidAmountRs, setPaidAmountRs] = useState(0);

  // Line items for this GRN
  const [lines, setLines] = useState<Array<{
    itemId: number;
    batchNumber: string;
    expiryMonth: string;
    expiryYear: string;
    quantityPacks: number;
    purchaseRateRs: number;
    saleRateRs: number;
  }>>([
    {
      itemId: items[0]?.id || 0,
      batchNumber: '',
      expiryMonth: '12',
      expiryYear: '2027',
      quantityPacks: 10,
      purchaseRateRs: 0,
      saleRateRs: 0
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleAddLine = () => {
    setLines([
      ...lines,
      {
        itemId: items[0]?.id || 0,
        batchNumber: '',
        expiryMonth: '12',
        expiryYear: '2027',
        quantityPacks: 10,
        purchaseRateRs: 0,
        saleRateRs: 0
      }
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== idx));
    }
  };

  const totalBillRs = lines.reduce((acc, l) => acc + l.quantityPacks * l.purchaseRateRs, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        supplierId: Number(supplierId || suppliers[0]?.id),
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        paidAmountPaisa: Math.round(Number(paidAmountRs) * 100),
        items: lines.map((l) => ({
          itemId: Number(l.itemId),
          batchNumber: l.batchNumber.trim().toUpperCase(),
          expiryDate: `${l.expiryYear}-${l.expiryMonth.padStart(2, '0')}`,
          quantityPacks: Number(l.quantityPacks),
          purchaseRatePaisa: Math.round(Number(l.purchaseRateRs) * 100),
          saleRatePaisa: Math.round(Number(l.saleRateRs) * 100)
        }))
      };

      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save GRN purchase');
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
      <div className="modal-content" style={{ maxWidth: 750 }}>
        <header className="modal-header">
          <h3>Purchase Entry (GRN) - Stock Inward</h3>
          <button className="btn small" onClick={onClose} type="button">✕</button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
            {error && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{error}</div>}

            <div className="cols">
              <div className="field">
                <label>Distributor / Supplier *</label>
                <select
                  className="input"
                  value={supplierId}
                  onChange={(e) => setSupplierId(Number(e.target.value))}
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.company_name || 'Distributor'})</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Distributor Invoice # *</label>
                <input
                  className="input mono"
                  required
                  placeholder="e.g. INV-8839"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Invoice Date</label>
                <input
                  className="input mono"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>
            </div>

            <div className="tablewrap" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Batch #</th>
                    <th>Expiry (MM/YY)</th>
                    <th className="num">Packs</th>
                    <th className="num">Cost / pk</th>
                    <th className="num">Sale / pk</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => (
                    <tr key={idx}>
                      <td style={{ minWidth: 150 }}>
                        <select
                          className="input"
                          value={line.itemId}
                          onChange={(e) => {
                            const copy = [...lines];
                            copy[idx].itemId = Number(e.target.value);
                            setLines(copy);
                          }}
                        >
                          {items.map((it) => (
                            <option key={it.id} value={it.id}>{it.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          className="input mono"
                          style={{ width: 90 }}
                          required
                          placeholder="BATCH"
                          value={line.batchNumber}
                          onChange={(e) => {
                            const copy = [...lines];
                            copy[idx].batchNumber = e.target.value;
                            setLines(copy);
                          }}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input
                            className="input mono"
                            style={{ width: 45 }}
                            placeholder="MM"
                            value={line.expiryMonth}
                            onChange={(e) => {
                              const copy = [...lines];
                              copy[idx].expiryMonth = e.target.value;
                              setLines(copy);
                            }}
                          />
                          <input
                            className="input mono"
                            style={{ width: 60 }}
                            placeholder="YYYY"
                            value={line.expiryYear}
                            onChange={(e) => {
                              const copy = [...lines];
                              copy[idx].expiryYear = e.target.value;
                              setLines(copy);
                            }}
                          />
                        </div>
                      </td>
                      <td className="num">
                        <input
                          className="input mono"
                          type="number"
                          min="1"
                          style={{ width: 65, textAlign: 'right' }}
                          value={line.quantityPacks}
                          onChange={(e) => {
                            const copy = [...lines];
                            copy[idx].quantityPacks = Number(e.target.value);
                            setLines(copy);
                          }}
                        />
                      </td>
                      <td className="num">
                        <input
                          className="input mono"
                          type="number"
                          min="0"
                          style={{ width: 75, textAlign: 'right' }}
                          value={line.purchaseRateRs}
                          onChange={(e) => {
                            const copy = [...lines];
                            copy[idx].purchaseRateRs = Number(e.target.value);
                            setLines(copy);
                          }}
                        />
                      </td>
                      <td className="num">
                        <input
                          className="input mono"
                          type="number"
                          min="0"
                          style={{ width: 75, textAlign: 'right' }}
                          value={line.saleRateRs}
                          onChange={(e) => {
                            const copy = [...lines];
                            copy[idx].saleRateRs = Number(e.target.value);
                            setLines(copy);
                          }}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn small"
                          onClick={() => handleRemoveLine(idx)}
                          style={{ color: 'var(--bad)' }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              className="btn small"
              type="button"
              onClick={handleAddLine}
              style={{ marginTop: 8 }}
            >
              + Add Item Line
            </button>

            <div className="cols" style={{ marginTop: 14, background: 'var(--bg)', padding: 12, borderRadius: 6 }}>
              <div>
                <strong>Total Bill: </strong>
                <span className="mono" style={{ fontSize: 16 }}>Rs {totalBillRs.toLocaleString()}</span>
              </div>
              <div className="field">
                <label>Paid Now (Rs)</label>
                <input
                  className="input mono"
                  type="number"
                  min="0"
                  max={totalBillRs}
                  value={paidAmountRs}
                  onChange={(e) => setPaidAmountRs(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <footer className="modal-footer">
            <button className="btn" type="button" onClick={onClose}>Cancel</button>
            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? 'Saving GRN...' : 'Save Purchase Entry'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

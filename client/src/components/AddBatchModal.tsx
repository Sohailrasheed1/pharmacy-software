'use client';

import React, { useState } from 'react';

interface AddBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  items: Array<{ id: number; name: string; company: string; form: string; pack_size: number }>;
}

export const AddBatchModal: React.FC<AddBatchModalProps> = ({ isOpen, onClose, onSuccess, items }) => {
  const [itemId, setItemId] = useState<number>(items[0]?.id || 0);
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('12');
  const [expiryYear, setExpiryYear] = useState('2026');
  const [quantityPacks, setQuantityPacks] = useState<string>(''); // blank by default
  const [purchaseRateRs, setPurchaseRateRs] = useState<string>(''); // blank by default
  const [saleRateRs, setSaleRateRs] = useState<string>(''); // blank by default
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const selectedItem = items.find((i) => i.id === itemId) || items[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const expiryDate = `${expiryYear}-${expiryMonth.padStart(2, '0')}`;
    const totalUnits = Number(quantityPacks) * (selectedItem?.pack_size || 1);

    try {
      const res = await fetch('/api/stock/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: selectedItem?.id,
          batch_number: batchNumber.trim().toUpperCase(),
          expiry_date: expiryDate,
          quantity_units: totalUnits,
          purchase_rate_paisa: Math.round(Number(purchaseRateRs) * 100),
          sale_rate_paisa: Math.round(Number(saleRateRs) * 100),
          notes: 'New Batch Added from Stock Screen'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add batch');
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
      <div className="modal-content">
        <header className="modal-header">
          <h3>Naya Batch Entry (Add Stock Batch)</h3>
          <button className="btn small" onClick={onClose} type="button">✕</button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{error}</div>}

            <div className="field">
              <label>Select Item *</label>
              <select
                className="input"
                value={selectedItem?.id}
                onChange={(e) => setItemId(Number(e.target.value))}
              >
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({it.company}) - Pack of {it.pack_size}
                  </option>
                ))}
              </select>
            </div>

            <div className="cols">
              <div className="field">
                <label>Batch Number *</label>
                <input
                  className="input mono"
                  required
                  placeholder="e.g. PN2418"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Expiry (MM / YYYY) *</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select
                    className="input mono"
                    value={expiryMonth}
                    onChange={(e) => setExpiryMonth(e.target.value)}
                  >
                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <select
                    className="input mono"
                    value={expiryYear}
                    onChange={(e) => setExpiryYear(e.target.value)}
                  >
                    {[2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="field">
              <label>Initial Stock (Number of {selectedItem?.pack_size > 1 ? 'Packs/Strips' : 'Units'}) *</label>
              <input
                className="input mono"
                type="number"
                min="1"
                placeholder="Packs / Bottles"
                required
                value={quantityPacks}
                onChange={(e) => setQuantityPacks(e.target.value)}
              />
              <span className="meta mono" style={{ fontSize: 11 }}>
                Total base units added: {(Number(quantityPacks) || 0) * (selectedItem?.pack_size || 1)} {selectedItem?.form}s
              </span>
            </div>

            <div className="cols">
              <div className="field">
                <label>Purchase Rate (Rs per pack) *</label>
                <input
                  className="input mono"
                  type="number"
                  min="0"
                  placeholder="Cost price"
                  required
                  value={purchaseRateRs}
                  onChange={(e) => setPurchaseRateRs(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Sale Rate (Rs per pack) *</label>
                <input
                  className="input mono"
                  type="number"
                  min="0"
                  placeholder="Sale price"
                  required
                  value={saleRateRs}
                  onChange={(e) => setSaleRateRs(e.target.value)}
                />
              </div>
            </div>
          </div>

          <footer className="modal-footer">
            <button className="btn" type="button" onClick={onClose}>Cancel</button>
            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Batch Stock'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

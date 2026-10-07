'use client';

import React, { useState } from 'react';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddItemModal: React.FC<AddItemModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [company, setCompany] = useState('');
  const [form, setForm] = useState('tablet');
  const [packSize, setPackSize] = useState<string>('10');
  const [loosePriceRs, setLoosePriceRs] = useState('');
  const [barcode, setBarcode] = useState('');
  const [reorderLevel, setReorderLevel] = useState<string>('10');
  const [isControlled, setIsControlled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          generic_name: genericName || null,
          company,
          form,
          pack_size: Number(packSize),
          loose_price_paisa: loosePriceRs ? Math.round(Number(loosePriceRs) * 100) : null,
          barcode: barcode || null,
          reorder_level: Number(reorderLevel),
          is_controlled: isControlled ? 1 : 0
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save item');
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
          <h3>Naya Item Shamil Karein (Add Item)</h3>
          <button className="btn small" onClick={onClose} type="button">✕</button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{error}</div>}

            <div className="field">
              <label>Medicine / Item Name *</label>
              <input
                className="input"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Panadol 500mg"
              />
            </div>

            <div className="field">
              <label>Generic / Salt Name (Formula)</label>
              <input
                className="input"
                value={genericName}
                onChange={(e) => setGenericName(e.target.value)}
                placeholder="e.g. Paracetamol"
              />
            </div>

            <div className="cols">
              <div className="field">
                <label>Company / Manufacturer *</label>
                <input
                  className="input"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. GSK, Abbott, Getz"
                />
              </div>
              <div className="field">
                <label>Form *</label>
                <select className="input" value={form} onChange={(e) => {
                  const f = e.target.value;
                  setForm(f);
                  if (f === 'syrup' || f === 'bottle' || f === 'sachet' || f === 'injection') {
                    setPackSize('1');
                  }
                }}>
                  <option value="tablet">Tablet</option>
                  <option value="capsule">Capsule</option>
                  <option value="syrup">Syrup</option>
                  <option value="bottle">Bottle</option>
                  <option value="sachet">Sachet</option>
                  <option value="injection">Injection</option>
                  <option value="cream">Cream / Ointment</option>
                  <option value="drops">Drops</option>
                </select>
              </div>
            </div>

            <div className="cols">
              <div className="field">
                <label>Pack Size (Units in 1 Pack/Strip) *</label>
                <input
                  className="input mono"
                  type="number"
                  min="1"
                  placeholder="e.g. 10"
                  required
                  value={packSize}
                  onChange={(e) => setPackSize(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Loose Price Override (Rs/Tablet)</label>
                <input
                  className="input mono"
                  type="number"
                  placeholder="Auto if blank"
                  value={loosePriceRs}
                  onChange={(e) => setLoosePriceRs(e.target.value)}
                />
              </div>
            </div>

            <div className="cols">
              <div className="field">
                <label>Barcode Scanner Input</label>
                <input
                  className="input mono"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Scan or type barcode"
                />
              </div>
              <div className="field">
                <label>Reorder Alert Level (Packs)</label>
                <input
                  className="input mono"
                  type="number"
                  min="0"
                  placeholder="e.g. 10"
                  value={reorderLevel}
                  onChange={(e) => setReorderLevel(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <input
                type="checkbox"
                id="controlled"
                checked={isControlled}
                onChange={(e) => setIsControlled(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              <label htmlFor="controlled" style={{ fontWeight: 600, fontSize: 13 }}>
                Controlled / Narcotic Drug (Special register required)
              </label>
            </div>
          </div>

          <footer className="modal-footer">
            <button className="btn" type="button" onClick={onClose}>Cancel</button>
            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Item'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

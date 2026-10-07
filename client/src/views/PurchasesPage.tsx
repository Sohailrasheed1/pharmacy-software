'use client';

import { useState, useEffect } from 'react';
import { formatCurrency, formatExpiry } from '../utils/formatters';
import { NewGRNModal } from '../components/NewGRNModal';

export const PurchasesPage = () => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [expiryReturns, setExpiryReturns] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'suppliers' | 'grn' | 'returns'>('suppliers');

  // Modals
  const [isGRNOpen, setIsGRNOpen] = useState(false);
  const [paySupplier, setPaySupplier] = useState<any | null>(null);
  const [payAmountRs, setPayAmountRs] = useState(0);
  const [payNotes, setPayNotes] = useState('Payment via cash/bank');

  const loadData = async () => {
    try {
      const sRes = await fetch('/api/purchases/suppliers');
      const sData = await sRes.json();
      setSuppliers(sData);

      const pRes = await fetch('/api/purchases');
      const pData = await pRes.json();
      setPurchases(pData);

      const rRes = await fetch('/api/purchases/expiry-returns');
      const rData = await rRes.json();
      setExpiryReturns(rData);

      const iRes = await fetch('/api/items');
      const iData = await iRes.json();
      setItems(iData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMakePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paySupplier || payAmountRs <= 0) return;

    try {
      await fetch('/api/purchases/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: paySupplier.id,
          amountPaisa: Math.round(payAmountRs * 100),
          notes: payNotes
        })
      });
      setPaySupplier(null);
      setPayAmountRs(0);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReturnBatch = async (batch: any) => {
    if (!confirm(`Return ${batch.quantity_units} units of ${batch.item_name} to distributor?`)) return;

    const supp = suppliers.find((s) => s.company_name?.includes(batch.company) || s.name.includes(batch.company)) || suppliers[0];

    try {
      await fetch('/api/purchases/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supp.id,
          batchId: batch.batch_id,
          quantityUnits: batch.quantity_units,
          refundAmountPaisa: batch.estimated_claim_paisa,
          reason: 'Expiry return claim'
        })
      });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <section>
      <div className="bar">
        <h2>Suppliers & Purchases</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn small"
            type="button"
            onClick={() => setActiveTab('suppliers')}
            style={{ fontWeight: activeTab === 'suppliers' ? 700 : 400 }}
          >
            Distributors Ledger
          </button>
          <button
            className="btn small"
            type="button"
            onClick={() => setActiveTab('grn')}
            style={{ fontWeight: activeTab === 'grn' ? 700 : 400 }}
          >
            Recent GRNs
          </button>
          <button
            className="btn small"
            type="button"
            onClick={() => setActiveTab('returns')}
            style={{ fontWeight: activeTab === 'returns' ? 700 : 400 }}
          >
            Expiry Returns ({expiryReturns.length})
          </button>
          <button
            className="btn primary small"
            type="button"
            onClick={() => setIsGRNOpen(true)}
          >
            + New Purchase (GRN)
          </button>
        </div>
      </div>

      {activeTab === 'suppliers' && (
        <div className="panel" style={{ marginTop: 14 }}>
          <header>
            <h3>Payable Accounts (Distributor Ledger)</h3>
            <span className="meta">Baqaya jo hum ne distributor ko dena hai</span>
          </header>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Distributor / Company</th>
                  <th>Contact</th>
                  <th className="num">We Owe (Baqaya)</th>
                  <th>Last Inward</th>
                  <th className="num">Action</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name}</strong>
                      <span className="sub">{s.company_name} · {s.address}</span>
                    </td>
                    <td className="mono">{s.phone || '—'}</td>
                    <td className="num mono">
                      <strong style={{ color: s.balance_paisa > 0 ? 'var(--warn)' : 'var(--good)' }}>
                        {formatCurrency(s.balance_paisa)}
                      </strong>
                    </td>
                    <td className="nowrap">{s.last_purchase_date || 'None'}</td>
                    <td className="num">
                      <button
                        className="btn small"
                        type="button"
                        onClick={() => {
                          setPaySupplier(s);
                          setPayAmountRs(Math.round(s.balance_paisa / 100));
                        }}
                      >
                        Pay / Adaigi
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'grn' && (
        <div className="panel" style={{ marginTop: 14 }}>
          <header>
            <h3>Purchases Inward History (GRN Bills)</h3>
          </header>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Distributor</th>
                  <th>Date</th>
                  <th className="num">Bill Amount</th>
                  <th className="num">Paid</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <td className="mono"><strong>{p.invoice_number}</strong></td>
                    <td>{p.supplier_name}</td>
                    <td className="nowrap">{p.invoice_date}</td>
                    <td className="num mono">{formatCurrency(p.total_amount_paisa)}</td>
                    <td className="num mono">{formatCurrency(p.paid_amount_paisa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'returns' && (
        <div className="panel" style={{ marginTop: 14 }}>
          <header>
            <h3>Expiry & Return List (Distributor Wapsi)</h3>
            <span className="meta">Distributor ko wapis bhejne wali dawaiyan (&le; 90 days)</span>
          </header>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Item / Company</th>
                  <th>Batch #</th>
                  <th>Expiry</th>
                  <th className="num">Quantity</th>
                  <th className="num">Est. Claim Amount</th>
                  <th className="num">Action</th>
                </tr>
              </thead>
              <tbody>
                {expiryReturns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty">Koi batch near expiry ya expired nahi hai.</td>
                  </tr>
                ) : (
                  expiryReturns.map((b) => (
                    <tr key={b.batch_id}>
                      <td>
                        <strong>{b.item_name}</strong>
                        <span className="sub">{b.company}</span>
                      </td>
                      <td className="mono">{b.batch_number}</td>
                      <td className="nowrap mono">
                        {formatExpiry(b.expiry_date)}{' '}
                        <span className="pill near">Near Expiry</span>
                      </td>
                      <td className="num mono">{b.quantity_units} base units</td>
                      <td className="num mono">{formatCurrency(b.estimated_claim_paisa)}</td>
                      <td className="num">
                        <button
                          className="btn small"
                          type="button"
                          onClick={() => handleReturnBatch(b)}
                        >
                          Return to Vendor
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pay Supplier Modal */}
      {paySupplier && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 420 }}>
            <header className="modal-header">
              <h3>Distributor Payment Entry</h3>
              <button className="btn small" onClick={() => setPaySupplier(null)}>✕</button>
            </header>
            <form onSubmit={handleMakePayment}>
              <div className="modal-body">
                <div>
                  <strong>{paySupplier.name}</strong>
                  <div className="meta">Total Owed: {formatCurrency(paySupplier.balance_paisa)}</div>
                </div>

                <div className="field">
                  <label>Payment Amount (Rs) *</label>
                  <input
                    className="input mono"
                    type="number"
                    min="1"
                    required
                    value={payAmountRs}
                    onChange={(e) => setPayAmountRs(Number(e.target.value))}
                  />
                </div>

                <div className="field">
                  <label>Notes / Receipt Reference</label>
                  <input
                    className="input"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                  />
                </div>
              </div>

              <footer className="modal-footer">
                <button className="btn" type="button" onClick={() => setPaySupplier(null)}>Cancel</button>
                <button className="btn primary" type="submit">Confirm Payment</button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* New GRN Entry Modal */}
      <NewGRNModal
        isOpen={isGRNOpen}
        onClose={() => setIsGRNOpen(false)}
        onSuccess={() => loadData()}
        suppliers={suppliers}
        items={items}
      />
    </section>
  );
};

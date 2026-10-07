'use client';

import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../utils/formatters';

export const KhataPage: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCust, setSelectedCust] = useState<any | null>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  // Payment modal
  const [payCust, setPayCust] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>(''); // blank by default
  const [paymentNotes, setPaymentNotes] = useState('');

  // New Customer modal
  const [isNewCustOpen, setIsNewCustOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');

  const loadCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      setCustomers(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadLedger = async (cust: any) => {
    setSelectedCust(cust);
    try {
      const billsRes = await fetch(`/api/sales?limit=100`);
      const allBills = await billsRes.json();
      const custBills = allBills.filter((b: any) => b.customer_id === cust.id);
      setLedger(custBills);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleReceivePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payCust || !paymentAmount || Number(paymentAmount) <= 0) return;

    try {
      await fetch(`/api/customers/${payCust.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountPaisa: Math.round(Number(paymentAmount) * 100),
          notes: paymentNotes || 'Cash received for Udhaar'
        })
      });
      setPayCust(null);
      setPaymentAmount('');
      setPaymentNotes('');
      loadCustomers();
      if (selectedCust && selectedCust.id === payCust.id) {
        loadLedger({ ...selectedCust, current_baqaya_paisa: selectedCust.current_baqaya_paisa - Math.round(Number(paymentAmount) * 100) });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          phone: newPhone.trim(),
          address: newAddress.trim()
        })
      });
      setIsNewCustOpen(false);
      setNewName('');
      setNewPhone('');
      setNewAddress('');
      loadCustomers();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone && c.phone.includes(search))
  );

  const totalOutstandingPaisa = customers.reduce((acc, c) => acc + (c.current_baqaya_paisa || 0), 0);

  return (
    <section>
      <div className="bar">
        <h2>Udhaar Khata (Customer Ledger)</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className="meta">
            Total Udhaar: <strong style={{ color: 'var(--bad)', fontSize: 15 }}>{formatCurrency(totalOutstandingPaisa)}</strong>
          </span>
          <button className="btn primary small" type="button" onClick={() => setIsNewCustOpen(true)}>
            + Naya Khata
          </button>
        </div>
      </div>

      <div className="cols pos" style={{ marginTop: 14 }}>
        {/* Left: Customer List */}
        <div className="panel">
          <header>
            <h3>Customers</h3>
            <span className="meta">{filteredCustomers.length} registered</span>
          </header>
          <div className="filters">
            <div className="field">
              <label>Search Customer</label>
              <input
                className="input"
                placeholder="Naam ya phone number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className="num">Baqaya</th>
                  <th className="num"></th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((c) => (
                  <tr
                    key={c.id}
                    style={{
                      cursor: 'pointer',
                      background: selectedCust?.id === c.id ? 'var(--accent-soft)' : undefined
                    }}
                    onClick={() => loadLedger(c)}
                  >
                    <td>
                      <strong>{c.name}</strong>
                      <span className="sub mono">{c.phone || 'No phone'}</span>
                    </td>
                    <td className="num mono">
                      <strong style={{ color: c.current_baqaya_paisa > 0 ? 'var(--warn)' : 'var(--good)' }}>
                        {formatCurrency(c.current_baqaya_paisa)}
                      </strong>
                    </td>
                    <td className="num">
                      <button
                        className="btn small"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPayCust(c);
                          setPaymentAmount(''); // blank default
                        }}
                      >
                        Receive
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Selected Customer Details & Bills History */}
        <div className="panel">
          <header>
            <h3>
              {selectedCust ? `${selectedCust.name} ka Khata` : 'Customer History'}
            </h3>
            {selectedCust && (
              <span className="meta mono" style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600 }}>
                Baqaya: {formatCurrency(selectedCust.current_baqaya_paisa)}
              </span>
            )}
          </header>

          {!selectedCust ? (
            <div className="empty">Left list se customer select karein unka hisaab dekhne ke liye.</div>
          ) : (
            <div style={{ padding: 14 }}>
              <div style={{ marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--line)' }}>
                <div><strong>Phone:</strong> <span className="mono">{selectedCust.phone || 'N/A'}</span></div>
                <div><strong>Address:</strong> {selectedCust.address || 'N/A'}</div>
              </div>

              <h4>Recent Bills / Udhaar Entries</h4>
              <div className="tablewrap" style={{ marginTop: 8 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Bill #</th>
                      <th>Date</th>
                      <th>Payment</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="empty">Koi purana bill record nahi mila.</td>
                      </tr>
                    ) : (
                      ledger.map((b) => (
                        <tr key={b.id}>
                          <td className="mono"><strong>{b.bill_number}</strong></td>
                          <td className="nowrap">{b.created_at?.split(' ')[0]}</td>
                          <td>{b.payment_type}</td>
                          <td className="num mono">{formatCurrency(b.total_paisa)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Receive Payment Modal */}
      {payCust && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 400 }}>
            <header className="modal-header">
              <h3>Wasooli Entry (Receive Payment)</h3>
              <button className="btn small" onClick={() => setPayCust(null)}>✕</button>
            </header>
            <form onSubmit={handleReceivePayment}>
              <div className="modal-body">
                <div>
                  <strong>{payCust.name}</strong>
                  <div className="meta">Current Baqaya: {formatCurrency(payCust.current_baqaya_paisa)}</div>
                </div>

                <div className="field">
                  <label>Amount Received (Rs) *</label>
                  <input
                    className="input mono"
                    type="number"
                    min="1"
                    placeholder="Enter amount"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>Description / Notes</label>
                  <input
                    className="input"
                    placeholder="e.g. Cash wasooli, JazzCash"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                  />
                </div>
              </div>
              <footer className="modal-footer">
                <button className="btn" type="button" onClick={() => setPayCust(null)}>Cancel</button>
                <button className="btn primary" type="submit">Save Wasooli</button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* New Customer Modal */}
      {isNewCustOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 420 }}>
            <header className="modal-header">
              <h3>Naya Khata Shamil Karein (Add Customer)</h3>
              <button className="btn small" onClick={() => setIsNewCustOpen(false)}>✕</button>
            </header>
            <form onSubmit={handleCreateCustomer}>
              <div className="modal-body">
                <div className="field">
                  <label>Customer Name *</label>
                  <input
                    className="input"
                    required
                    placeholder="e.g. Haji Mohammad Rafiq"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>Phone Number (Mobile)</label>
                  <input
                    className="input mono"
                    placeholder="0300-1234567"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>Address / Mohalla</label>
                  <input
                    className="input"
                    placeholder="e.g. Street 4, Near Jamia Masjid"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                  />
                </div>
              </div>
              <footer className="modal-footer">
                <button className="btn" type="button" onClick={() => setIsNewCustOpen(false)}>Cancel</button>
                <button className="btn primary" type="submit">Create Khata</button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

'use client';

import { useState, useEffect, useRef } from 'react';
import { formatCurrency, formatPacksAndLoose } from '../utils/formatters';
import { ThermalReceiptModal } from '../components/ThermalReceiptModal';
import { SaleReturnModal } from '../components/SaleReturnModal';
import { RecentBillsModal } from '../components/RecentBillsModal';

interface CartLine {
  item: any;
  isLoose: boolean;
  quantity: number;
}

export const POSPage = () => {
  const [search, setSearch] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountRs, setDiscountRs] = useState<string>(''); // blank by default
  const [paymentType, setPaymentType] = useState<'Cash' | 'Udhaar' | 'Easypaisa' | 'JazzCash'>('Cash');
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [nextBillNo, setNextBillNo] = useState<string>('INV-...');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Modals
  const [receiptData, setReceiptData] = useState<any | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState<boolean>(false);
  const [isReturnOpen, setIsReturnOpen] = useState<boolean>(false);
  const [isRecentBillsOpen, setIsRecentBillsOpen] = useState<boolean>(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadInitialData = async () => {
    try {
      const billRes = await fetch('/api/sales/next-bill');
      const billData = await billRes.json();
      setNextBillNo(billData.nextBillNo);

      const custRes = await fetch('/api/customers');
      const custData = await custRes.json();
      setCustomers(custData);
      if (custData.length > 0) {
        setSelectedCustomerId(custData[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadInitialData();
    searchInputRef.current?.focus();
  }, []);

  // Keyboard shortcut listener for keyboard-friendly POS
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F2 or '/' to focus search
      if (e.key === 'F2' || (e.key === '/' && document.activeElement?.tagName !== 'INPUT')) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // F9 or Ctrl+Enter to checkout
      if ((e.key === 'F9' || (e.ctrlKey && e.key === 'Enter')) && cart.length > 0) {
        e.preventDefault();
        handleCheckout();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, discountRs, paymentType, selectedCustomerId]);

  // Fast live search by name, generic, barcode
  useEffect(() => {
    const fetchResults = async () => {
      if (!search.trim()) {
        setSearchResults([]);
        return;
      }
      try {
        const res = await fetch(`/api/items?search=${encodeURIComponent(search.trim())}`);
        const data = await res.json();
        setSearchResults(data);
      } catch (err) {
        console.error(err);
      }
    };

    const timer = setTimeout(fetchResults, 150);
    return () => clearTimeout(timer);
  }, [search]);

  const addToCart = (item: any) => {
    if (item.total_units_in_stock <= 0) {
      setErrorToast(`'${item.name}' out of stock hai!`);
      setTimeout(() => setErrorToast(null), 3000);
      return;
    }

    setCart((prev: CartLine[]) => {
      const existingIndex = prev.findIndex((c: CartLine) => c.item.id === item.id && !c.isLoose);
      if (existingIndex > -1) {
        const copy = [...prev];
        copy[existingIndex].quantity += 1;
        return copy;
      }
      return [...prev, { item, isLoose: false, quantity: 1 }];
    });

    setSearch('');
    setSearchResults([]);
    searchInputRef.current?.focus();
  };

  const calculateLinePricePaisa = (line: CartLine) => {
    const packRatePaisa = line.item.sale_rate_paisa || 0;
    const packSize = line.item.pack_size || 1;

    if (line.isLoose) {
      if (line.item.loose_price_paisa) return line.item.loose_price_paisa;
      return Math.round(packRatePaisa / packSize);
    }
    return packRatePaisa;
  };

  // Subtotal in paisa
  const subtotalPaisa = cart.reduce((acc: number, line: CartLine) => {
    return acc + calculateLinePricePaisa(line) * line.quantity;
  }, 0);

  const discountPaisa = Math.round(Number(discountRs || 0) * 100);
  const netTotalPaisa = Math.max(0, subtotalPaisa - discountPaisa);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (paymentType === 'Udhaar' && !selectedCustomerId) {
      setErrorToast('Udhaar sale ke liye customer khata select karein.');
      setTimeout(() => setErrorToast(null), 3500);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        items: cart.map((c: CartLine) => ({
          itemId: c.item.id,
          isLoose: c.isLoose,
          quantity: c.quantity
        })),
        discountPaisa,
        paymentType,
        customerId: paymentType === 'Udhaar' ? Number(selectedCustomerId) : null
      };

      const res = await fetch('/api/sales/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Checkout failed');
      }

      // Fetch receipt data & show 80mm modal
      const receiptRes = await fetch(`/api/sales/${data.saleId}`);
      const receipt = await receiptRes.json();
      setReceiptData(receipt);
      setIsReceiptOpen(true);

      const savedBillNo = data.billNumber || receipt?.sale?.bill_number || '';
      setSuccessToast(`✓ Bill ${savedBillNo} kamyabi se save ho gaya! (Database me mehfooz)`);
      setTimeout(() => setSuccessToast(null), 5000);

      // Reset cart and reload next bill
      setCart([]);
      setDiscountRs('');
      loadInitialData();
    } catch (err: any) {
      setErrorToast(err.message);
      setTimeout(() => setErrorToast(null), 4500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <div className="bar">
        <h2>Sales Counter (POS)</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="meta mono" style={{ fontSize: 14 }}>
            {nextBillNo}
          </span>
          <button
            className="btn small"
            type="button"
            onClick={() => setIsRecentBillsOpen(true)}
          >
            Aakhri Bills (Recent)
          </button>
          <button
            className="btn small"
            type="button"
            onClick={() => setIsReturnOpen(true)}
          >
            Bill Wapsi (Return)
          </button>
        </div>
      </div>

      <div className="cols pos" style={{ marginTop: 14 }}>
        {/* Left: Fast Search & Item Selection */}
        <div className="panel">
          <header>
            <h3>Item Talash Karein (Find item)</h3>
            <span className="meta">Shortcut: Press <strong>F2</strong></span>
          </header>

          <div className="filters">
            <div className="field">
              <label htmlFor="saleSearch">Search by Name, Formula ya Barcode</label>
              <input
                ref={searchInputRef}
                className="input"
                id="saleSearch"
                type="search"
                placeholder="e.g. panadol, paracetamol, ya barcode scan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <ul className="results">
            {searchResults.length === 0 ? (
              <li className="empty">
                {search.trim() ? 'Koi item nahi mila.' : 'Type medicine name or scan barcode to add.'}
              </li>
            ) : (
              searchResults.map((item: any) => {
                const itemPricePaisa = item.sale_rate_paisa || 0;
                return (
                  <li key={item.id}>
                    <button type="button" onClick={() => addToCart(item)}>
                      <span>
                        <span className="nm">{item.name}</span>
                        {item.is_controlled === 1 && (
                          <span style={{ color: 'var(--bad)', fontSize: 11, fontWeight: 700, marginLeft: 6 }}>
                            [Controlled]
                          </span>
                        )}
                        <span className="sm">
                          {item.company} · {item.generic_name || ''} · Stock:{' '}
                          {formatPacksAndLoose(item.total_units_in_stock, item.pack_size, item.form)}
                        </span>
                      </span>
                      <span className="pr" style={{ textAlign: 'right' }}>
                        <strong>{formatCurrency(itemPricePaisa)}</strong>
                        {item.pack_size > 1 && (
                          <span className="sub mono" style={{ fontSize: 11 }}>
                            {formatCurrency(item.loose_price_paisa || Math.round(itemPricePaisa / item.pack_size))} /tab
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        {/* Right: Bill Basket & Checkout */}
        <div className="panel">
          <header>
            <h3>Current Bill Basket</h3>
            <button
              className="btn small"
              type="button"
              onClick={() => setCart([])}
              disabled={cart.length === 0}
            >
              Clear
            </button>
          </header>

          <div id="cartBox">
            {cart.length === 0 ? (
              <div className="empty">Bill khali hai. Left side se dawai add karein.</div>
            ) : (
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Unit</th>
                      <th className="num">Rate</th>
                      <th>Qty</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((line: CartLine, idx: number) => {
                      const packSize = line.item.pack_size || 1;
                      const hasLooseOption = packSize > 1;
                      const unitRatePaisa = calculateLinePricePaisa(line);
                      const lineTotalPaisa = unitRatePaisa * line.quantity;

                      return (
                        <tr key={idx}>
                          <td>
                            <strong>{line.item.name}</strong>
                          </td>
                          <td>
                            {hasLooseOption ? (
                              <select
                                className="unitsel"
                                value={line.isLoose ? 'loose' : 'pack'}
                                onChange={(e) => {
                                  const isLoose = e.target.value === 'loose';
                                  setCart((prev: CartLine[]) => {
                                    const c = [...prev];
                                    c[idx].isLoose = isLoose;
                                    return c;
                                  });
                                }}
                              >
                                <option value="pack">Pack / Strip</option>
                                <option value="loose">Loose (Tablet)</option>
                              </select>
                            ) : (
                              <span>{line.item.form}</span>
                            )}
                          </td>
                          <td className="num mono">
                            {formatCurrency(unitRatePaisa)}
                          </td>
                          <td>
                            <span className="qty">
                              <button
                                type="button"
                                onClick={() => {
                                  setCart((prev: CartLine[]) => {
                                    const c = [...prev];
                                    c[idx].quantity -= 1;
                                    if (c[idx].quantity <= 0) c.splice(idx, 1);
                                    return c;
                                  });
                                }}
                              >
                                -
                              </button>
                              <span>{line.quantity}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setCart((prev: CartLine[]) => {
                                    const c = [...prev];
                                    c[idx].quantity += 1;
                                    return c;
                                  });
                                }}
                              >
                                +
                              </button>
                            </span>
                          </td>
                          <td className="num mono" style={{ fontWeight: 600 }}>
                            {formatCurrency(lineTotalPaisa)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="totals">
            <div className="row">
              <span>Subtotal</span>
              <span className="mono">{formatCurrency(subtotalPaisa)}</span>
            </div>

            <div className="row">
              <label htmlFor="discount">Discount (Chhoot)</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  className="input mono"
                  id="discount"
                  type="number"
                  min="0"
                  placeholder="0"
                  style={{ width: 110, textAlign: 'right' }}
                  value={discountRs}
                  onChange={(e) => setDiscountRs(e.target.value)}
                />
                <span className="meta" style={{ fontSize: 12 }}>Rs</span>
              </div>
            </div>

            {/* Quick 5%, 10% Discount Buttons */}
            {subtotalPaisa > 0 && (
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: -4 }}>
                <button
                  type="button"
                  className="btn small"
                  style={{ fontSize: 11, padding: '2px 8px' }}
                  onClick={() => setDiscountRs(String(Math.round((subtotalPaisa * 0.05) / 100)))}
                >
                  5% Off
                </button>
                <button
                  type="button"
                  className="btn small"
                  style={{ fontSize: 11, padding: '2px 8px' }}
                  onClick={() => setDiscountRs(String(Math.round((subtotalPaisa * 0.10) / 100)))}
                >
                  10% Off
                </button>
                <button
                  type="button"
                  className="btn small"
                  style={{ fontSize: 11, padding: '2px 8px' }}
                  onClick={() => setDiscountRs('')}
                >
                  Clear Dis
                </button>
              </div>
            )}

            <div className="row grand">
              <span>Total Baqaya/Net</span>
              <span className="mono" style={{ color: 'var(--accent)' }}>{formatCurrency(netTotalPaisa)}</span>
            </div>

            <div className="paygrid">
              {(['Cash', 'Udhaar', 'Easypaisa', 'JazzCash'] as const).map((type) => (
                <label key={type}>
                  <input
                    type="radio"
                    name="pay"
                    value={type}
                    checked={paymentType === type}
                    onChange={() => setPaymentType(type)}
                  />{' '}
                  {type}
                </label>
              ))}
            </div>

            {paymentType === 'Udhaar' && (
              <div className="field">
                <label htmlFor="custSelect">Customer (Udhaar Khata Link) *</label>
                <select
                  className="input"
                  id="custSelect"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
                >
                  {customers.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone || 'No phone'}) - Baqaya: {formatCurrency(c.current_baqaya_paisa)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              className="btn primary"
              type="button"
              disabled={cart.length === 0 || loading}
              onClick={handleCheckout}
            >
              {loading ? 'Processing Sale...' : 'Complete Sale & Print Receipt (Ctrl+Enter / F9)'}
            </button>
          </div>
        </div>
      </div>

      {errorToast && (
        <div className="toast" style={{ background: 'var(--bad)' }} role="status">
          {errorToast}
        </div>
      )}

      {successToast && (
        <div className="toast" style={{ background: 'var(--good)', color: '#fff', fontWeight: 600 }} role="status">
          {successToast}
        </div>
      )}

      {/* 80mm Thermal Receipt Modal */}
      <ThermalReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        receiptData={receiptData}
      />

      {/* Sale Return Modal */}
      <SaleReturnModal
        isOpen={isReturnOpen}
        onClose={() => setIsReturnOpen(false)}
        onSuccess={() => {
          loadInitialData();
        }}
      />

      {/* Recent Bills Modal */}
      <RecentBillsModal
        isOpen={isRecentBillsOpen}
        onClose={() => setIsRecentBillsOpen(false)}
        onViewReceipt={async (saleId) => {
          try {
            const res = await fetch(`/api/sales/${saleId}`);
            if (res.ok) {
              const data = await res.json();
              setReceiptData(data);
              setIsRecentBillsOpen(false);
              setIsReceiptOpen(true);
            }
          } catch (err) {
            console.error(err);
          }
        }}
      />
    </section>
  );
};

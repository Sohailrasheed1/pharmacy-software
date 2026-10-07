'use client';

import React from 'react';
import { formatCurrency } from '../utils/formatters';

interface ThermalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: any;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  isOpen,
  onClose,
  receiptData
}) => {
  if (!isOpen || !receiptData) return null;

  const { sale, items = [], customer, settings = {} } = receiptData;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(sale.created_at || Date.now()).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 380 }}>
        <header className="modal-header">
          <h3>80mm Thermal Receipt</h3>
          <button className="btn small" onClick={onClose} type="button">✕</button>
        </header>

        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          <div id="thermal-receipt" className="receipt-area">
            <style>{`
              @media print {
                body * { visibility: hidden; }
                #thermal-receipt, #thermal-receipt * { visibility: visible; }
                #thermal-receipt {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 80mm !important;
                  margin: 0 !important;
                  padding: 4mm !important;
                  font-family: 'Courier New', Courier, monospace !important;
                  font-size: 12px !important;
                  line-height: 1.25 !important;
                  color: #000 !important;
                  background: #fff !important;
                }
                .no-print { display: none !important; }
              }
              .receipt-area {
                font-family: 'JetBrains Mono', Courier, monospace;
                font-size: 12px;
                line-height: 1.35;
                background: #fff;
                color: #000;
                padding: 12px;
                border: 1px dashed #ccc;
                border-radius: 4px;
              }
              .receipt-center { text-align: center; }
              .receipt-divider { border-top: 1px dashed #000; margin: 8px 0; }
              .receipt-row { display: flex; justify-content: space-between; }
            `}</style>

            <div className="receipt-center">
              <strong style={{ fontSize: 16 }}>{settings.shop_name || 'Al-Shifa Pharmacy'}</strong>
              <div>{settings.address || 'Main Bazar, Lahore, Pakistan'}</div>
              <div>Tel: {settings.phone || '0300-1234567'}</div>
            </div>

            <div className="receipt-divider" />

            <div className="receipt-row">
              <span>Bill #: {sale.bill_number}</span>
              <span>{formattedDate}</span>
            </div>
            {customer && (
              <div className="receipt-row">
                <span>Customer: {customer.name}</span>
                <span>Khata Baqaya: {formatCurrency(customer.current_baqaya_paisa)}</span>
              </div>
            )}
            <div className="receipt-row">
              <span>Payment: {sale.payment_type}</span>
              <span>Status: {sale.status}</span>
            </div>

            <div className="receipt-divider" />

            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #000' }}>
                  <th style={{ textAlign: 'left', padding: '2px 0' }}>Item</th>
                  <th style={{ textAlign: 'center', padding: '2px 0' }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '2px 0' }}>Rate</th>
                  <th style={{ textAlign: 'right', padding: '2px 0' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it: any, idx: number) => {
                  const qtyLabel = it.is_loose ? `${it.quantity_units} tab` : `${it.quantity_units / (it.pack_size || 1)} pk`;
                  return (
                    <tr key={idx}>
                      <td style={{ padding: '3px 0' }}>
                        <div>{it.item_name}</div>
                        <span style={{ fontSize: 9, color: '#444' }}>
                          B: {it.batch_number} (Exp: {it.expiry_date})
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', padding: '3px 0' }}>{qtyLabel}</td>
                      <td style={{ textAlign: 'right', padding: '3px 0' }}>{formatCurrency(it.unit_price_paisa)}</td>
                      <td style={{ textAlign: 'right', padding: '3px 0' }}>{formatCurrency(it.total_paisa)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="receipt-divider" />

            <div className="receipt-row">
              <span>Subtotal:</span>
              <strong>{formatCurrency(sale.subtotal_paisa)}</strong>
            </div>
            {sale.discount_paisa > 0 && (
              <div className="receipt-row">
                <span>Discount:</span>
                <span>-{formatCurrency(sale.discount_paisa)}</span>
              </div>
            )}
            <div className="receipt-row" style={{ fontSize: 14 }}>
              <strong>Net Total:</strong>
              <strong>{formatCurrency(sale.total_paisa)}</strong>
            </div>

            <div className="receipt-row">
              <span>Paid Amount:</span>
              <span>{formatCurrency(sale.paid_paisa)}</span>
            </div>
            {sale.change_paisa > 0 && (
              <div className="receipt-row">
                <span>Change / Wapis:</span>
                <span>{formatCurrency(sale.change_paisa)}</span>
              </div>
            )}

            <div className="receipt-divider" />

            <div className="receipt-center" style={{ fontSize: 11 }}>
              {settings.receipt_footer || 'Get well soon! Check medicines before leaving.'}
            </div>
          </div>
        </div>

        <footer className="modal-footer">
          <button className="btn" onClick={onClose} type="button">Close (Esc)</button>
          <button className="btn primary" onClick={handlePrint} type="button">
            Print 80mm Receipt (Enter)
          </button>
        </footer>
      </div>
    </div>
  );
};

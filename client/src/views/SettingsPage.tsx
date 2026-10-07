'use client';

import React, { useState, useEffect } from 'react';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, string>>({
    shop_name: 'Al-Shifa Pharmacy',
    address: 'Main Bazar, Lahore, Pakistan',
    phone: '0300-1234567',
    receipt_footer: 'Get well soon! Check medicines before leaving.'
  });
  const [backups, setBackups] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'shop' | 'backup' | 'audit' | 'users'>('shop');
  const [backupMsg, setBackupMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const loadAll = async () => {
    try {
      const sRes = await fetch('/api/settings');
      const sData = await sRes.json();
      setSettings(sData);

      const bRes = await fetch('/api/settings/backups');
      const bData = await bRes.json();
      setBackups(bData);

      const aRes = await fetch('/api/settings/audit-logs');
      const aData = await aRes.json();
      setAuditLogs(aData);

      const uRes = await fetch('/api/settings/users');
      const uData = await uRes.json();
      setUsers(uData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      alert('Settings saved successfully!');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBackupNow = async () => {
    setLoading(true);
    setBackupMsg('');
    try {
      const res = await fetch('/api/settings/backup', { method: 'POST' });
      const data = await res.json();
      setBackupMsg(`Backup saved: ${data.fileName} (${(data.sizeBytes / 1024).toFixed(1)} KB)`);
      loadAll();
    } catch (err: any) {
      setBackupMsg(`Backup error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <div className="bar">
        <h2>Safety & Settings</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn small"
            type="button"
            style={{ fontWeight: activeTab === 'shop' ? 700 : 400 }}
            onClick={() => setActiveTab('shop')}
          >
            Shop Profile
          </button>
          <button
            className="btn small"
            type="button"
            style={{ fontWeight: activeTab === 'backup' ? 700 : 400 }}
            onClick={() => setActiveTab('backup')}
          >
            Database Backups ({backups.length})
          </button>
          <button
            className="btn small"
            type="button"
            style={{ fontWeight: activeTab === 'audit' ? 700 : 400 }}
            onClick={() => setActiveTab('audit')}
          >
            Audit Trail
          </button>
          <button
            className="btn small"
            type="button"
            style={{ fontWeight: activeTab === 'users' ? 700 : 400 }}
            onClick={() => setActiveTab('users')}
          >
            Staff Roles
          </button>
        </div>
      </div>

      {activeTab === 'shop' && (
        <div className="panel" style={{ marginTop: 14 }}>
          <header>
            <h3>Pharmacy Details (Print & Receipts)</h3>
          </header>
          <form onSubmit={handleSaveSettings} style={{ padding: 14, maxWidth: 540 }}>
            <div className="field">
              <label>Pharmacy Name *</label>
              <input
                className="input"
                required
                value={settings.shop_name || ''}
                onChange={(e) => setSettings({ ...settings, shop_name: e.target.value })}
              />
            </div>

            <div className="field" style={{ marginTop: 12 }}>
              <label>Address *</label>
              <input
                className="input"
                required
                value={settings.address || ''}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              />
            </div>

            <div className="field" style={{ marginTop: 12 }}>
              <label>Phone Number *</label>
              <input
                className="input mono"
                required
                value={settings.phone || ''}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              />
            </div>

            <div className="field" style={{ marginTop: 12 }}>
              <label>Thermal Receipt Footer Note</label>
              <input
                className="input"
                value={settings.receipt_footer || ''}
                onChange={(e) => setSettings({ ...settings, receipt_footer: e.target.value })}
              />
            </div>

            <button className="btn primary" type="submit" disabled={loading} style={{ marginTop: 16 }}>
              Save Settings
            </button>
          </form>
        </div>
      )}

      {activeTab === 'backup' && (
        <div className="panel" style={{ marginTop: 14 }}>
          <header>
            <h3>SQLite Database Backups (Offline Protection)</h3>
            <button className="btn primary small" type="button" onClick={handleBackupNow} disabled={loading}>
              {loading ? 'Creating snapshot...' : 'Backup Now'}
            </button>
          </header>

          <div style={{ padding: 14 }}>
            {backupMsg && (
              <div style={{ padding: '8px 12px', background: 'var(--accent-soft)', borderRadius: 6, marginBottom: 12 }}>
                {backupMsg}
              </div>
            )}
            <p className="meta">
              Automatic daily backups background mein run hoti hain. Windows PC off hone ya bijli jane par database safe rehta hai.
            </p>

            <h4 style={{ marginTop: 16 }}>Local Backup Files (`server/backups/`)</h4>
            <div className="tablewrap" style={{ marginTop: 8 }}>
              <table>
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Created At</th>
                    <th className="num">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="empty">Koi backup file mojood nahi. "Backup Now" par click karein.</td>
                    </tr>
                  ) : (
                    backups.map((b, i) => (
                      <tr key={i}>
                        <td className="mono">{b.fileName}</td>
                        <td className="nowrap">{new Date(b.createdAt).toLocaleString()}</td>
                        <td className="num mono">{(b.sizeBytes / 1024).toFixed(1)} KB</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="panel" style={{ marginTop: 14 }}>
          <header>
            <h3>Audit Log (Stock Adjustments & Return Tracking)</h3>
          </header>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Action</th>
                  <th>Module</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty">Abhi koi critical audit logs record nahi huay.</td>
                  </tr>
                ) : (
                  auditLogs.map((l) => (
                    <tr key={l.id}>
                      <td className="nowrap">{l.created_at}</td>
                      <td><span className="pill near">{l.action}</span></td>
                      <td className="mono">{l.entity_name}</td>
                      <td>{l.details}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="panel" style={{ marginTop: 14 }}>
          <header>
            <h3>Staff & Access Roles (Owner vs Cashier)</h3>
          </header>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Staff Name</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Permissions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.name}</strong></td>
                    <td className="mono">{u.username}</td>
                    <td><span className={`pill ${u.role === 'Owner' ? 'ok' : 'low'}`}>{u.role}</span></td>
                    <td className="meta">
                      {u.role === 'Owner'
                        ? 'Full Access (Sales, Purchases, Profit Margins, Backups)'
                        : 'POS Counter Only (Cannot view purchase prices or delete bills)'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};

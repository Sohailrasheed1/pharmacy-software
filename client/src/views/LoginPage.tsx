'use client';

import React, { useState } from 'react';

interface LoginPageProps {
  onLoginSuccess: (user: { id: number; username: string; role: string; name: string }) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Save session in localStorage
      localStorage.setItem('pharmacy_user', JSON.stringify(data.user));
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (role: 'Owner' | 'Cashier') => {
    if (role === 'Owner') {
      setUsername('owner');
      setPassword('owner123');
    } else {
      setUsername('cashier');
      setPassword('cashier123');
    }
  };

  return (
    <div style={{
      minHeight: '85vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16
    }}>
      <div className="panel" style={{ width: '100%', maxWidth: 420, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
        <header style={{ textAlign: 'center', padding: '24px 20px 16px', borderBottom: '1px solid var(--line)' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            fontSize: 24,
            fontWeight: 700,
            marginBottom: 8
          }}>
            ⚕
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Al-Shifa Pharmacy POS</h2>
          <p className="meta" style={{ marginTop: 4 }}>Pharmacy Counter Management System</p>
        </header>

        <form onSubmit={handleLogin} style={{ padding: '20px 24px' }}>
          {error && (
            <div style={{
              background: 'var(--bad-soft)',
              color: 'var(--bad)',
              padding: '10px 14px',
              borderRadius: 6,
              fontSize: 13,
              marginBottom: 16,
              fontWeight: 500
            }}>
              {error}
            </div>
          )}

          <div className="field">
            <label htmlFor="username">Username (صارف کا نام)</label>
            <input
              id="username"
              className="input mono"
              required
              placeholder="e.g. owner ya cashier"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="password">Password (پاس ورڈ)</label>
            <input
              id="password"
              className="input mono"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn primary"
            style={{ width: '100%', marginTop: 20, padding: '10px 0', fontSize: 15 }}
            disabled={loading}
          >
            {loading ? 'Tasdeeq ho rahi hai...' : 'Login Karein (داخل ہوں)'}
          </button>

          {/* Quick Demo Credentials for Client Presentation */}
          <div style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px dashed var(--line)',
            textAlign: 'center'
          }}>
            <span className="meta" style={{ display: 'block', marginBottom: 8, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Quick Demo Login (Client Demo ke liye)
            </span>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                type="button"
                className="btn small"
                onClick={() => handleQuickDemo('Owner')}
              >
                Owner (Full Access)
              </button>
              <button
                type="button"
                className="btn small"
                onClick={() => handleQuickDemo('Cashier')}
              >
                Cashier (POS Only)
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

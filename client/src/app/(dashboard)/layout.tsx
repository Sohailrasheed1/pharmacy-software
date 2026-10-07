'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser, isLoaded, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [alertCount, setAlertCount] = useState<number>(0);

  useEffect(() => {
    if (isLoaded && !currentUser) {
      router.replace('/login');
    }
  }, [isLoaded, currentUser, router]);

  useEffect(() => {
    if (!currentUser) return;
    fetch('/api/stock/stats')
      .then((r) => r.json())
      .then((data) => {
        setAlertCount((data.nearOrExpiredBatches || 0) + (data.lowStockItems || 0));
      })
      .catch(console.error);
  }, [pathname, currentUser]);

  if (!isLoaded || !currentUser) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p className="meta mono">Checking session...</p>
      </div>
    );
  }

  const todayStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const isOwner = currentUser.role === 'Owner';

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <h1>Al-Shifa Pharmacy</h1>
          <p>Counter 1 · <span>{todayStr}</span></p>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="pill ok" style={{ fontSize: 11 }}>
              {currentUser.name} ({currentUser.role})
            </span>
            <button
              type="button"
              onClick={logout}
              className="btn small"
              style={{ fontSize: 11, padding: '2px 6px' }}
              title="Logout"
            >
              Sign out
            </button>
          </div>
        </div>

        <nav className="nav" aria-label="Modules">
          <Link
            href="/dashboard"
            aria-current={pathname === '/dashboard' ? 'page' : undefined}
          >
            <span>Dashboard</span>
          </Link>
          <Link
            href="/pos"
            aria-current={pathname === '/pos' ? 'page' : undefined}
          >
            <span>New sale (POS)</span>
          </Link>
          <Link
            href="/sales"
            aria-current={pathname === '/sales' ? 'page' : undefined}
          >
            <span>Sales / Bills</span>
          </Link>
          <Link
            href="/stock"
            aria-current={pathname === '/stock' ? 'page' : undefined}
          >
            <span>Stock</span>
            {alertCount > 0 && <span className="count">{alertCount}</span>}
          </Link>
          {isOwner && (
            <Link
              href="/purchases"
              aria-current={pathname === '/purchases' ? 'page' : undefined}
            >
              <span>Suppliers</span>
            </Link>
          )}
          <Link
            href="/khata"
            aria-current={pathname === '/khata' ? 'page' : undefined}
          >
            <span>Udhaar Khata</span>
          </Link>
          {isOwner && (
            <Link
              href="/reports"
              aria-current={pathname === '/reports' ? 'page' : undefined}
            >
              <span>Reports</span>
            </Link>
          )}
          {isOwner && (
            <Link
              href="/settings"
              aria-current={pathname === '/settings' ? 'page' : undefined}
            >
              <span>Settings</span>
            </Link>
          )}
        </nav>
      </aside>

      <main className="main">
        {children}
      </main>
    </div>
  );
}

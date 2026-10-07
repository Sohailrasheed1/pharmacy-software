'use client';

import { useAuth } from '../../../context/AuthContext';
import { SettingsPage } from '../../../views/SettingsPage';

export default function SettingsRoute() {
  const { currentUser } = useAuth();

  if (currentUser && currentUser.role !== 'Owner') {
    return (
      <div className="panel" style={{ padding: 24, textAlign: 'center' }}>
        <h3 style={{ color: 'var(--bad)', marginBottom: 8 }}>Dastras Mamnoo Hai (Access Restricted)</h3>
        <p className="meta">Settings module sirf Owner ke liye makhsoos hai.</p>
      </div>
    );
  }

  return <SettingsPage />;
}

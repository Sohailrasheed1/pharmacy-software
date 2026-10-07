'use client';

import { useAuth } from '../../../context/AuthContext';
import { ReportsPage } from '../../../views/ReportsPage';

export default function ReportsRoute() {
  const { currentUser } = useAuth();

  if (currentUser && currentUser.role !== 'Owner') {
    return (
      <div className="panel" style={{ padding: 24, textAlign: 'center' }}>
        <h3 style={{ color: 'var(--bad)', marginBottom: 8 }}>Dastras Mamnoo Hai (Access Restricted)</h3>
        <p className="meta">Reports module sirf Owner ke liye makhsoos hai.</p>
      </div>
    );
  }

  return <ReportsPage />;
}

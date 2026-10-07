'use client';

import { useAuth } from '../../../context/AuthContext';
import { PurchasesPage } from '../../../views/PurchasesPage';

export default function PurchasesRoute() {
  const { currentUser } = useAuth();

  if (currentUser && currentUser.role !== 'Owner') {
    return (
      <div className="panel" style={{ padding: 24, textAlign: 'center' }}>
        <h3 style={{ color: 'var(--bad)', marginBottom: 8 }}>Dastras Mamnoo Hai (Access Restricted)</h3>
        <p className="meta">Yeh module sirf Owner ke liye makhsoos hai.</p>
      </div>
    );
  }

  return <PurchasesPage />;
}

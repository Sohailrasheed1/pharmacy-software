'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function HomePage() {
  const { currentUser, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    if (currentUser) {
      router.replace('/pos');
    } else {
      router.replace('/login');
    }
  }, [currentUser, isLoaded, router]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <p className="meta mono">Loading Al-Shifa Pharmacy...</p>
    </div>
  );
}

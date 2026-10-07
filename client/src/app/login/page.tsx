'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { LoginPage } from '../../views/LoginPage';

export default function LoginRoute() {
  const { currentUser, isLoaded, login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && currentUser) {
      router.replace('/pos');
    }
  }, [currentUser, isLoaded, router]);

  if (!isLoaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p className="meta mono">Loading...</p>
      </div>
    );
  }

  return (
    <LoginPage
      onLoginSuccess={(user) => {
        login(user);
        router.push('/pos');
      }}
    />
  );
}

'use client';

import React from 'react';
import { AuthProvider } from '@/lib/auth-context';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/lib/auth-context';
import { usePathname } from 'next/navigation';

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();

  const isLoginPage = pathname === '/login' || pathname === '/';
  const showNav = user && !isLoginPage;

  return (
    <>
      {showNav && <Navbar />}
      <main className={showNav ? 'lg:ml-64 pt-16 lg:pt-0 min-h-screen relative z-10' : 'min-h-screen relative z-10'}>
        {children}
      </main>
    </>
  );
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LayoutInner>{children}</LayoutInner>
    </AuthProvider>
  );
}

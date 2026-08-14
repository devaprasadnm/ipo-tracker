'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';

export default function PendingAccessScreen() {
  const { user, userData, signOut, refreshUserData } = useAuth();
  const [checking, setChecking] = useState(false);

  const handleRefresh = async () => {
    setChecking(true);
    await refreshUserData();
    setTimeout(() => setChecking(false), 800);
  };

  const isRejected = userData?.status === 'REJECTED';

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
      {/* Background Glow Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-500/8 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />

      <div className="relative z-10 text-center max-w-md w-full mx-auto">
        {/* Logo */}
        <div className="mb-6 animate-fadeIn">
          <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br ${isRejected ? 'from-rose-500 to-red-700 shadow-rose-500/25' : 'from-amber-500 via-amber-600 to-yellow-700 shadow-amber-500/25'} flex items-center justify-center shadow-2xl mb-4`}>
            <span className="text-2xl font-bold text-white">{isRejected ? '⛔' : '⏳'}</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-1 tracking-tight">
            {isRejected ? 'Access Request Denied' : 'Access Pending Approval'}
          </h1>
          <p className="text-sm text-slate-400 font-medium">
            IPO Syndicate Investment Portal
          </p>
        </div>

        {/* Status Card */}
        <div className="glass-card-static p-8 animate-fadeIn text-left space-y-4">
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Account Name</span>
              <span className="text-white font-semibold">{userData?.displayName || user?.displayName || 'Member'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Account Email</span>
              <span className="text-emerald-400 font-mono">{userData?.email || user?.email}</span>
            </div>
            <div className="flex justify-between text-xs pt-1 border-t border-white/[0.05]">
              <span className="text-slate-400">Current Status</span>
              <span className={`font-bold px-2 py-0.5 rounded-md text-[10px] uppercase border ${isRejected ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'}`}>
                {isRejected ? 'REJECTED' : 'PENDING ADMIN APPROVAL'}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed text-center">
            {isRejected
              ? 'Your request for access has been denied by an Administrator. Please contact the syndicate manager if you believe this is an error.'
              : 'Your account has been registered. An Admin must approve your access before you can view syndication deals and capital allocations.'}
          </p>

          <div className="flex flex-col gap-2.5 pt-2">
            <button
              onClick={handleRefresh}
              disabled={checking}
              className="btn-primary py-3 w-full font-semibold text-sm flex items-center justify-center gap-2"
              id="refresh-access-status-btn"
            >
              {checking ? 'Checking Status...' : '🔄 Check Approval Status'}
            </button>

            <button
              onClick={signOut}
              className="btn-secondary py-2.5 w-full text-xs text-slate-400 hover:text-rose-400"
              id="pending-sign-out-btn"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React from 'react';

export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-12 h-12">
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-500 border-r-emerald-500/30"
            style={{ animation: 'spin 1s linear infinite' }}
          />
          <div
            className="absolute inset-1 rounded-full border-2 border-transparent border-t-blue-500/50"
            style={{ animation: 'spin 1.5s linear infinite reverse' }}
          />
        </div>
        <p className="text-sm text-slate-400 animate-pulse-glow">Loading...</p>
      </div>
    </div>
  );
}

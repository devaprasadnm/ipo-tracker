'use client';

import React from 'react';

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  glowColor?: 'emerald' | 'blue' | 'rose' | 'amber' | 'purple';
  subtext?: string;
  className?: string;
}

export default function StatCard({ label, value, icon, glowColor = 'emerald', subtext, className = '' }: StatCardProps) {
  return (
    <div className={`glass-card glow-${glowColor} p-6 ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <span className="opacity-60">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-white tracking-tight">
        {value}
      </div>
      {subtext && (
        <p className="text-xs text-slate-500 mt-2">{subtext}</p>
      )}
    </div>
  );
}

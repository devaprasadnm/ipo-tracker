'use client';

import React from 'react';
import { IPOInvestment, IPOApplication, InvestmentCategory } from '@/lib/firestore';
import { formatCurrency } from '@/lib/helpers';

interface IPOMindMapProps {
  ipoName: string;
  totalInvested: number;
  investments: IPOInvestment[];
  applications?: IPOApplication[];
}

const categoryConfig: Record<
  InvestmentCategory,
  { label: string; badgeClass: string; borderClass: string; textClass: string; bgGlow: string }
> = {
  HNI: {
    label: 'HNI (High Net-Worth)',
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    borderClass: 'border-purple-500/40',
    textClass: 'text-purple-400',
    bgGlow: 'rgba(168, 85, 247, 0.15)',
  },
  sHNI: {
    label: 'Small HNI (sHNI)',
    badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    borderClass: 'border-indigo-500/40',
    textClass: 'text-indigo-400',
    bgGlow: 'rgba(99, 102, 241, 0.15)',
  },
  bHNI: {
    label: 'Big HNI (bHNI)',
    badgeClass: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30',
    borderClass: 'border-fuchsia-500/40',
    textClass: 'text-fuchsia-400',
    bgGlow: 'rgba(217, 70, 239, 0.15)',
  },
  RETAIL: {
    label: 'Regular / Retail',
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    borderClass: 'border-blue-500/40',
    textClass: 'text-blue-400',
    bgGlow: 'rgba(59, 130, 246, 0.15)',
  },
  SME: {
    label: 'SME Category',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    borderClass: 'border-amber-500/40',
    textClass: 'text-amber-400',
    bgGlow: 'rgba(245, 158, 11, 0.15)',
  },
};

export default function IPOMindMap({ ipoName, totalInvested, investments, applications = [] }: IPOMindMapProps) {
  // Use applications if present, else fallback to investments with categories
  const activeApps = applications.length > 0
    ? applications
    : investments
        .filter((inv) => inv.category)
        .map((inv) => ({
          id: inv.id,
          ipoId: inv.ipoId,
          uid: inv.uid,
          userEmail: inv.userEmail,
          userDisplayName: inv.userDisplayName,
          category: inv.category || 'RETAIL',
          lotsApplied: inv.lotsApplied || 1,
          amount: inv.investedAmount,
          allotmentStatus: inv.allotmentStatus === 'CONTRIBUTOR' ? 'APPLIED' : (inv.allotmentStatus || 'APPLIED'),
        }));

  // Group applications by category
  const grouped = activeApps.reduce((acc, app) => {
    const cat = app.category || 'RETAIL';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(app);
    return acc;
  }, {} as Record<InvestmentCategory, IPOApplication[]>);

  const categoriesPresent = Object.keys(grouped) as InvestmentCategory[];
  const totalAppsValue = activeApps.reduce((sum, a) => sum + a.amount, 0);

  return (
    <div className="p-6 rounded-2xl bg-[#0b0f19] border border-white/[0.08] overflow-x-auto">
      {/* Header Info */}
      <div className="text-center mb-8">
        <h3 className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-1">
          Hybrid Application & Capital Mind Map
        </h3>
        <p className="text-lg font-bold text-white">Visual Breakdown of Category Applications & Capital Contributors</p>
      </div>

      {/* Mind Map Tree Diagram Container */}
      <div className="min-w-[720px] flex flex-col items-center">
        {/* ROOT NODE: IPO Deal */}
        <div className="relative group">
          <div className="px-6 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white font-bold shadow-xl shadow-emerald-500/20 border border-emerald-400/30 text-center min-w-[240px]">
            <div className="text-xs text-emerald-100 uppercase tracking-wider font-semibold">IPO Deal</div>
            <div className="text-lg font-extrabold">{ipoName}</div>
            <div className="text-xs font-semibold text-emerald-200 mt-0.5">
              Capital Pool: {formatCurrency(totalInvested)} • Applications: {formatCurrency(totalAppsValue)}
            </div>
          </div>
          <div className="w-0.5 h-8 bg-gradient-to-b from-emerald-500 to-slate-700 mx-auto" />
        </div>

        {/* BRANCH LEVEL: Category Allotments */}
        {categoriesPresent.length === 0 ? (
          <div className="text-slate-500 text-xs py-6">No applications or allotments logged yet for this IPO.</div>
        ) : (
          <div className="w-full flex justify-center gap-6 relative pt-2">
            {categoriesPresent.map((catKey) => {
              const catItems = grouped[catKey];
              const catTotal = catItems.reduce((sum, i) => sum + i.amount, 0);
              const totalLots = catItems.reduce((sum, i) => sum + (i.lotsApplied || 1), 0);
              const conf = categoryConfig[catKey] || categoryConfig.RETAIL;

              return (
                <div key={catKey} className="flex-1 max-w-[280px] flex flex-col items-center">
                  {/* Category Node */}
                  <div
                    className={`w-full p-4 rounded-xl bg-slate-900/90 border ${conf.borderClass} text-center shadow-lg transition-all hover:scale-[1.02]`}
                    style={{ boxShadow: `0 0 20px ${conf.bgGlow}` }}
                  >
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${conf.badgeClass} mb-1.5`}
                    >
                      {conf.label}
                    </span>
                    <div className="text-sm font-bold text-white">{formatCurrency(catTotal)}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {catItems.length} Person(s) • {totalLots} Lot(s)
                    </div>
                  </div>

                  {/* Connecting Line Down to Persons */}
                  <div className="w-0.5 h-6 bg-slate-700 mx-auto" />

                  {/* LEAF NODES: Persons/Applicants */}
                  <div className="w-full space-y-2.5">
                    {catItems.map((app) => (
                      <div
                        key={app.id}
                        className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.2] transition-all text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-white truncate max-w-[140px]">
                            {app.userDisplayName}
                          </span>
                          <span
                            className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                              app.allotmentStatus === 'ALLOTTED'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : app.allotmentStatus === 'NOT_ALLOTTED'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            }`}
                          >
                            {app.allotmentStatus || 'APPLIED'}
                          </span>
                        </div>

                        <div className="text-[10px] text-slate-400 truncate mt-0.5">{app.userEmail}</div>

                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.05] text-[11px]">
                          <span className="text-slate-400">
                            {app.lotsApplied || 1} Lot(s)
                          </span>
                          <span className="font-bold text-emerald-400">
                            {formatCurrency(app.amount)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

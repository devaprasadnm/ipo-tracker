'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useUserInvestments, useIPOs, useIPOInvestments, InvestmentCategory } from '@/lib/firestore';
import { formatCurrency } from '@/lib/helpers';
import StatCard from '@/components/StatCard';
import Modal from '@/components/Modal';
import LoadingSpinner from '@/components/LoadingSpinner';
import IPOMindMap from '@/components/IPOMindMap';
import ActivityLogModal from '@/components/ActivityLogModal';
import PendingAccessScreen from '@/components/PendingAccessScreen';

const InvestedIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const ProfitIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const DealIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
);

const categoryBadgeClass: Record<InvestmentCategory, string> = {
  HNI: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  sHNI: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  bHNI: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30',
  RETAIL: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  SME: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
};

// ─── Sub-component: Read-Only Co-Investors Modal Content with Mind Map ───────────

function CoInvestorsModalContent({
  ipoId,
  ipoName,
  totalInvestedInIPO,
  status,
}: {
  ipoId: string;
  ipoName: string;
  totalInvestedInIPO: number;
  status: string;
}) {
  const { investments: allIPOInvestments, loading } = useIPOInvestments(ipoId);
  const [viewMode, setViewMode] = useState<'LIST' | 'MINDMAP'>('MINDMAP');

  if (loading) {
    return <div className="py-8 text-center text-slate-400 text-sm">Loading co-investors data...</div>;
  }

  const calculatedTotal = allIPOInvestments.reduce((sum, inv) => sum + inv.investedAmount, 0);
  const totalCapital = totalInvestedInIPO > 0 ? totalInvestedInIPO : calculatedTotal;

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-xs">
        <div>
          <p className="text-slate-400">Total Capital Raised</p>
          <p className="text-lg font-bold text-emerald-400 mt-0.5">{formatCurrency(totalCapital)}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-slate-400">Total Shareholders</p>
            <p className="text-lg font-bold text-white mt-0.5">{allIPOInvestments.length}</p>
          </div>
          {/* Toggle View Mode */}
          <div className="flex rounded-lg bg-white/[0.05] p-1 border border-white/[0.08]">
            <button
              onClick={() => setViewMode('MINDMAP')}
              className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all ${
                viewMode === 'MINDMAP' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              🧠 Mind Map
            </button>
            <button
              onClick={() => setViewMode('LIST')}
              className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all ${
                viewMode === 'LIST' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              📋 List
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'MINDMAP' ? (
        <IPOMindMap ipoName={ipoName} totalInvested={totalCapital} investments={allIPOInvestments} />
      ) : (
        /* Shareholders List Table */
        <div className="max-h-[50vh] overflow-y-auto overflow-x-auto rounded-xl border border-white/[0.06]">
          {allIPOInvestments.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs">No shareholders recorded for this deal.</div>
          ) : (
            <table className="data-table text-xs">
              <thead>
                <tr>
                  <th>Shareholder</th>
                  <th>Category</th>
                  <th>Lots</th>
                  <th>Invested Amount</th>
                  <th>Share %</th>
                  {status === 'SOLD' && <th>Realized Profit</th>}
                </tr>
              </thead>
              <tbody>
                {allIPOInvestments.map((inv) => {
                  const sharePct = totalCapital > 0 ? (inv.investedAmount / totalCapital) * 100 : 0;
                  const badgeStyle = categoryBadgeClass[inv.category || 'RETAIL'] || categoryBadgeClass.RETAIL;

                  return (
                    <tr key={inv.id}>
                      <td>
                        <div className="text-white font-medium">{inv.userDisplayName}</div>
                        <div className="text-slate-400 text-[10px]">{inv.userEmail}</div>
                      </td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${badgeStyle}`}>
                          {inv.category || 'RETAIL'}
                        </span>
                      </td>
                      <td className="text-slate-300 font-semibold text-xs">{inv.lotsApplied || 1} Lot(s)</td>
                      <td className="text-emerald-400 font-semibold">{formatCurrency(inv.investedAmount)}</td>
                      <td>
                        <span className="font-semibold text-slate-300">{sharePct.toFixed(1)}%</span>
                      </td>
                      {status === 'SOLD' && (
                        <td className={`font-semibold ${inv.profitEarned >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {inv.profitEarned >= 0 ? '+' : ''}{formatCurrency(inv.profitEarned)}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main User Dashboard Component ──────────────────────────────────────────────

export default function DashboardPage() {
  const { user, userData, loading: authLoading } = useAuth();
  const router = useRouter();
  const { investments, loading: investmentsLoading } = useUserInvestments(
    user?.uid,
    user?.email || userData?.email,
    userData?.displayName || user?.displayName || undefined
  );
  const { ipos, loading: iposLoading } = useIPOs();

  const [selectedIPOForModal, setSelectedIPOForModal] = useState<{
    ipoId: string;
    ipoName: string;
    totalInvested: number;
    status: string;
  } | null>(null);

  const [showLogModal, setShowLogModal] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  if (authLoading || investmentsLoading || iposLoading) return <LoadingSpinner />;
  if (!user || !userData) return null;

  // Access Approval Protection: Unapproved users see PendingAccessScreen
  if (!userData.isAdmin && userData.status !== 'APPROVED') {
    return <PendingAccessScreen />;
  }

  const ipoMap = new Map(ipos.map((i) => [i.id, i]));

  const userDeals = investments.map((inv) => {
    const ipo = ipoMap.get(inv.ipoId);
    return {
      ...inv,
      ipoName: ipo?.name || 'Unknown IPO',
      status: ipo?.status || 'OPEN',
      totalInvestedInIPO: ipo?.totalInvested || 0,
      netProfitInIPO: ipo?.netProfit || 0,
    };
  });

  const totalInvested = userDeals.reduce((sum, item) => sum + item.investedAmount, 0);
  const totalProfitEarned = userDeals
    .filter((item) => item.status === 'SOLD')
    .reduce((sum, item) => sum + (item.profitEarned || 0), 0);
  const activeDealsCount = userDeals.filter((item) => item.status !== 'SOLD').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span className="badge badge-applied">🟢 Open</span>;
      case 'APPLIED':
        return <span className="badge badge-applied">⏳ Applied</span>;
      case 'ALLOTTED':
        return <span className="badge badge-allotted">🎯 Allotted</span>;
      case 'SOLD':
        return <span className="badge badge-sold">✓ Sold</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8 animate-fadeIn">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">
            Welcome back, {userData.displayName?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-slate-500">
            Your personal IPO syndication investments and returns.
          </p>
        </div>
        <button
          onClick={() => setShowLogModal(true)}
          className="btn-secondary text-xs font-semibold px-3 py-2 flex items-center gap-1.5"
          id="user-view-logs-btn"
        >
          📋 Action Logs
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="animate-fadeIn stagger-1 opacity-0">
          <StatCard label="Total Invested" value={formatCurrency(totalInvested)} icon={<InvestedIcon />} glowColor="blue" subtext="Across all participated IPOs" />
        </div>
        <div className="animate-fadeIn stagger-2 opacity-0">
          <StatCard
            label="Realized Profit/Loss"
            value={`${totalProfitEarned >= 0 ? '+' : ''}${formatCurrency(totalProfitEarned)}`}
            icon={<ProfitIcon />}
            glowColor={totalProfitEarned >= 0 ? 'emerald' : 'rose'}
            subtext="From closed/sold deals"
          />
        </div>
        <div className="animate-fadeIn stagger-3 opacity-0">
          <StatCard label="Active Deals" value={`${activeDealsCount}`} icon={<DealIcon />} glowColor="purple" subtext={`Out of ${userDeals.length} total participations`} />
        </div>
      </div>

      {/* Participated IPOs Table */}
      <div className="glass-card-static overflow-hidden animate-fadeIn stagger-4 opacity-0">
        <div className="p-6 border-b border-white/[0.06]">
          <h2 className="text-lg font-semibold text-white">Your IPO Participations</h2>
          <p className="text-xs text-slate-500 mt-1">Deals you have capital allocated to</p>
        </div>
        <div className="overflow-x-auto">
          {userDeals.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-3xl mb-3">📋</div>
              <p className="text-slate-500 text-sm">You have not been allocated to any IPO deals yet.</p>
              <p className="text-slate-600 text-xs mt-1">An admin will allocate your funds when a new IPO opens.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>IPO Name</th>
                  <th>Category</th>
                  <th>Lots</th>
                  <th>Status</th>
                  <th>Your Contribution</th>
                  <th>Pool Share</th>
                  <th>Realized Profit</th>
                  <th>Hybrid Mind Map</th>
                </tr>
              </thead>
              <tbody>
                {userDeals.map((deal) => {
                  const sharePct = deal.totalInvestedInIPO > 0 ? (deal.investedAmount / deal.totalInvestedInIPO) * 100 : 0;
                  const badgeStyle = categoryBadgeClass[deal.category || 'RETAIL'] || categoryBadgeClass.RETAIL;

                  return (
                    <tr key={deal.id}>
                      <td className="text-white font-medium">{deal.ipoName}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${badgeStyle}`}>
                          {deal.category || 'RETAIL'}
                        </span>
                      </td>
                      <td className="text-slate-300 font-semibold text-xs">{deal.lotsApplied || 1} Lot(s)</td>
                      <td>{getStatusBadge(deal.status)}</td>
                      <td className="text-emerald-400 font-medium">{formatCurrency(deal.investedAmount)}</td>
                      <td>
                        <span className="text-xs font-semibold text-slate-300">{sharePct.toFixed(1)}%</span>
                      </td>
                      <td>
                        {deal.status === 'SOLD' ? (
                          <span className={`font-semibold ${deal.profitEarned >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {deal.profitEarned >= 0 ? '+' : ''}{formatCurrency(deal.profitEarned)}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">Pending Sale</span>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() =>
                            setSelectedIPOForModal({
                              ipoId: deal.ipoId,
                              ipoName: deal.ipoName,
                              totalInvested: deal.totalInvestedInIPO,
                              status: deal.status,
                            })
                          }
                          className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1.5 hover:bg-white/10 transition-colors"
                          id={`view-coinvestors-${deal.ipoId}`}
                        >
                          🧠 Mind Map & Allotment
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal: View Shareholders & Mind Map */}
      <Modal
        isOpen={selectedIPOForModal !== null}
        onClose={() => setSelectedIPOForModal(null)}
        title={`Hybrid Allotments & Mind Map — ${selectedIPOForModal?.ipoName || ''}`}
      >
        {selectedIPOForModal && (
          <CoInvestorsModalContent
            ipoId={selectedIPOForModal.ipoId}
            ipoName={selectedIPOForModal.ipoName}
            totalInvestedInIPO={selectedIPOForModal.totalInvested}
            status={selectedIPOForModal.status}
          />
        )}
      </Modal>

      {/* Activity Log Modal for Users */}
      <ActivityLogModal isOpen={showLogModal} onClose={() => setShowLogModal(false)} />
    </div>
  );
}

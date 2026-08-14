'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useUserInvestments, useIPOs } from '@/lib/firestore';
import { formatCurrency } from '@/lib/helpers';
import StatCard from '@/components/StatCard';
import LoadingSpinner from '@/components/LoadingSpinner';

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

export default function DashboardPage() {
  const { user, userData, loading: authLoading } = useAuth();
  const router = useRouter();
  const { investments, loading: investmentsLoading } = useUserInvestments(
    user?.uid,
    user?.email || userData?.email
  );
  const { ipos, loading: iposLoading } = useIPOs();

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  if (authLoading || investmentsLoading || iposLoading) return <LoadingSpinner />;
  if (!user || !userData) return null;

  // Map IPO details to investments
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
      <div className="mb-8 animate-fadeIn">
        <h1 className="text-2xl font-bold text-white mb-1">
          Welcome back, {userData.displayName?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-slate-500">
          Your personal IPO syndication investments and returns.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="animate-fadeIn stagger-1 opacity-0">
          <StatCard
            label="Total Invested"
            value={formatCurrency(totalInvested)}
            icon={<InvestedIcon />}
            glowColor="blue"
            subtext="Across all participated IPOs"
          />
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
          <StatCard
            label="Active Deals"
            value={`${activeDealsCount}`}
            icon={<DealIcon />}
            glowColor="purple"
            subtext={`Out of ${userDeals.length} total participations`}
          />
        </div>
      </div>

      {/* Participated IPOs Table */}
      <div className="glass-card-static overflow-hidden animate-fadeIn stagger-4 opacity-0">
        <div className="p-6 border-b border-white/[0.06]">
          <h2 className="text-lg font-semibold text-white">Your IPO Participations</h2>
          <p className="text-xs text-slate-500 mt-1">List of deals you have capital allocated to</p>
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
                  <th>Status</th>
                  <th>Your Contribution</th>
                  <th>Pool Participation Share</th>
                  <th>Realized Payout / Profit</th>
                </tr>
              </thead>
              <tbody>
                {userDeals.map((deal) => {
                  const sharePct =
                    deal.totalInvestedInIPO > 0
                      ? (deal.investedAmount / deal.totalInvestedInIPO) * 100
                      : 0;

                  return (
                    <tr key={deal.id}>
                      <td className="text-white font-medium">{deal.ipoName}</td>
                      <td>{getStatusBadge(deal.status)}</td>
                      <td className="text-emerald-400 font-medium">{formatCurrency(deal.investedAmount)}</td>
                      <td>
                        <span className="text-xs font-semibold text-slate-300">
                          {sharePct.toFixed(1)}%
                        </span>
                      </td>
                      <td>
                        {deal.status === 'SOLD' ? (
                          <span
                            className={`font-semibold ${
                              deal.profitEarned >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {deal.profitEarned >= 0 ? '+' : ''}
                            {formatCurrency(deal.profitEarned)}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">Pending Sale</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

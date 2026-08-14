'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  useIPO,
  useIPOInvestments,
  useIPOApplications,
  useAllUsers,
  addInvestment,
  removeInvestment,
  updateInvestmentAmount,
  addIPOApplication,
  removeIPOApplication,
  resolveIPO,
  updateIPOStatus,
  IPO,
  InvestmentCategory,
} from '@/lib/firestore';
import { formatCurrency } from '@/lib/helpers';
import StatCard from '@/components/StatCard';
import Modal from '@/components/Modal';
import LoadingSpinner from '@/components/LoadingSpinner';
import IPOMindMap from '@/components/IPOMindMap';
import ActivityLogModal from '@/components/ActivityLogModal';

const MoneyIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const UsersIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const TrophyIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
  </svg>
);

const categoryBadgeClass: Record<InvestmentCategory, string> = {
  HNI: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  sHNI: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  bHNI: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30',
  RETAIL: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  SME: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
};

export function IPODetailClient({ ipoId }: { ipoId: string }) {
  const { user, userData, loading: authLoading } = useAuth();
  const router = useRouter();

  const { ipo, loading: ipoLoading } = useIPO(ipoId);
  const { investments, loading: investmentsLoading } = useIPOInvestments(ipoId);
  const { applications, loading: applicationsLoading } = useIPOApplications(ipoId);
  const { users, loading: usersLoading } = useAllUsers();

  const [activeView, setActiveView] = useState<'TABLE' | 'MINDMAP'>('TABLE');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalTab, setAddModalTab] = useState<'INVESTOR' | 'APPLICATION'>('INVESTOR');
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);

  // Form State
  const [selectedUid, setSelectedUid] = useState('');
  const [investedAmount, setInvestedAmount] = useState('');
  const [category, setCategory] = useState<InvestmentCategory>('RETAIL');
  const [lotsApplied, setLotsApplied] = useState('1');
  const [allotmentStatus, setAllotmentStatus] = useState<'APPLIED' | 'ALLOTTED' | 'NOT_ALLOTTED'>('APPLIED');

  // Edit Investment State
  const [editInvestmentId, setEditInvestmentId] = useState('');
  const [editOldAmount, setEditOldAmount] = useState(0);
  const [editNewAmount, setEditNewAmount] = useState('');
  const [editUserName, setEditUserName] = useState('');

  const [netProfitInput, setNetProfitInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (!authLoading && userData && !userData.isAdmin) router.push('/dashboard');
  }, [user, userData, authLoading, router]);

  if (authLoading || ipoLoading || investmentsLoading || applicationsLoading || usersLoading) {
    return <LoadingSpinner />;
  }
  if (!user || !userData || !userData.isAdmin || !ipo) return null;

  const runningTotal = investments.reduce((sum, inv) => sum + inv.investedAmount, 0);
  const totalAppsAmount = applications.reduce((sum, app) => sum + app.amount, 0);
  const totalLotsApplied = applications.reduce((sum, app) => sum + (app.lotsApplied || 1), 0);
  const sharesPerLot = ipo.sharesPerLot || ipo.lotSize || 1;
  const adminInfo = { email: userData.email, name: userData.displayName };

  // Category Breakup Summary
  const categoryBreakup = applications.reduce((acc, app) => {
    const cat = app.category || 'RETAIL';
    if (!acc[cat]) acc[cat] = { count: 0, lots: 0, amount: 0 };
    acc[cat].count += 1;
    acc[cat].lots += app.lotsApplied || 1;
    acc[cat].amount += app.amount;
    return acc;
  }, {} as Record<InvestmentCategory, { count: number; lots: number; amount: number }>);

  // ─── Add Capital Contributor / Investor ─────────────────────────────

  const handleAddInvestor = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedUid) {
      setError('Please select a registered user.');
      return;
    }

    const amt = parseFloat(investedAmount);
    if (isNaN(amt) || amt <= 0) {
      setError('Please enter a valid contribution amount.');
      return;
    }

    const targetUser = users.find((u) => u.uid === selectedUid);
    if (!targetUser) {
      setError('User not found.');
      return;
    }

    setSubmitting(true);
    try {
      await addInvestment(
        ipoId,
        ipo.name,
        targetUser.uid,
        targetUser.email,
        targetUser.displayName,
        amt,
        undefined,
        undefined,
        'CONTRIBUTOR',
        adminInfo
      );
      setSuccess(`Added ${targetUser.displayName} as Capital Contributor (${formatCurrency(amt)})`);
      setShowAddModal(false);
      setSelectedUid('');
      setInvestedAmount('');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add investor');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Add Demat Application ────────────────────────────────────────

  const handleAddApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedUid) {
      setError('Please select an applicant.');
      return;
    }

    const lots = parseInt(lotsApplied, 10);
    if (isNaN(lots) || lots < 1) {
      setError('Please enter valid lots count.');
      return;
    }

    const targetUser = users.find((u) => u.uid === selectedUid);
    if (!targetUser) {
      setError('User not found.');
      return;
    }

    const calculatedAmt = ipo.issuePrice * sharesPerLot * lots;

    setSubmitting(true);
    try {
      await addIPOApplication(
        ipoId,
        ipo.name,
        targetUser.uid,
        targetUser.email,
        targetUser.displayName,
        category,
        lots,
        calculatedAmt,
        allotmentStatus,
        adminInfo
      );
      setSuccess(`Logged ${category} application for ${targetUser.displayName} (${lots} lot(s), ${formatCurrency(calculatedAmt)})`);
      setShowAddModal(false);
      setSelectedUid('');
      setLotsApplied('1');
      setCategory('RETAIL');
      setAllotmentStatus('APPLIED');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add application');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Remove Investor / Application ───────────────────────────────

  const handleRemoveInvestor = async (investmentId: string, userDisplayName: string, amt: number) => {
    if (!confirm(`Remove ${userDisplayName}'s contribution of ${formatCurrency(amt)}?`)) return;
    try {
      await removeInvestment(investmentId, ipoId, ipo.name, userDisplayName, amt, adminInfo);
      setSuccess(`Removed contribution for ${userDisplayName}`);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove contribution');
    }
  };

  const handleRemoveApplication = async (appId: string, userDisplayName: string) => {
    if (!confirm(`Remove application for ${userDisplayName}?`)) return;
    try {
      await removeIPOApplication(appId, ipo.name, userDisplayName, adminInfo);
      setSuccess(`Removed application for ${userDisplayName}`);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove application');
    }
  };

  // ─── Edit Investor Amount ─────────────────────────────────────────

  const openEditModal = (inv: (typeof investments)[0]) => {
    setEditInvestmentId(inv.id);
    setEditOldAmount(inv.investedAmount);
    setEditNewAmount(String(inv.investedAmount));
    setEditUserName(inv.userDisplayName);
    setShowEditModal(true);
    setError('');
  };

  const handleEditInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const newAmt = parseFloat(editNewAmount);
    if (isNaN(newAmt) || newAmt <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    setSubmitting(true);
    try {
      await updateInvestmentAmount(
        editInvestmentId,
        ipoId,
        ipo.name,
        editUserName,
        editOldAmount,
        newAmt,
        undefined,
        undefined,
        'CONTRIBUTOR',
        adminInfo
      );
      setSuccess(`Updated ${editUserName}'s contribution to ${formatCurrency(newAmt)}`);
      setShowEditModal(false);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update investment');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Status & Profit Resolution ──────────────────────────────────

  const handleStatusChange = async (newStatus: IPO['status']) => {
    try {
      await updateIPOStatus(ipoId, ipo.name, newStatus, adminInfo);
      setSuccess(`Updated IPO status to ${newStatus}`);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleResolveIPO = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const profit = parseFloat(netProfitInput);
    if (isNaN(profit)) {
      setError('Please enter a valid net profit or loss figure.');
      return;
    }

    setSubmitting(true);
    try {
      await resolveIPO(ipoId, ipo.name, profit, adminInfo);
      setSuccess(`Resolved deal for "${ipo.name}" with ${profit >= 0 ? 'profit' : 'loss'} of ${formatCurrency(profit)}!`);
      setShowResolveModal(false);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resolve deal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin" className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1 mb-2">
            ← Back to All IPOs
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">{ipo.name}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
              ipo.status === 'OPEN' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
              ipo.status === 'APPLIED' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
              ipo.status === 'ALLOTTED' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' :
              'bg-purple-500/10 text-purple-400 border border-purple-500/30'
            }`}>
              {ipo.status}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Issue Price: <span className="text-white font-semibold">{formatCurrency(ipo.issuePrice)}</span> | Shares/Lot: <span className="text-white font-semibold">{sharesPerLot}</span> | Dates: {ipo.openDate} → {ipo.closeDate}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowLogModal(true)}
            className="text-xs px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 transition-colors border border-white/[0.08]"
          >
            📋 Action Logs
          </button>
          <select
            value={ipo.status}
            onChange={(e) => handleStatusChange(e.target.value as IPO['status'])}
            className="input-field py-1.5 px-3 text-xs bg-slate-900 border-white/10 w-auto"
          >
            <option value="OPEN">Mark as OPEN</option>
            <option value="APPLIED">Mark as APPLIED</option>
            <option value="ALLOTTED">Mark as ALLOTTED</option>
            <option value="SOLD">Mark as SOLD</option>
          </select>
          {ipo.status !== 'SOLD' && (
            <button
              onClick={() => { setShowResolveModal(true); setNetProfitInput(''); setError(''); }}
              className="btn-amber text-xs px-4 py-2"
            >
              💰 Mark Sold & Distribute Profit
            </button>
          )}
        </div>
      </div>

      {/* Success / Error Alerts */}
      {error && <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">⚠️ {error}</div>}
      {success && <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">✅ {success}</div>}

      {/* 📊 Summary Cards (Image 3 Request) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Capital Pool */}
        <StatCard
          label="Total Capital Funds Collected"
          value={formatCurrency(runningTotal)}
          icon={<MoneyIcon />}
          glowColor="emerald"
          subtext={`${investments.length} Capital Contributor(s)`}
        />

        {/* Card 2: Total Demat Applications & Category Breakup */}
        <div className="glass-card p-5 relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Demat Applications</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {totalLotsApplied} Lots Total
              </span>
            </div>
            <div className="text-2xl font-extrabold text-white">
              {formatCurrency(totalAppsAmount)}
            </div>
          </div>

          {/* Category Breakup Pills */}
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex flex-wrap gap-1.5 text-[11px]">
            {Object.keys(categoryBadgeClass).map((catKey) => {
              const info = categoryBreakup[catKey as InvestmentCategory];
              if (!info || info.count === 0) return null;
              const conf = categoryBadgeClass[catKey as InvestmentCategory];
              return (
                <span key={catKey} className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${conf}`}>
                  {catKey}: {info.lots} Lot(s) ({formatCurrency(info.amount)})
                </span>
              );
            })}
            {applications.length === 0 && (
              <span className="text-slate-500 text-[11px]">No demat applications logged yet.</span>
            )}
          </div>
        </div>

        {/* Card 3: Net Deal Profit */}
        <StatCard
          label="Net Deal Profit / Loss"
          value={ipo.status === 'SOLD' ? `${ipo.netProfit >= 0 ? '+' : ''}${formatCurrency(ipo.netProfit)}` : 'Pending Sale'}
          icon={<TrophyIcon />}
          glowColor={ipo.status === 'SOLD' && ipo.netProfit >= 0 ? 'emerald' : 'rose'}
          subtext={ipo.status === 'SOLD' ? 'Proportionally distributed to investors' : 'Awaiting sale resolution'}
        />
      </div>

      {/* View Mode Toggle & Add Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex rounded-xl bg-white/[0.04] p-1 border border-white/[0.06]">
          <button
            onClick={() => setActiveView('TABLE')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeView === 'TABLE' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            📊 Table View
          </button>
          <button
            onClick={() => setActiveView('MINDMAP')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeView === 'MINDMAP' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            🧠 Mind Map View
          </button>
        </div>

        {ipo.status !== 'SOLD' && (
          <button
            onClick={() => { setShowAddModal(true); setError(''); }}
            className="btn-primary text-xs px-4 py-2"
          >
            + Add Investor / Application
          </button>
        )}
      </div>

      {/* ═══════ MIND MAP VIEW ═══════ */}
      {activeView === 'MINDMAP' ? (
        <div className="animate-fadeIn">
          <IPOMindMap ipoName={ipo.name} totalInvested={runningTotal} investments={investments} applications={applications} />
        </div>
      ) : (
        /* ═══════ TABLE VIEW ═══════ */
        <div className="space-y-8 animate-fadeIn">
          {/* Table 1: Capital Contributors */}
          <div className="glass-card-static overflow-hidden">
            <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">💰 Capital Depositors Pool</h2>
                <p className="text-xs text-slate-500 mt-0.5">Capital contributed by each person for profit sharing</p>
              </div>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                Total Pool: {formatCurrency(runningTotal)}
              </span>
            </div>

            <div className="overflow-x-auto">
              {investments.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No capital contributors logged yet. Click &quot;+ Add Investor / Application&quot; to deposit capital.
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Contributor</th>
                      <th>Invested Capital (₹)</th>
                      <th>Capital Share</th>
                      <th>Status</th>
                      {ipo.status === 'SOLD' && <th>Profit Earned</th>}
                      {ipo.status !== 'SOLD' && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {investments.map((inv) => {
                      const sharePct = runningTotal > 0 ? (inv.investedAmount / runningTotal) * 100 : 0;
                      return (
                        <tr key={inv.id}>
                          <td>
                            <div className="font-semibold text-white">{inv.userDisplayName}</div>
                            <div className="text-[11px] text-slate-400">{inv.userEmail}</div>
                          </td>
                          <td className="text-emerald-400 font-bold">{formatCurrency(inv.investedAmount)}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden max-w-[80px]">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(sharePct, 100)}%` }} />
                              </div>
                              <span className="text-xs text-slate-400">{sharePct.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td>
                            <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              Contributor
                            </span>
                          </td>
                          {ipo.status === 'SOLD' && (
                            <td className={`font-bold ${inv.profitEarned >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {inv.profitEarned >= 0 ? '+' : ''}{formatCurrency(inv.profitEarned)}
                            </td>
                          )}
                          {ipo.status !== 'SOLD' && (
                            <td>
                              <div className="flex items-center gap-2">
                                <button onClick={() => openEditModal(inv)} className="text-xs px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors">
                                  ✏️ Edit
                                </button>
                                <button onClick={() => handleRemoveInvestor(inv.id, inv.userDisplayName, inv.investedAmount)} className="text-xs px-2.5 py-1 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors">
                                  Remove
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Table 2: Demat Applications */}
          <div className="glass-card-static overflow-hidden">
            <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">📋 Demat Applications (Applied Categories)</h2>
                <p className="text-xs text-slate-500 mt-0.5">Category allotments and lots applied per person</p>
              </div>
              <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                Total Applications: {formatCurrency(totalAppsAmount)}
              </span>
            </div>

            <div className="overflow-x-auto">
              {applications.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No demat applications logged for this IPO. Click &quot;+ Add Investor / Application&quot; tab to log applications.
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Applicant</th>
                      <th>Category</th>
                      <th>Lots Applied</th>
                      <th>Application Value</th>
                      <th>Allotment Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((app) => {
                      const badgeStyle = categoryBadgeClass[app.category || 'RETAIL'];
                      return (
                        <tr key={app.id}>
                          <td>
                            <div className="font-semibold text-white">{app.userDisplayName}</div>
                            <div className="text-[11px] text-slate-400">{app.userEmail}</div>
                          </td>
                          <td>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeStyle}`}>
                              {app.category}
                            </span>
                          </td>
                          <td className="text-slate-300 font-semibold">{app.lotsApplied} Lot(s)</td>
                          <td className="text-emerald-400 font-bold">{formatCurrency(app.amount)}</td>
                          <td>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                              app.allotmentStatus === 'ALLOTTED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                              app.allotmentStatus === 'NOT_ALLOTTED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                              'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            }`}>
                              {app.allotmentStatus || 'APPLIED'}
                            </span>
                          </td>
                          <td>
                            <button onClick={() => handleRemoveApplication(app.id, app.userDisplayName)} className="text-xs px-2.5 py-1 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors">
                              Remove
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
        </div>
      )}

      {/* ═══════ Add Investor / Application Modal ═══════ */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={`Add Entry to ${ipo.name}`}>
        <div className="space-y-4">
          {/* Modal Mode Selector Tabs */}
          <div className="flex border-b border-white/[0.08] gap-4">
            <button
              onClick={() => setAddModalTab('INVESTOR')}
              className={`pb-2.5 text-xs font-bold transition-colors ${
                addModalTab === 'INVESTOR' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400 hover:text-white'
              }`}
            >
              💰 Capital Contributor (Investor)
            </button>
            <button
              onClick={() => setAddModalTab('APPLICATION')}
              className={`pb-2.5 text-xs font-bold transition-colors ${
                addModalTab === 'APPLICATION' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-white'
              }`}
            >
              📋 Demat Application (Category & Lots)
            </button>
          </div>

          {/* TAB 1: CAPITAL CONTRIBUTOR (IMAGE 2 REQUEST) */}
          {addModalTab === 'INVESTOR' ? (
            <form onSubmit={handleAddInvestor} className="space-y-4">
              <p className="text-[11px] text-slate-400">
                Log money contributed by an investor for profit sharing. Lot size and category are not required here.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Select User (by Email)</label>
                <select value={selectedUid} onChange={(e) => setSelectedUid(e.target.value)} className="input-field bg-white/[0.05]" required>
                  <option value="" className="bg-slate-900 text-slate-400">-- Choose User --</option>
                  {users.map((u) => (
                    <option key={u.uid} value={u.uid} className="bg-slate-900 text-white">{u.displayName} ({u.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Invested Amount (₹)</label>
                <input type="number" className="input-field" placeholder="e.g. 50000" value={investedAmount} onChange={(e) => setInvestedAmount(e.target.value)} min="1" required />
              </div>

              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs flex justify-between">
                <span className="text-slate-300 font-medium">Allotment Status:</span>
                <span className="text-emerald-400 font-bold uppercase">Contributor</span>
              </div>

              {error && <p className="text-rose-400 text-xs">⚠️ {error}</p>}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={submitting} className="btn-primary flex-1 py-2.5">{submitting ? 'Adding...' : 'Confirm Capital Allocation'}</button>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary py-2.5">Cancel</button>
              </div>
            </form>
          ) : (
            /* TAB 2: DEMAT APPLICATION */
            <form onSubmit={handleAddApplication} className="space-y-4">
              <p className="text-[11px] text-slate-400">
                Log official demat applications filed under specific categories for the IPO deal.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Select Applicant (by Email)</label>
                <select value={selectedUid} onChange={(e) => setSelectedUid(e.target.value)} className="input-field bg-white/[0.05]" required>
                  <option value="" className="bg-slate-900 text-slate-400">-- Choose User --</option>
                  {users.map((u) => (
                    <option key={u.uid} value={u.uid} className="bg-slate-900 text-white">{u.displayName} ({u.email})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value as InvestmentCategory)} className="input-field bg-white/[0.05]">
                    <option value="RETAIL" className="bg-slate-900 text-white">Regular / Retail</option>
                    <option value="HNI" className="bg-slate-900 text-white">HNI Category</option>
                    <option value="sHNI" className="bg-slate-900 text-white">sHNI (Small HNI)</option>
                    <option value="bHNI" className="bg-slate-900 text-white">bHNI (Big HNI)</option>
                    <option value="SME" className="bg-slate-900 text-white">SME Category</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Lots Applied</label>
                  <input type="number" min="1" className="input-field" value={lotsApplied} onChange={(e) => setLotsApplied(e.target.value)} required />
                </div>
              </div>

              {/* Calculated Application Amount Callout */}
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs flex justify-between items-center">
                <span className="text-slate-300 font-medium">Calculated Application Value:</span>
                <span className="text-blue-400 font-bold text-sm">
                  {formatCurrency(ipo.issuePrice * sharesPerLot * parseInt(lotsApplied || '1', 10))}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Allotment Status</label>
                <select value={allotmentStatus} onChange={(e) => setAllotmentStatus(e.target.value as typeof allotmentStatus)} className="input-field bg-white/[0.05]">
                  <option value="APPLIED" className="bg-slate-900 text-white">Applied</option>
                  <option value="ALLOTTED" className="bg-slate-900 text-white">Allotted</option>
                  <option value="NOT_ALLOTTED" className="bg-slate-900 text-white">Not Allotted</option>
                </select>
              </div>

              {error && <p className="text-rose-400 text-xs">⚠️ {error}</p>}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={submitting} className="btn-primary flex-1 py-2.5">{submitting ? 'Logging...' : 'Save Demat Application'}</button>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary py-2.5">Cancel</button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* Edit Investor Amount Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title={`Edit Contribution — ${editUserName}`}>
        <form onSubmit={handleEditInvestment} className="space-y-4">
          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-xs flex justify-between">
            <span className="text-slate-400">Current Capital Amount</span>
            <span className="text-white font-semibold">{formatCurrency(editOldAmount)}</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">New Capital Amount (₹)</label>
            <input type="number" className="input-field" value={editNewAmount} onChange={(e) => setEditNewAmount(e.target.value)} min="1" required />
          </div>

          {error && <p className="text-rose-400 text-xs">⚠️ {error}</p>}

          <div className="flex gap-3 pt-3">
            <button type="submit" disabled={submitting} className="btn-blue flex-1 py-2.5">{submitting ? 'Updating...' : 'Update Capital Amount'}</button>
            <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary py-2.5">Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Resolve IPO Modal */}
      <Modal isOpen={showResolveModal} onClose={() => setShowResolveModal(false)} title={`Resolve IPO: ${ipo.name}`}>
        <form onSubmit={handleResolveIPO} className="space-y-4">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Total Funds Collected</span>
              <span className="text-white font-semibold">{formatCurrency(runningTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Participating Investors</span>
              <span className="text-white font-semibold">{investments.length}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Total Net Profit / Loss (₹)</label>
            <input type="number" step="0.01" className="input-field" placeholder="e.g. 25000 or -5000" value={netProfitInput} onChange={(e) => setNetProfitInput(e.target.value)} required />
          </div>
          {error && <p className="text-rose-400 text-xs">⚠️ {error}</p>}
          <div className="flex gap-3 pt-3">
            <button type="submit" disabled={submitting} className="btn-amber flex-1 py-2.5">{submitting ? 'Resolving...' : 'Confirm Resolution'}</button>
            <button type="button" onClick={() => setShowResolveModal(false)} className="btn-secondary py-2.5">Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Activity Log Modal */}
      <ActivityLogModal isOpen={showLogModal} onClose={() => setShowLogModal(false)} />
    </div>
  );
}

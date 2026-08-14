'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  useIPO,
  useIPOInvestments,
  useAllUsers,
  addInvestment,
  removeInvestment,
  updateInvestmentAmount,
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
  const { users, loading: usersLoading } = useAllUsers();

  const [activeView, setActiveView] = useState<'TABLE' | 'MINDMAP'>('TABLE');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);

  // Add Investor Form State
  const [selectedUid, setSelectedUid] = useState('');
  const [investedAmount, setInvestedAmount] = useState('');
  const [category, setCategory] = useState<InvestmentCategory>('RETAIL');
  const [lotsApplied, setLotsApplied] = useState('1');
  const [allotmentStatus, setAllotmentStatus] = useState<'APPLIED' | 'ALLOTTED' | 'NOT_ALLOTTED'>('APPLIED');

  // Edit Investment State
  const [editInvestmentId, setEditInvestmentId] = useState('');
  const [editOldAmount, setEditOldAmount] = useState(0);
  const [editNewAmount, setEditNewAmount] = useState('');
  const [editCategory, setEditCategory] = useState<InvestmentCategory>('RETAIL');
  const [editLotsApplied, setEditLotsApplied] = useState('1');
  const [editAllotmentStatus, setEditAllotmentStatus] = useState<'APPLIED' | 'ALLOTTED' | 'NOT_ALLOTTED'>('APPLIED');
  const [editUserName, setEditUserName] = useState('');

  const [netProfitInput, setNetProfitInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (!authLoading && userData && !userData.isAdmin) router.push('/dashboard');
  }, [user, userData, authLoading, router]);

  if (authLoading || ipoLoading || investmentsLoading || usersLoading) return <LoadingSpinner />;
  if (!user || !userData || !userData.isAdmin || !ipo) return null;

  const runningTotal = investments.reduce((sum, inv) => sum + inv.investedAmount, 0);
  const adminInfo = { email: userData.email, name: userData.displayName };

  // ─── Add Investor ─────────────────────────────────────────────────

  const handleAddInvestor = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedUid) {
      setError('Please select a registered user.');
      return;
    }

    const amt = parseFloat(investedAmount);
    if (isNaN(amt) || amt <= 0) {
      setError('Please enter a valid investment amount.');
      return;
    }

    const lots = parseInt(lotsApplied, 10);
    if (isNaN(lots) || lots < 1) {
      setError('Please enter a valid lot size count.');
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
        category,
        lots,
        allotmentStatus,
        adminInfo
      );
      setSuccess(`Allocated ${formatCurrency(amt)} (${category}, ${lots} lot(s)) to ${targetUser.email}`);
      setShowAddModal(false);
      setSelectedUid('');
      setInvestedAmount('');
      setCategory('RETAIL');
      setLotsApplied('1');
      setAllotmentStatus('APPLIED');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add investor');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Remove Investor ──────────────────────────────────────────────

  const handleRemoveInvestor = async (investmentId: string, userDisplayName: string, userEmail: string, amt: number) => {
    if (!confirm(`Remove ${userDisplayName}'s allocation of ${formatCurrency(amt)}?`)) return;
    try {
      await removeInvestment(investmentId, ipoId, ipo.name, userDisplayName, amt, adminInfo);
      setSuccess(`Removed allocation for ${userDisplayName}`);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove investment');
    }
  };

  // ─── Edit Investment Amount ───────────────────────────────────────

  const openEditModal = (inv: (typeof investments)[0]) => {
    setEditInvestmentId(inv.id);
    setEditOldAmount(inv.investedAmount);
    setEditNewAmount(String(inv.investedAmount));
    setEditCategory(inv.category || 'RETAIL');
    setEditLotsApplied(String(inv.lotsApplied || 1));
    setEditAllotmentStatus(inv.allotmentStatus || 'APPLIED');
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

    const lots = parseInt(editLotsApplied, 10);
    if (isNaN(lots) || lots < 1) {
      setError('Please enter a valid lot count.');
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
        editCategory,
        lots,
        editAllotmentStatus,
        adminInfo
      );
      setSuccess(`Updated ${editUserName}'s allocation to ${formatCurrency(newAmt)} (${editCategory}, ${lots} lot(s))`);
      setShowEditModal(false);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update investment');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Status Change ────────────────────────────────────────────────

  const handleStatusChange = async (newStatus: IPO['status']) => {
    try {
      await updateIPOStatus(ipoId, ipo.name, newStatus, adminInfo);
      setSuccess(`Updated IPO status to ${newStatus}`);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  // ─── Resolve IPO ──────────────────────────────────────────────────

  const handleResolveIPO = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const profit = parseFloat(netProfitInput);
    if (isNaN(profit)) {
      setError('Please enter a valid net profit or loss amount.');
      return;
    }

    if (investments.length === 0) {
      setError('Cannot resolve an IPO with no investors.');
      return;
    }

    setSubmitting(true);
    try {
      await resolveIPO(ipoId, ipo.name, profit, adminInfo);
      setSuccess(`Successfully resolved IPO! Distributed ${formatCurrency(profit)} profit across ${investments.length} investor(s).`);
      setShowResolveModal(false);
      setNetProfitInput('');
      setTimeout(() => setSuccess(''), 7000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resolve IPO');
    } finally {
      setSubmitting(false);
    }
  };

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
      {/* Back & Header */}
      <div className="mb-6 animate-fadeIn">
        <Link
          href="/admin"
          className="text-xs text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1 mb-3"
        >
          ← Back to All IPOs
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{ipo.name}</h1>
              {getStatusBadge(ipo.status)}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Issue Price: {formatCurrency(ipo.issuePrice)} | Lot Size: {ipo.lotSize} shares | Dates: {ipo.openDate} → {ipo.closeDate}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowLogModal(true)}
              className="btn-secondary text-xs font-semibold px-3 py-2 flex items-center gap-1.5"
              id="view-logs-btn"
            >
              📋 Action Logs
            </button>

            {ipo.status !== 'SOLD' && (
              <select
                value={ipo.status}
                onChange={(e) => handleStatusChange(e.target.value as IPO['status'])}
                className="input-field py-2 text-xs font-semibold bg-white/[0.05]"
                id="status-change-select"
              >
                <option value="OPEN" className="bg-slate-900 text-white">Mark as OPEN</option>
                <option value="APPLIED" className="bg-slate-900 text-white">Mark as APPLIED</option>
                <option value="ALLOTTED" className="bg-slate-900 text-white">Mark as ALLOTTED</option>
              </select>
            )}

            {ipo.status !== 'SOLD' && (
              <button
                onClick={() => {
                  setShowResolveModal(true);
                  setError('');
                }}
                className="btn-amber text-xs font-semibold px-4 py-2"
                id="resolve-ipo-modal-btn"
              >
                💰 Mark Sold & Distribute Profit
              </button>
            )}
          </div>
        </div>
      </div>

      {success && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm animate-fadeIn">
          ✅ {success}
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="animate-fadeIn stagger-1 opacity-0">
          <StatCard label="Total Funds Collected" value={formatCurrency(runningTotal)} icon={<MoneyIcon />} glowColor="emerald" subtext="Sum of all allocated user capital" />
        </div>
        <div className="animate-fadeIn stagger-2 opacity-0">
          <StatCard label="Total Investors" value={`${investments.length}`} icon={<UsersIcon />} glowColor="blue" subtext="Participating members in this deal" />
        </div>
        <div className="animate-fadeIn stagger-3 opacity-0">
          <StatCard
            label="Net Deal Profit"
            value={ipo.status === 'SOLD' ? `${ipo.netProfit >= 0 ? '+' : ''}${formatCurrency(ipo.netProfit)}` : 'Pending Sale'}
            icon={<TrophyIcon />}
            glowColor={ipo.status === 'SOLD' && ipo.netProfit >= 0 ? 'emerald' : 'rose'}
            subtext={ipo.status === 'SOLD' ? 'Proportionally distributed' : 'Awaiting resolution'}
          />
        </div>
      </div>

      {/* View Mode Toggle Bar */}
      <div className="flex items-center justify-between mb-4">
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
            id="add-investor-btn"
          >
            + Add Investor / Application
          </button>
        )}
      </div>

      {/* ═══════ MIND MAP VIEW ═══════ */}
      {activeView === 'MINDMAP' ? (
        <div className="animate-fadeIn">
          <IPOMindMap ipoName={ipo.name} totalInvested={runningTotal} investments={investments} />
        </div>
      ) : (
        /* ═══════ TABLE VIEW ═══════ */
        <div className="glass-card-static overflow-hidden mb-8 animate-fadeIn">
          <div className="p-6 border-b border-white/[0.06]">
            <h2 className="text-lg font-semibold text-white">Investor Allocations & Hybrid Categories</h2>
            <p className="text-xs text-slate-500 mt-1">Capital contributions and category breakdown for {ipo.name}</p>
          </div>

          <div className="overflow-x-auto">
            {investments.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-3xl mb-3">👥</div>
                <p className="text-slate-500 text-sm">No investors allocated to this IPO yet.</p>
                <p className="text-slate-600 text-xs mt-1">Click &quot;+ Add Investor / Application&quot; to log applications.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Investor</th>
                    <th>Category</th>
                    <th>Lots</th>
                    <th>Invested Amount</th>
                    <th>Contribution Share</th>
                    <th>Allotment Status</th>
                    {ipo.status === 'SOLD' && <th>Profit Earned</th>}
                    {ipo.status !== 'SOLD' && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {investments.map((inv) => {
                    const sharePct = runningTotal > 0 ? (inv.investedAmount / runningTotal) * 100 : 0;
                    const badgeStyle = categoryBadgeClass[inv.category || 'RETAIL'] || categoryBadgeClass.RETAIL;

                    return (
                      <tr key={inv.id}>
                        <td>
                          <div className="font-semibold text-white">{inv.userDisplayName}</div>
                          <div className="text-[11px] text-slate-400">{inv.userEmail}</div>
                        </td>
                        <td>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeStyle}`}>
                            {inv.category || 'RETAIL'}
                          </span>
                        </td>
                        <td className="text-slate-300 font-semibold text-xs">{inv.lotsApplied || 1} Lot(s)</td>
                        <td className="text-emerald-400 font-medium">{formatCurrency(inv.investedAmount)}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden max-w-[80px]">
                              <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full" style={{ width: `${Math.min(sharePct, 100)}%` }} />
                            </div>
                            <span className="text-xs text-slate-400">{sharePct.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                              inv.allotmentStatus === 'ALLOTTED'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : inv.allotmentStatus === 'NOT_ALLOTTED'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            }`}
                          >
                            {inv.allotmentStatus || 'APPLIED'}
                          </span>
                        </td>
                        {ipo.status === 'SOLD' && (
                          <td className={`font-semibold ${inv.profitEarned >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {inv.profitEarned >= 0 ? '+' : ''}{formatCurrency(inv.profitEarned)}
                          </td>
                        )}
                        {ipo.status !== 'SOLD' && (
                          <td>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openEditModal(inv)}
                                className="text-xs px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() => handleRemoveInvestor(inv.id, inv.userDisplayName, inv.userEmail, inv.investedAmount)}
                                className="text-xs px-2.5 py-1 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
                              >
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
      )}

      {/* ═══════ Add Investor Modal ═══════ */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={`Add Application to ${ipo.name}`}>
        <form onSubmit={handleAddInvestor} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Select User (by Email)</label>
            <select value={selectedUid} onChange={(e) => setSelectedUid(e.target.value)} className="input-field bg-white/[0.05]" id="select-user-dropdown" required>
              <option value="" className="bg-slate-900 text-slate-400 py-2">-- Choose User --</option>
              {users.map((u) => (
                <option key={u.uid} value={u.uid} className="bg-slate-900 text-white py-2">{u.displayName} ({u.email})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as InvestmentCategory)} className="input-field bg-white/[0.05]" id="select-category-dropdown">
                <option value="RETAIL" className="bg-slate-900 text-white">Regular / Retail</option>
                <option value="HNI" className="bg-slate-900 text-white">HNI Category</option>
                <option value="sHNI" className="bg-slate-900 text-white">sHNI (Small HNI)</option>
                <option value="bHNI" className="bg-slate-900 text-white">bHNI (Big HNI)</option>
                <option value="SME" className="bg-slate-900 text-white">SME Category</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Lots Applied</label>
              <input type="number" min="1" className="input-field" value={lotsApplied} onChange={(e) => setLotsApplied(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Invested Amount (₹)</label>
              <input type="number" className="input-field" placeholder="e.g. 50000" value={investedAmount} onChange={(e) => setInvestedAmount(e.target.value)} id="invested-amount-input" min="1" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Allotment Status</label>
              <select value={allotmentStatus} onChange={(e) => setAllotmentStatus(e.target.value as typeof allotmentStatus)} className="input-field bg-white/[0.05]">
                <option value="APPLIED" className="bg-slate-900 text-white">Applied</option>
                <option value="ALLOTTED" className="bg-slate-900 text-white">Allotted</option>
                <option value="NOT_ALLOTTED" className="bg-slate-900 text-white">Not Allotted</option>
              </select>
            </div>
          </div>

          {error && <p className="text-rose-400 text-xs">⚠️ {error}</p>}

          <div className="flex gap-3 pt-3">
            <button type="submit" disabled={submitting} className="btn-primary flex-1 py-2.5" id="save-investor-btn">{submitting ? 'Allocating...' : 'Confirm Allocation'}</button>
            <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary py-2.5">Cancel</button>
          </div>
        </form>
      </Modal>

      {/* ═══════ Edit Investment Modal ═══════ */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title={`Edit Application — ${editUserName}`}>
        <form onSubmit={handleEditInvestment} className="space-y-4">
          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-xs flex justify-between">
            <span className="text-slate-400">Current Amount</span>
            <span className="text-white font-semibold">{formatCurrency(editOldAmount)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Category</label>
              <select value={editCategory} onChange={(e) => setEditCategory(e.target.value as InvestmentCategory)} className="input-field bg-white/[0.05]">
                <option value="RETAIL" className="bg-slate-900 text-white">Regular / Retail</option>
                <option value="HNI" className="bg-slate-900 text-white">HNI Category</option>
                <option value="sHNI" className="bg-slate-900 text-white">sHNI (Small HNI)</option>
                <option value="bHNI" className="bg-slate-900 text-white">bHNI (Big HNI)</option>
                <option value="SME" className="bg-slate-900 text-white">SME Category</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Lots Applied</label>
              <input type="number" min="1" className="input-field" value={editLotsApplied} onChange={(e) => setEditLotsApplied(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">New Amount (₹)</label>
              <input type="number" className="input-field" value={editNewAmount} onChange={(e) => setEditNewAmount(e.target.value)} min="1" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Allotment Status</label>
              <select value={editAllotmentStatus} onChange={(e) => setEditAllotmentStatus(e.target.value as typeof editAllotmentStatus)} className="input-field bg-white/[0.05]">
                <option value="APPLIED" className="bg-slate-900 text-white">Applied</option>
                <option value="ALLOTTED" className="bg-slate-900 text-white">Allotted</option>
                <option value="NOT_ALLOTTED" className="bg-slate-900 text-white">Not Allotted</option>
              </select>
            </div>
          </div>

          {error && <p className="text-rose-400 text-xs">⚠️ {error}</p>}

          <div className="flex gap-3 pt-3">
            <button type="submit" disabled={submitting} className="btn-blue flex-1 py-2.5" id="save-edit-btn">{submitting ? 'Updating...' : 'Update Application'}</button>
            <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary py-2.5">Cancel</button>
          </div>
        </form>
      </Modal>

      {/* ═══════ Resolve IPO Modal ═══════ */}
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
            <input type="number" step="0.01" className="input-field" placeholder="e.g. 25000 or -5000" value={netProfitInput} onChange={(e) => setNetProfitInput(e.target.value)} id="net-profit-input" required />
          </div>
          {error && <p className="text-rose-400 text-xs">⚠️ {error}</p>}
          <div className="flex gap-3 pt-3">
            <button type="submit" disabled={submitting} className="btn-amber flex-1 py-2.5" id="confirm-resolve-btn">{submitting ? 'Resolving...' : 'Confirm Resolution'}</button>
            <button type="button" onClick={() => setShowResolveModal(false)} className="btn-secondary py-2.5">Cancel</button>
          </div>
        </form>
      </Modal>

      {/* ═══════ Activity Log Modal ═══════ */}
      <ActivityLogModal isOpen={showLogModal} onClose={() => setShowLogModal(false)} />
    </div>
  );
}

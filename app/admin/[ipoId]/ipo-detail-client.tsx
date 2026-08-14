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
  resolveIPO,
  updateIPOStatus,
  IPO,
} from '@/lib/firestore';
import { formatCurrency } from '@/lib/helpers';
import StatCard from '@/components/StatCard';
import Modal from '@/components/Modal';
import LoadingSpinner from '@/components/LoadingSpinner';

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

export function IPODetailClient({ ipoId }: { ipoId: string }) {
  const { user, userData, loading: authLoading } = useAuth();
  const router = useRouter();

  const { ipo, loading: ipoLoading } = useIPO(ipoId);
  const { investments, loading: investmentsLoading } = useIPOInvestments(ipoId);
  const { users, loading: usersLoading } = useAllUsers();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);

  const [selectedUid, setSelectedUid] = useState('');
  const [investedAmount, setInvestedAmount] = useState('');
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

  // Running total of collected capital
  const runningTotal = investments.reduce((sum, inv) => sum + inv.investedAmount, 0);

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

    const targetUser = users.find((u) => u.uid === selectedUid);
    if (!targetUser) {
      setError('User not found.');
      return;
    }

    setSubmitting(true);
    try {
      await addInvestment(
        ipoId,
        targetUser.uid,
        targetUser.email,
        targetUser.displayName,
        amt
      );
      setSuccess(`Allocated ${formatCurrency(amt)} to ${targetUser.email}`);
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

  const handleRemoveInvestor = async (investmentId: string, userEmail: string, amt: number) => {
    if (!confirm(`Remove ${userEmail}'s investment of ${formatCurrency(amt)}?`)) return;
    try {
      await removeInvestment(investmentId, ipoId, amt);
      setSuccess(`Removed investment for ${userEmail}`);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove investment');
    }
  };

  const handleStatusChange = async (newStatus: IPO['status']) => {
    try {
      await updateIPOStatus(ipoId, newStatus);
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
      setError('Please enter a valid net profit or loss amount.');
      return;
    }

    if (investments.length === 0) {
      setError('Cannot resolve an IPO with no investors.');
      return;
    }

    setSubmitting(true);
    try {
      await resolveIPO(ipoId, profit);
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
            {/* Status Change Dropdown */}
            {ipo.status !== 'SOLD' && (
              <select
                value={ipo.status}
                onChange={(e) => handleStatusChange(e.target.value as IPO['status'])}
                className="input-field py-2 text-xs font-semibold bg-white/[0.05]"
                id="status-change-select"
              >
                <option value="OPEN">Mark as OPEN</option>
                <option value="APPLIED">Mark as APPLIED</option>
                <option value="ALLOTTED">Mark as ALLOTTED</option>
              </select>
            )}

            {/* Resolve Modal Trigger */}
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
          <StatCard
            label="Total Funds Collected"
            value={formatCurrency(runningTotal)}
            icon={<MoneyIcon />}
            glowColor="emerald"
            subtext="Sum of all allocated user capital"
          />
        </div>
        <div className="animate-fadeIn stagger-2 opacity-0">
          <StatCard
            label="Total Investors"
            value={`${investments.length}`}
            icon={<UsersIcon />}
            glowColor="blue"
            subtext="Participating members in this deal"
          />
        </div>
        <div className="animate-fadeIn stagger-3 opacity-0">
          <StatCard
            label="Net Deal Profit"
            value={
              ipo.status === 'SOLD'
                ? `${ipo.netProfit >= 0 ? '+' : ''}${formatCurrency(ipo.netProfit)}`
                : 'Pending Sale'
            }
            icon={<TrophyIcon />}
            glowColor={ipo.status === 'SOLD' && ipo.netProfit >= 0 ? 'emerald' : 'rose'}
            subtext={ipo.status === 'SOLD' ? 'Proportionally distributed' : 'Awaiting resolution'}
          />
        </div>
      </div>

      {/* Capital Allocation Section */}
      <div className="glass-card-static overflow-hidden mb-8 animate-fadeIn stagger-4 opacity-0">
        <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Investor Allocations</h2>
            <p className="text-xs text-slate-500 mt-1">Capital contributions for {ipo.name}</p>
          </div>
          {ipo.status !== 'SOLD' && (
            <button
              onClick={() => {
                setShowAddModal(true);
                setError('');
              }}
              className="btn-primary text-xs px-4 py-2"
              id="add-investor-btn"
            >
              + Add Investor
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          {investments.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-3xl mb-3">👥</div>
              <p className="text-slate-500 text-sm">No investors allocated to this IPO yet.</p>
              <p className="text-slate-600 text-xs mt-1">Click &quot;+ Add Investor&quot; to select users and enter their investment amounts.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Investor</th>
                  <th>Email</th>
                  <th>Invested Amount</th>
                  <th>Contribution Share</th>
                  {ipo.status === 'SOLD' && <th>Profit Earned</th>}
                  {ipo.status !== 'SOLD' && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {investments.map((inv) => {
                  const sharePct = runningTotal > 0 ? (inv.investedAmount / runningTotal) * 100 : 0;
                  return (
                    <tr key={inv.id}>
                      <td className="text-white font-semibold">{inv.userDisplayName}</td>
                      <td className="text-xs text-slate-400">{inv.userEmail}</td>
                      <td className="text-emerald-400 font-medium">{formatCurrency(inv.investedAmount)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden max-w-[80px]">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                              style={{ width: `${Math.min(sharePct, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400">{sharePct.toFixed(1)}%</span>
                        </div>
                      </td>
                      {ipo.status === 'SOLD' && (
                        <td className={`font-semibold ${inv.profitEarned >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {inv.profitEarned >= 0 ? '+' : ''}
                          {formatCurrency(inv.profitEarned)}
                        </td>
                      )}
                      {ipo.status !== 'SOLD' && (
                        <td>
                          <button
                            onClick={() => handleRemoveInvestor(inv.id, inv.userEmail, inv.investedAmount)}
                            className="text-xs px-2.5 py-1 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
                          >
                            Remove
                          </button>
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

      {/* Modal: Add Investor */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={`Add Investor to ${ipo.name}`}>
        <form onSubmit={handleAddInvestor} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Select User (by Email)
            </label>
            <select
              value={selectedUid}
              onChange={(e) => setSelectedUid(e.target.value)}
              className="input-field bg-white/[0.05]"
              id="select-user-dropdown"
              required
            >
              <option value="">-- Choose User --</option>
              {users.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.displayName} ({u.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Invested Amount (₹)
            </label>
            <input
              type="number"
              className="input-field"
              placeholder="e.g. 50000"
              value={investedAmount}
              onChange={(e) => setInvestedAmount(e.target.value)}
              id="invested-amount-input"
              min="1"
              required
            />
          </div>

          {error && <p className="text-rose-400 text-xs">⚠️ {error}</p>}

          <div className="flex gap-3 pt-3">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex-1 py-2.5"
              id="save-investor-btn"
            >
              {submitting ? 'Allocating...' : 'Confirm Allocation'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="btn-secondary py-2.5"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Resolve IPO */}
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
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Total Net Profit / Loss (₹)
            </label>
            <input
              type="number"
              step="0.01"
              className="input-field"
              placeholder="e.g. 25000 or -5000"
              value={netProfitInput}
              onChange={(e) => setNetProfitInput(e.target.value)}
              id="net-profit-input"
              required
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Enter positive value for profit, negative for loss. This will automatically update `profitEarned` for all investors based on their contribution share.
            </p>
          </div>

          {error && <p className="text-rose-400 text-xs">⚠️ {error}</p>}

          <div className="flex gap-3 pt-3">
            <button
              type="submit"
              disabled={submitting}
              className="btn-amber flex-1 py-2.5"
              id="confirm-resolve-btn"
            >
              {submitting ? 'Resolving...' : 'Confirm Resolution'}
            </button>
            <button
              type="button"
              onClick={() => setShowResolveModal(false)}
              className="btn-secondary py-2.5"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useIPOs, createIPO, deleteIPO, useAllUsers } from '@/lib/firestore';
import { formatCurrency } from '@/lib/helpers';
import Modal from '@/components/Modal';
import LoadingSpinner from '@/components/LoadingSpinner';
import ActivityLogModal from '@/components/ActivityLogModal';
import UserManagementModal from '@/components/UserManagementModal';

interface ScrapedIPO {
  name: string;
  issuePrice: number;
  lotSize: number;
  openDate: string;
  closeDate: string;
}

export default function AdminPage() {
  const { user, userData, loading: authLoading } = useAuth();
  const router = useRouter();
  const { ipos, loading: iposLoading } = useIPOs();

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [lotSize, setLotSize] = useState('');
  const [issuePrice, setIssuePrice] = useState('');
  const [openDate, setOpenDate] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch Live IPOs Modal
  const [showFetchModal, setShowFetchModal] = useState(false);
  const [fetchedIPOs, setFetchedIPOs] = useState<ScrapedIPO[]>([]);
  const [fetchSource, setFetchSource] = useState('');
  const [fetchWarning, setFetchWarning] = useState('');
  const [fetching, setFetching] = useState(false);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  // Activity Log & User Management Modals
  const [showLogModal, setShowLogModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const { users } = useAllUsers();
  const pendingCount = users.filter((u) => u.status === 'PENDING').length;

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (!authLoading && userData && !userData.isAdmin) router.push('/dashboard');
  }, [user, userData, authLoading, router]);

  if (authLoading || iposLoading) return <LoadingSpinner />;
  if (!user || !userData || !userData.isAdmin) return null;

  const adminInfo = { email: userData.email, name: userData.displayName };

  // ─── Create IPO ───────────────────────────────────────────────────

  const handleCreateIPO = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !lotSize || !issuePrice || !openDate || !closeDate) {
      setError('Please fill in all fields.');
      return;
    }

    setSubmitting(true);
    try {
      await createIPO(
        {
          name: name.trim(),
          lotSize: parseInt(lotSize, 10),
          issuePrice: parseFloat(issuePrice),
          openDate,
          closeDate,
        },
        adminInfo
      );

      setSuccess(`Created IPO "${name.trim()}" successfully!`);
      setShowCreateModal(false);
      setName('');
      setLotSize('');
      setIssuePrice('');
      setOpenDate('');
      setCloseDate('');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create IPO');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Delete IPO ───────────────────────────────────────────────────

  const handleDeleteIPO = async (ipoId: string, ipoName: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${ipoName}" and all its investor allocations?`)) return;
    try {
      await deleteIPO(ipoId, ipoName, adminInfo);
      setSuccess(`Deleted "${ipoName}" successfully.`);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete IPO');
    }
  };

  // ─── Fetch Live IPOs ──────────────────────────────────────────────

  const handleFetchLiveIPOs = async () => {
    setFetching(true);
    setFetchedIPOs([]);
    setFetchSource('');
    setFetchWarning('');
    setError('');

    try {
      const res = await fetch('/api/fetch-ipos');
      const data = await res.json();

      if (data.success && data.ipos) {
        setFetchedIPOs(data.ipos);
        setFetchSource(data.source || '');
        setFetchWarning(data.warning || '');
      } else {
        setError('No IPO data returned from the scraper.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch live IPOs.');
    } finally {
      setFetching(false);
    }
  };

  const handleSaveScrapedIPO = async (ipo: ScrapedIPO, index: number) => {
    setSavingIndex(index);
    try {
      await createIPO(
        {
          name: ipo.name,
          lotSize: ipo.lotSize,
          issuePrice: ipo.issuePrice,
          openDate: ipo.openDate,
          closeDate: ipo.closeDate,
        },
        adminInfo
      );
      setFetchedIPOs((prev) => prev.filter((_, i) => i !== index));
      setSuccess(`Saved "${ipo.name}" to database!`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save IPO');
    } finally {
      setSavingIndex(null);
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
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8 animate-fadeIn">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Admin Panel — IPO Management ⚡</h1>
          <p className="text-sm text-slate-500">Create, fetch, manage, and delete IPO syndication deals.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowUserModal(true)}
            className="btn-amber flex items-center gap-2 relative"
            id="admin-user-access-btn"
          >
            👥 User Requests
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-gray-900">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowLogModal(true)}
            className="btn-secondary flex items-center gap-2"
            id="admin-view-logs-btn"
          >
            📋 Action Logs
          </button>
          <button
            onClick={() => {
              setShowFetchModal(true);
              handleFetchLiveIPOs();
            }}
            className="btn-blue flex items-center gap-2"
            id="fetch-live-ipos-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              <polyline points="21 3 21 12 12 12" />
            </svg>
            Fetch Live IPOs
          </button>
          <button
            onClick={() => {
              setShowCreateModal(true);
              setError('');
            }}
            className="btn-primary flex items-center gap-2"
            id="create-ipo-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New IPO Entry
          </button>
        </div>
      </div>

      {success && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm animate-fadeIn">
          ✅ {success}
        </div>
      )}

      {error && !showCreateModal && !showFetchModal && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm animate-fadeIn">
          ⚠️ {error}
        </div>
      )}

      {/* IPO Table */}
      <div className="glass-card-static overflow-hidden animate-fadeIn">
        <div className="p-6 border-b border-white/[0.06]">
          <h2 className="text-lg font-semibold text-white">All IPO Syndication Deals</h2>
          <p className="text-xs text-slate-500 mt-1">Select a deal to allocate capital or resolve profit</p>
        </div>

        <div className="overflow-x-auto">
          {ipos.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-3xl mb-3">🏢</div>
              <p className="text-slate-500 text-sm">No IPO entries created yet.</p>
              <p className="text-slate-600 text-xs mt-1">Click &quot;New IPO Entry&quot; or &quot;Fetch Live IPOs&quot; above to get started.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>IPO Name</th>
                  <th>Issue Price</th>
                  <th>Lot Size</th>
                  <th>Dates</th>
                  <th>Status</th>
                  <th>Total Invested</th>
                  <th>Net Profit/Loss</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ipos.map((ipo) => (
                  <tr key={ipo.id}>
                    <td className="text-white font-semibold">{ipo.name}</td>
                    <td>{formatCurrency(ipo.issuePrice)}</td>
                    <td>{ipo.lotSize} shares</td>
                    <td className="text-xs text-slate-400">
                      {ipo.openDate} → {ipo.closeDate}
                    </td>
                    <td>{getStatusBadge(ipo.status)}</td>
                    <td className="text-emerald-400 font-medium">
                      {formatCurrency(ipo.totalInvested || 0)}
                    </td>
                    <td>
                      {ipo.status === 'SOLD' ? (
                        <span className={ipo.netProfit >= 0 ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                          {ipo.netProfit >= 0 ? '+' : ''}{formatCurrency(ipo.netProfit)}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">—</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/detail?id=${ipo.id}`}
                          className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1"
                          id={`manage-ipo-${ipo.id}`}
                        >
                          Manage →
                        </Link>
                        <button
                          onClick={() => handleDeleteIPO(ipo.id, ipo.name)}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors border border-rose-500/20"
                          id={`delete-ipo-${ipo.id}`}
                          title="Delete this IPO"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ═══════ Create IPO Modal ═══════ */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New IPO Entry">
        <form onSubmit={handleCreateIPO} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              IPO Name
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Swiggy Ltd"
              value={name}
              onChange={(e) => setName(e.target.value)}
              id="ipo-name-input"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Issue Price (₹)
              </label>
              <input
                type="number"
                step="0.01"
                className="input-field"
                placeholder="390"
                value={issuePrice}
                onChange={(e) => setIssuePrice(e.target.value)}
                id="ipo-issue-price-input"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Lot Size
              </label>
              <input
                type="number"
                className="input-field"
                placeholder="38"
                value={lotSize}
                onChange={(e) => setLotSize(e.target.value)}
                id="ipo-lot-size-input"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Open Date
              </label>
              <input
                type="date"
                className="input-field"
                value={openDate}
                onChange={(e) => setOpenDate(e.target.value)}
                id="ipo-open-date-input"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Close Date
              </label>
              <input
                type="date"
                className="input-field"
                value={closeDate}
                onChange={(e) => setCloseDate(e.target.value)}
                id="ipo-close-date-input"
                required
              />
            </div>
          </div>

          {error && <p className="text-rose-400 text-xs mt-2">⚠️ {error}</p>}

          <div className="flex gap-3 pt-3">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex-1 py-2.5"
              id="save-ipo-btn"
            >
              {submitting ? 'Creating...' : 'Create IPO'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="btn-secondary py-2.5"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* ═══════ Fetch Live IPOs Modal ═══════ */}
      <Modal
        isOpen={showFetchModal}
        onClose={() => {
          setShowFetchModal(false);
          setFetchedIPOs([]);
          setFetchWarning('');
          setFetchSource('');
        }}
        title="Fetch Live IPOs from Web"
      >
        <div className="space-y-4">
          {fetching ? (
            <div className="flex flex-col items-center py-8">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm text-slate-400">Scraping live IPO data...</p>
              <p className="text-[10px] text-slate-600 mt-1">Fetching from Chittorgarh IPO Tracker</p>
            </div>
          ) : fetchedIPOs.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-slate-500 text-sm">No live IPOs found.</p>
              <button onClick={handleFetchLiveIPOs} className="btn-secondary text-xs mt-3 px-4 py-2">
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs">
                <p className="text-blue-400 font-medium">
                  📡 Source: {fetchSource} — {fetchedIPOs.length} IPO(s) found
                </p>
                {fetchWarning && (
                  <p className="text-amber-400 mt-1">⚠️ {fetchWarning}</p>
                )}
              </div>

              <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-1">
                {fetchedIPOs.map((ipo, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-white truncate">{ipo.name}</h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[11px] text-slate-400">
                          <span>💰 Price: ₹{ipo.issuePrice}</span>
                          <span>📦 Lot: {ipo.lotSize}</span>
                          <span>📅 {ipo.openDate} → {ipo.closeDate}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSaveScrapedIPO(ipo, idx)}
                        disabled={savingIndex === idx}
                        className="btn-primary text-xs px-3 py-1.5 whitespace-nowrap"
                        id={`save-scraped-ipo-${idx}`}
                      >
                        {savingIndex === idx ? 'Saving...' : '💾 Save'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ═══════ Activity Log Modal ═══════ */}
      <ActivityLogModal isOpen={showLogModal} onClose={() => setShowLogModal(false)} />

      {/* ═══════ User Management Modal ═══════ */}
      <UserManagementModal isOpen={showUserModal} onClose={() => setShowUserModal(false)} />
    </div>
  );
}

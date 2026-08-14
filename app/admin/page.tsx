'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useIPOs, createIPO } from '@/lib/firestore';
import { formatCurrency } from '@/lib/helpers';
import Modal from '@/components/Modal';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function AdminPage() {
  const { user, userData, loading: authLoading } = useAuth();
  const router = useRouter();
  const { ipos, loading: iposLoading } = useIPOs();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [lotSize, setLotSize] = useState('');
  const [issuePrice, setIssuePrice] = useState('');
  const [openDate, setOpenDate] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (!authLoading && userData && !userData.isAdmin) router.push('/dashboard');
  }, [user, userData, authLoading, router]);

  if (authLoading || iposLoading) return <LoadingSpinner />;
  if (!user || !userData || !userData.isAdmin) return null;

  const handleCreateIPO = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !lotSize || !issuePrice || !openDate || !closeDate) {
      setError('Please fill in all fields.');
      return;
    }

    setSubmitting(true);
    try {
      await createIPO({
        name: name.trim(),
        lotSize: parseInt(lotSize, 10),
        issuePrice: parseFloat(issuePrice),
        openDate,
        closeDate,
      });

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
      <div className="flex items-start justify-between mb-8 animate-fadeIn">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Admin Panel — IPO Management ⚡</h1>
          <p className="text-sm text-slate-500">Create new IPO syndication deals and allocate capital.</p>
        </div>
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

      {success && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm animate-fadeIn">
          ✅ {success}
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
              <p className="text-slate-600 text-xs mt-1">Click &quot;New IPO Entry&quot; above to create one.</p>
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
                  <th>Action</th>
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
                      <Link
                        href={`/admin/detail?id=${ipo.id}`}
                        className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1"
                        id={`manage-ipo-${ipo.id}`}
                      >
                        Manage & Allocate →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create IPO Modal */}
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
    </div>
  );
}

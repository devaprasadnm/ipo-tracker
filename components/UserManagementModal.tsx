'use client';

import React, { useState } from 'react';
import Modal from '@/components/Modal';
import {
  useAllUsers,
  approveUserAccess,
  rejectUserAccess,
  revokeUserAccess,
  toggleAdminRole,
  deleteUserAccount,
  UserInfo,
} from '@/lib/firestore';
import { useAuth } from '@/lib/auth-context';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserManagementModal({ isOpen, onClose }: UserManagementModalProps) {
  const { userData } = useAuth();
  const { users, loading } = useAllUsers();
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'ACTIVE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [processingUid, setProcessingUid] = useState<string | null>(null);

  if (!userData) return null;
  const adminInfo = { email: userData.email, name: userData.displayName };

  // Filter users
  const pendingUsers = users.filter((u) => u.status === 'PENDING' || u.status === 'REJECTED');
  const activeUsers = users.filter((u) => u.status === 'APPROVED' || !u.status);

  // Filter by tab & search query
  const displayUsers = (
    activeTab === 'PENDING'
      ? pendingUsers
      : activeTab === 'ACTIVE'
      ? activeUsers
      : users
  ).filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.displayName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.uid?.toLowerCase().includes(q)
    );
  });

  const handleApprove = async (user: UserInfo) => {
    setProcessingUid(user.uid);
    try {
      await approveUserAccess(user.uid, user.email, user.displayName, adminInfo);
    } catch (err) {
      console.error('Approve failed:', err);
    } finally {
      setProcessingUid(null);
    }
  };

  const handleReject = async (user: UserInfo) => {
    if (!confirm(`Reject access for ${user.displayName} (${user.email})?`)) return;
    setProcessingUid(user.uid);
    try {
      await rejectUserAccess(user.uid, user.email, user.displayName, adminInfo);
    } catch (err) {
      console.error('Reject failed:', err);
    } finally {
      setProcessingUid(null);
    }
  };

  const handleRevoke = async (user: UserInfo) => {
    if (user.uid === userData.uid) {
      alert('You cannot revoke your own account access.');
      return;
    }
    if (!confirm(`Revoke dashboard access for ${user.displayName}? They will be set back to Pending.`)) return;
    setProcessingUid(user.uid);
    try {
      await revokeUserAccess(user.uid, user.email, user.displayName, adminInfo);
    } catch (err) {
      console.error('Revoke failed:', err);
    } finally {
      setProcessingUid(null);
    }
  };

  const handleToggleAdmin = async (user: UserInfo) => {
    if (user.uid === userData.uid) {
      alert('You cannot change your own admin privileges.');
      return;
    }
    const actionName = user.isAdmin ? 'remove Admin rights from' : 'make Admin';
    if (!confirm(`Are you sure you want to ${actionName} ${user.displayName}?`)) return;
    setProcessingUid(user.uid);
    try {
      await toggleAdminRole(user.uid, user.email, user.displayName, user.isAdmin, adminInfo);
    } catch (err) {
      console.error('Toggle admin failed:', err);
    } finally {
      setProcessingUid(null);
    }
  };

  const handleDeleteUser = async (user: UserInfo) => {
    if (user.uid === userData.uid) {
      alert('You cannot delete your own logged-in admin account.');
      return;
    }
    if (!confirm(`⚠️ PERMANENT DELETE: Are you sure you want to completely delete user "${user.displayName}" (${user.email})?`)) return;
    setProcessingUid(user.uid);
    try {
      await deleteUserAccount(user.uid, user.email, user.displayName, adminInfo);
    } catch (err) {
      console.error('Delete user failed:', err);
    } finally {
      setProcessingUid(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="👥 User Management & Access Portal">
      <div className="space-y-4">
        {/* Search Bar & Tabs Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'ALL' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white bg-white/[0.03]'
              }`}
            >
              All Users ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('ACTIVE')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'ACTIVE' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white bg-white/[0.03]'
              }`}
            >
              Active ({activeUsers.length})
            </button>
            <button
              onClick={() => setActiveTab('PENDING')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all relative ${
                activeTab === 'PENDING' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white bg-white/[0.03]'
              }`}
            >
              Pending ({pendingUsers.length})
            </button>
          </div>

          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field py-1.5 px-3 text-xs w-full sm:w-48 bg-white/[0.05]"
          />
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-400 text-xs">Loading all users from database...</div>
        ) : displayUsers.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No users match the criteria.
          </div>
        ) : (
          <div className="max-h-[55vh] overflow-y-auto space-y-2.5 pr-1">
            {displayUsers.map((u) => {
              const isPending = u.status === 'PENDING' || u.status === 'REJECTED';
              const isUserApproved = u.status === 'APPROVED' || (!u.status && !isPending);

              return (
                <div
                  key={u.uid}
                  className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-colors flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white truncate">{u.displayName || 'User'}</span>
                      {u.isAdmin && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/30">
                          ⭐ Admin
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                          u.status === 'REJECTED'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : u.status === 'PENDING'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {u.status || 'APPROVED'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">{u.email}</div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Approve / Deny for Pending */}
                    {isPending && (
                      <button
                        onClick={() => handleApprove(u)}
                        disabled={processingUid === u.uid}
                        className="btn-primary text-xs px-2.5 py-1.5 whitespace-nowrap"
                      >
                        ✅ Approve
                      </button>
                    )}

                    {/* Admin Toggle */}
                    <button
                      onClick={() => handleToggleAdmin(u)}
                      disabled={processingUid === u.uid || u.uid === userData.uid}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 transition-colors border border-purple-500/20"
                      title={u.isAdmin ? 'Remove Admin rights' : 'Promote to Admin'}
                    >
                      {u.isAdmin ? 'Remove Admin' : '⭐ Admin'}
                    </button>

                    {/* Revoke Access */}
                    {isUserApproved && (
                      <button
                        onClick={() => handleRevoke(u)}
                        disabled={processingUid === u.uid || u.uid === userData.uid}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors border border-amber-500/20"
                        title="Revoke access"
                      >
                        🚫 Revoke
                      </button>
                    )}

                    {/* Delete User Document */}
                    <button
                      onClick={() => handleDeleteUser(u)}
                      disabled={processingUid === u.uid || u.uid === userData.uid}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors border border-rose-500/20 flex items-center gap-1"
                      title="Permanently delete user from database"
                    >
                      🗑 Delete User
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}

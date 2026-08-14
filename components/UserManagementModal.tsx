'use client';

import React, { useState } from 'react';
import Modal from '@/components/Modal';
import {
  useAllUsers,
  approveUserAccess,
  rejectUserAccess,
  revokeUserAccess,
  toggleAdminRole,
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
  const [activeTab, setActiveTab] = useState<'PENDING' | 'ACTIVE'>('PENDING');

  const [processingUid, setProcessingUid] = useState<string | null>(null);

  if (!userData) return null;
  const adminInfo = { email: userData.email, name: userData.displayName };

  // Filter users by status
  const pendingUsers = users.filter((u) => u.status === 'PENDING' || u.status === 'REJECTED');
  const activeUsers = users.filter((u) => u.status === 'APPROVED' || (!u.status && u.isAdmin));

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="👥 User Access & Request Portal">
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex border-b border-white/[0.08] gap-4">
          <button
            onClick={() => setActiveTab('PENDING')}
            className={`pb-2.5 text-xs font-semibold relative transition-colors ${
              activeTab === 'PENDING' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            Pending Requests
            {pendingUsers.length > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {pendingUsers.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('ACTIVE')}
            className={`pb-2.5 text-xs font-semibold relative transition-colors ${
              activeTab === 'ACTIVE' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            Active Members ({activeUsers.length})
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-400 text-xs">Loading user list...</div>
        ) : activeTab === 'PENDING' ? (
          /* PENDING REQUESTS TAB */
          <div className="space-y-3">
            {pendingUsers.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No pending access requests. All members are approved!
              </div>
            ) : (
              <div className="max-h-[50vh] overflow-y-auto space-y-2.5 pr-1">
                {pendingUsers.map((u) => (
                  <div
                    key={u.uid}
                    className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-colors flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white truncate">{u.displayName}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                            u.status === 'REJECTED'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {u.status || 'PENDING'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">{u.email}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprove(u)}
                        disabled={processingUid === u.uid}
                        className="btn-primary text-xs px-3 py-1.5 whitespace-nowrap"
                        id={`approve-user-${u.uid}`}
                      >
                        {processingUid === u.uid ? 'Approving...' : '✅ Approve'}
                      </button>
                      <button
                        onClick={() => handleReject(u)}
                        disabled={processingUid === u.uid}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors border border-rose-500/20"
                        id={`reject-user-${u.uid}`}
                        title="Reject request"
                      >
                        ❌ Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ACTIVE MEMBERS TAB */
          <div className="space-y-3">
            {activeUsers.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">No active members found.</div>
            ) : (
              <div className="max-h-[50vh] overflow-y-auto space-y-2.5 pr-1">
                {activeUsers.map((u) => (
                  <div
                    key={u.uid}
                    className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-colors flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white truncate">{u.displayName}</span>
                        {u.isAdmin && (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/30">
                            ⭐ Admin
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">{u.email}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleAdmin(u)}
                        disabled={processingUid === u.uid || u.uid === userData.uid}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 transition-colors border border-purple-500/20"
                        title={u.isAdmin ? 'Remove Admin rights' : 'Promote to Admin'}
                      >
                        {u.isAdmin ? 'Remove Admin' : '⭐ Make Admin'}
                      </button>
                      <button
                        onClick={() => handleRevoke(u)}
                        disabled={processingUid === u.uid || u.uid === userData.uid}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors border border-amber-500/20"
                        title="Revoke access"
                      >
                        🚫 Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

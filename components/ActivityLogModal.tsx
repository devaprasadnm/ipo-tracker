'use client';

import React from 'react';
import Modal from '@/components/Modal';
import { useActivityLogs, ActivityLog } from '@/lib/firestore';

interface ActivityLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const actionTypeBadges: Record<ActivityLog['actionType'], { label: string; badgeClass: string }> = {
  CREATE_IPO: { label: 'NEW IPO', badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  ALLOCATE_FUNDS: { label: 'ALLOCATE', badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  UPDATE_INVESTMENT: { label: 'EDIT', badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' },
  UPDATE_STATUS: { label: 'STATUS', badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  RESOLVE_PROFIT: { label: 'RESOLVED', badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  DELETE_IPO: { label: 'DELETE', badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
};

export default function ActivityLogModal({ isOpen, onClose }: ActivityLogModalProps) {
  const { logs, loading } = useActivityLogs();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📋 Admin Activity & Audit Logs">
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          Real-time audit log of all management actions performed by Admins.
        </p>

        {loading ? (
          <div className="py-8 text-center text-slate-400 text-xs">Loading activity logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">No admin actions recorded yet.</div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
            {logs.map((log) => {
              const badgeConf = actionTypeBadges[log.actionType] || {
                label: log.actionType,
                badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
              };

              const formattedDate = log.createdAt
                ? new Date((log.createdAt as { seconds: number }).seconds * 1000).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : 'Just now';

              return (
                <div
                  key={log.id}
                  className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-colors text-xs"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${badgeConf.badgeClass}`}
                    >
                      {badgeConf.label}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">{formattedDate}</span>
                  </div>

                  <p className="text-slate-200 font-medium leading-relaxed">{log.description}</p>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.04] text-[10px] text-slate-400">
                    <span>
                      By: <strong className="text-white font-semibold">{log.adminName || 'Admin'}</strong> ({log.adminEmail})
                    </span>
                    <span className="text-slate-500">Deal: {log.targetIpoName}</span>
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

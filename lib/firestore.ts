'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  getDocs,
  writeBatch,
  serverTimestamp,
  Timestamp,
  increment,
  limit,
} from 'firebase/firestore';
import { getDbInstance } from './firebase';

// ─── Types ──────────────────────────────────────────────────────────────────────

export type InvestmentCategory = 'RETAIL' | 'HNI' | 'sHNI' | 'bHNI' | 'SME';

export interface IPO {
  id: string;
  name: string;
  sharesPerLot: number;
  numberOfLots: number;
  lotSize: number; // kept for backward compatibility (sharesPerLot)
  issuePrice: number;
  openDate: string;
  closeDate: string;
  status: 'OPEN' | 'APPLIED' | 'ALLOTTED' | 'SOLD';
  totalInvested: number;
  netProfit: number;
  createdAt: Timestamp;
}

export interface IPOApplication {
  id: string;
  ipoId: string;
  uid: string;
  userEmail: string;
  userDisplayName: string;
  category: InvestmentCategory;
  lotsApplied: number;
  amount: number;
  allotmentStatus: 'APPLIED' | 'ALLOTTED' | 'NOT_ALLOTTED';
}

export interface IPOInvestment {
  id: string;
  ipoId: string;
  uid: string;
  userEmail: string;
  userDisplayName: string;
  investedAmount: number;
  profitEarned: number;
  category?: InvestmentCategory;
  lotsApplied?: number;
  allotmentStatus: 'CONTRIBUTOR' | 'APPLIED' | 'ALLOTTED' | 'NOT_ALLOTTED';
}

export interface UserInfo {
  uid: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt?: Timestamp;
}

export interface ActivityLog {
  id: string;
  adminEmail: string;
  adminName: string;
  actionType: 'CREATE_IPO' | 'ALLOCATE_FUNDS' | 'UPDATE_INVESTMENT' | 'UPDATE_STATUS' | 'RESOLVE_PROFIT' | 'DELETE_IPO';
  description: string;
  targetIpoName: string;
  createdAt: Timestamp;
}

// ─── Activity Log Helper ────────────────────────────────────────────────────────

/**
 * Log an Admin action into the `activity_logs` collection.
 */
export async function logAdminAction(
  adminEmail: string,
  adminName: string,
  actionType: ActivityLog['actionType'],
  description: string,
  targetIpoName: string
) {
  try {
    const db = getDbInstance();
    await addDoc(collection(db, 'activity_logs'), {
      adminEmail: adminEmail || 'Admin',
      adminName: adminName || 'Admin',
      actionType,
      description,
      targetIpoName,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Failed to log admin action:', err);
  }
}

/**
 * Subscribe to recent activity logs (top 50, newest first).
 */
export function useActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') { setLoading(false); return; }
    const db = getDbInstance();
    const q = query(collection(db, 'activity_logs'), orderBy('createdAt', 'desc'), limit(50));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog)));
        setLoading(false);
      },
      (err) => {
        console.error('Activity logs error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { logs, loading };
}

// ─── Real-time Hooks ────────────────────────────────────────────────────────────

/**
 * Subscribe to all IPOs in real-time, ordered by creation date (newest first).
 */
export function useIPOs() {
  const [ipos, setIPOs] = useState<IPO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') { setLoading(false); return; }
    const db = getDbInstance();
    const q = query(collection(db, 'ipos'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snap) => {
      setIPOs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as IPO)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { ipos, loading };
}

/**
 * Subscribe to a single IPO by ID.
 */
export function useIPO(ipoId: string) {
  const [ipo, setIPO] = useState<IPO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined' || !ipoId) { setLoading(false); return; }
    const db = getDbInstance();
    const ref = doc(db, 'ipos', ipoId);

    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setIPO({ id: snap.id, ...snap.data() } as IPO);
      } else {
        setIPO(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [ipoId]);

  return { ipo, loading };
}

/**
 * Subscribe to investments for a specific IPO.
 */
export function useIPOInvestments(ipoId: string) {
  const [investments, setInvestments] = useState<IPOInvestment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined' || !ipoId) { setLoading(false); return; }
    const db = getDbInstance();
    const q = query(collection(db, 'ipo_investments'), where('ipoId', '==', ipoId));

    const unsubscribe = onSnapshot(q, (snap) => {
      setInvestments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as IPOInvestment)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [ipoId]);

  return { investments, loading };
}

/**
 * Subscribe to demat applications for a specific IPO.
 * Also synthesizes applications from ipo_investments if ipo_applications is empty.
 */
export function useIPOApplications(ipoId: string) {
  const [applications, setApplications] = useState<IPOApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined' || !ipoId) { setLoading(false); return; }
    const db = getDbInstance();
    const qApp = query(collection(db, 'ipo_applications'), where('ipoId', '==', ipoId));

    const unsubscribeApps = onSnapshot(qApp, (appSnap) => {
      if (!appSnap.empty) {
        setApplications(appSnap.docs.map((d) => ({ id: d.id, ...d.data() } as IPOApplication)));
        setLoading(false);
      } else {
        // Fallback: Check ipo_investments for category/lotsApplied
        const qInv = query(collection(db, 'ipo_investments'), where('ipoId', '==', ipoId));
        getDocs(qInv).then((invSnap) => {
          const fallbackApps: IPOApplication[] = invSnap.docs
            .map((d) => {
              const data = d.data() as IPOInvestment;
              if (data.category && data.lotsApplied) {
                return {
                  id: d.id,
                  ipoId: data.ipoId,
                  uid: data.uid,
                  userEmail: data.userEmail,
                  userDisplayName: data.userDisplayName,
                  category: data.category,
                  lotsApplied: data.lotsApplied,
                  amount: data.investedAmount,
                  allotmentStatus: data.allotmentStatus === 'CONTRIBUTOR' ? 'APPLIED' : (data.allotmentStatus || 'APPLIED'),
                };
              }
              return null;
            })
            .filter((a): a is IPOApplication => a !== null);
          setApplications(fallbackApps);
          setLoading(false);
        });
      }
    });

    return () => unsubscribeApps();
  }, [ipoId]);

  return { applications, loading };
}

/**
 * Create a new IPO entry. Admin only.
 */
export async function createIPO(
  data: {
    name: string;
    sharesPerLot?: number;
    numberOfLots?: number;
    lotSize?: number;
    issuePrice: number;
    openDate: string;
    closeDate: string;
  },
  adminInfo?: { email: string; name: string }
) {
  const db = getDbInstance();
  const sharesPerLot = data.sharesPerLot || data.lotSize || 1;
  const numberOfLots = data.numberOfLots || 1;
  const lotSize = sharesPerLot;

  const docRef = await addDoc(collection(db, 'ipos'), {
    ...data,
    sharesPerLot,
    numberOfLots,
    lotSize,
    status: 'OPEN',
    totalInvested: 0,
    netProfit: 0,
    createdAt: serverTimestamp(),
  });

  if (adminInfo) {
    await logAdminAction(
      adminInfo.email,
      adminInfo.name,
      'CREATE_IPO',
      `Created new IPO entry: ${data.name} (Price: ₹${data.issuePrice}, Shares/Lot: ${sharesPerLot}, Lots: ${numberOfLots})`,
      data.name
    );
  }

  return docRef.id;
}

/**
 * Add a Demat Application for an IPO.
 */
export async function addIPOApplication(
  ipoId: string,
  ipoName: string,
  uid: string,
  userEmail: string,
  userDisplayName: string,
  category: InvestmentCategory,
  lotsApplied: number,
  amount: number,
  allotmentStatus: 'APPLIED' | 'ALLOTTED' | 'NOT_ALLOTTED' = 'APPLIED',
  adminInfo?: { email: string; name: string }
) {
  const db = getDbInstance();
  const appRef = doc(collection(db, 'ipo_applications'));
  await addDoc(collection(db, 'ipo_applications'), {
    ipoId,
    uid,
    userEmail,
    userDisplayName,
    category,
    lotsApplied,
    amount,
    allotmentStatus,
    createdAt: serverTimestamp(),
  });

  if (adminInfo) {
    await logAdminAction(
      adminInfo.email,
      adminInfo.name,
      'ALLOCATE_FUNDS',
      `Logged Demat Application: ${userDisplayName} (${category}, ${lotsApplied} lot(s), ₹${amount.toLocaleString('en-IN')})`,
      ipoName
    );
  }
}

/**
 * Remove a Demat Application.
 */
export async function removeIPOApplication(
  applicationId: string,
  ipoName: string,
  userDisplayName: string,
  adminInfo?: { email: string; name: string }
) {
  const db = getDbInstance();
  await deleteDoc(doc(db, 'ipo_applications', applicationId));

  if (adminInfo) {
    await logAdminAction(
      adminInfo.email,
      adminInfo.name,
      'UPDATE_INVESTMENT',
      `Removed Demat Application for ${userDisplayName}`,
      ipoName
    );
  }
}
export function useUserInvestments(
  uid: string | undefined,
  userEmail?: string | undefined,
  displayName?: string | undefined
) {
  const [investments, setInvestments] = useState<IPOInvestment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined' || (!uid && !userEmail && !displayName)) {
      setLoading(false);
      return;
    }
    const db = getDbInstance();

    const unsubscribe = onSnapshot(
      collection(db, 'ipo_investments'),
      (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as IPOInvestment));
        const cleanUid = (uid || '').trim();
        const cleanEmail = (userEmail || '').trim().toLowerCase();
        const cleanName = (displayName || '').trim().toLowerCase();

        const filtered = all.filter((inv) => {
          const invUid = (inv.uid || '').trim();
          const invEmail = (inv.userEmail || '').trim().toLowerCase();
          const invName = (inv.userDisplayName || '').trim().toLowerCase();

          return (
            (cleanUid && invUid === cleanUid) ||
            (cleanEmail && invEmail === cleanEmail) ||
            (cleanName && invName && invName === cleanName)
          );
        });

        setInvestments(filtered);
        setLoading(false);
      },
      (err) => {
        console.error('[useUserInvestments Error]', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid, userEmail, displayName]);

  return { investments, loading };
}

/**
 * Subscribe to all registered users (for admin dropdown).
 */
export function useAllUsers() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') { setLoading(false); return; }
    const db = getDbInstance();

    const unsubscribe = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserInfo)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { users, loading };
}

// ─── Mutation Functions ─────────────────────────────────────────────────────────

/**
 * Update IPO status (OPEN → APPLIED → ALLOTTED).
 */
export async function updateIPOStatus(
  ipoId: string,
  ipoName: string,
  status: IPO['status'],
  adminInfo?: { email: string; name: string }
) {
  const db = getDbInstance();
  await updateDoc(doc(db, 'ipos', ipoId), { status });

  if (adminInfo) {
    await logAdminAction(
      adminInfo.email,
      adminInfo.name,
      'UPDATE_STATUS',
      `Changed status of ${ipoName} to ${status}`,
      ipoName
    );
  }
}

/**
 * Add an investment for a user to a specific IPO with category, lots, and allotment status.
 */
export async function addInvestment(
  ipoId: string,
  ipoName: string,
  uid: string,
  userEmail: string,
  userDisplayName: string,
  investedAmount: number,
  category?: InvestmentCategory,
  lotsApplied?: number,
  allotmentStatus: 'CONTRIBUTOR' | 'APPLIED' | 'ALLOTTED' | 'NOT_ALLOTTED' = 'CONTRIBUTOR',
  adminInfo?: { email: string; name: string }
) {
  const db = getDbInstance();
  const batch = writeBatch(db);

  const investmentRef = doc(collection(db, 'ipo_investments'));
  batch.set(investmentRef, {
    ipoId,
    uid,
    userEmail,
    userDisplayName,
    investedAmount,
    profitEarned: 0,
    ...(category ? { category } : {}),
    ...(lotsApplied !== undefined ? { lotsApplied } : {}),
    allotmentStatus,
  });

  const ipoRef = doc(db, 'ipos', ipoId);
  batch.update(ipoRef, {
    totalInvested: increment(investedAmount),
  });

  await batch.commit();

  if (adminInfo) {
    await logAdminAction(
      adminInfo.email,
      adminInfo.name,
      'ALLOCATE_FUNDS',
      `Allocated ₹${investedAmount.toLocaleString('en-IN')} (${category}, ${lotsApplied} lot(s)) for ${userDisplayName} (${userEmail})`,
      ipoName
    );
  }
}

/**
 * Remove an investment and update the IPO's totalInvested.
 */
export async function removeInvestment(
  investmentId: string,
  ipoId: string,
  ipoName: string,
  userDisplayName: string,
  investedAmount: number,
  adminInfo?: { email: string; name: string }
) {
  const db = getDbInstance();
  const batch = writeBatch(db);

  batch.delete(doc(db, 'ipo_investments', investmentId));
  batch.update(doc(db, 'ipos', ipoId), {
    totalInvested: increment(-investedAmount),
  });

  await batch.commit();

  if (adminInfo) {
    await logAdminAction(
      adminInfo.email,
      adminInfo.name,
      'UPDATE_INVESTMENT',
      `Removed ₹${investedAmount.toLocaleString('en-IN')} allocation for ${userDisplayName}`,
      ipoName
    );
  }
}

/**
 * Edit an existing investment amount, category, lots, and status.
 */
export async function updateInvestmentAmount(
  investmentId: string,
  ipoId: string,
  ipoName: string,
  userDisplayName: string,
  oldAmount: number,
  newAmount: number,
  category?: InvestmentCategory,
  lotsApplied?: number,
  allotmentStatus?: 'CONTRIBUTOR' | 'APPLIED' | 'ALLOTTED' | 'NOT_ALLOTTED',
  adminInfo?: { email: string; name: string }
) {
  const db = getDbInstance();
  const batch = writeBatch(db);

  const diff = newAmount - oldAmount;

  const updateFields: Record<string, unknown> = {
    investedAmount: newAmount,
  };
  if (category) updateFields.category = category;
  if (lotsApplied !== undefined) updateFields.lotsApplied = lotsApplied;
  if (allotmentStatus) updateFields.allotmentStatus = allotmentStatus;

  batch.update(doc(db, 'ipo_investments', investmentId), updateFields);
  batch.update(doc(db, 'ipos', ipoId), {
    totalInvested: increment(diff),
  });

  await batch.commit();

  if (adminInfo) {
    await logAdminAction(
      adminInfo.email,
      adminInfo.name,
      'UPDATE_INVESTMENT',
      `Updated ${userDisplayName}'s allocation from ₹${oldAmount.toLocaleString('en-IN')} to ₹${newAmount.toLocaleString('en-IN')}`,
      ipoName
    );
  }
}

/**
 * Delete an IPO and all its associated ipo_investments. Admin only.
 */
export async function deleteIPO(
  ipoId: string,
  ipoName: string,
  adminInfo?: { email: string; name: string }
) {
  const db = getDbInstance();

  const investmentsSnap = await getDocs(
    query(collection(db, 'ipo_investments'), where('ipoId', '==', ipoId))
  );

  const batch = writeBatch(db);

  investmentsSnap.docs.forEach((d) => {
    batch.delete(d.ref);
  });

  batch.delete(doc(db, 'ipos', ipoId));

  await batch.commit();

  if (adminInfo) {
    await logAdminAction(
      adminInfo.email,
      adminInfo.name,
      'DELETE_IPO',
      `Deleted IPO deal "${ipoName}" and removed all its allocations`,
      ipoName
    );
  }
}

/**
 * Resolve an IPO as SOLD and distribute profits proportionally.
 */
export async function resolveIPO(
  ipoId: string,
  ipoName: string,
  netProfit: number,
  adminInfo?: { email: string; name: string }
) {
  const db = getDbInstance();

  const investmentsSnap = await getDocs(
    query(collection(db, 'ipo_investments'), where('ipoId', '==', ipoId))
  );

  let totalInvested = 0;
  investmentsSnap.docs.forEach((d) => {
    totalInvested += d.data().investedAmount;
  });

  if (totalInvested === 0) {
    throw new Error('No investments found for this IPO');
  }

  const batch = writeBatch(db);

  investmentsSnap.docs.forEach((d) => {
    const data = d.data();
    const sharePercent = data.investedAmount / totalInvested;
    const profitEarned = Math.round(netProfit * sharePercent * 100) / 100;

    batch.update(doc(db, 'ipo_investments', d.id), {
      profitEarned,
      allotmentStatus: 'ALLOTTED',
    });
  });

  batch.update(doc(db, 'ipos', ipoId), {
    status: 'SOLD',
    netProfit,
  });

  await batch.commit();

  if (adminInfo) {
    await logAdminAction(
      adminInfo.email,
      adminInfo.name,
      'RESOLVE_PROFIT',
      `Marked ${ipoName} as SOLD and distributed ₹${netProfit.toLocaleString('en-IN')} profit/loss across ${investmentsSnap.docs.length} investor(s)`,
      ipoName
    );
  }
}

// ─── User Access Management Functions ──────────────────────────────────────────

/**
 * Approve a pending user's access request.
 */
export async function approveUserAccess(
  targetUid: string,
  targetEmail: string,
  targetName: string,
  adminInfo?: { email: string; name: string }
) {
  const db = getDbInstance();
  await updateDoc(doc(db, 'users', targetUid), {
    status: 'APPROVED',
  });

  if (adminInfo) {
    await logAdminAction(
      adminInfo.email,
      adminInfo.name,
      'UPDATE_STATUS',
      `Approved dashboard access for user ${targetName} (${targetEmail})`,
      'User Management'
    );
  }
}

/**
 * Reject a pending user's access request.
 */
export async function rejectUserAccess(
  targetUid: string,
  targetEmail: string,
  targetName: string,
  adminInfo?: { email: string; name: string }
) {
  const db = getDbInstance();
  await updateDoc(doc(db, 'users', targetUid), {
    status: 'REJECTED',
  });

  if (adminInfo) {
    await logAdminAction(
      adminInfo.email,
      adminInfo.name,
      'UPDATE_STATUS',
      `Rejected access request for user ${targetName} (${targetEmail})`,
      'User Management'
    );
  }
}

/**
 * Revoke an active user's access (sets status back to PENDING).
 */
export async function revokeUserAccess(
  targetUid: string,
  targetEmail: string,
  targetName: string,
  adminInfo?: { email: string; name: string }
) {
  const db = getDbInstance();
  await updateDoc(doc(db, 'users', targetUid), {
    status: 'PENDING',
  });

  if (adminInfo) {
    await logAdminAction(
      adminInfo.email,
      adminInfo.name,
      'UPDATE_STATUS',
      `Revoked dashboard access for ${targetName} (${targetEmail})`,
      'User Management'
    );
  }
}

/**
 * Toggle Admin role for a user.
 */
export async function toggleAdminRole(
  targetUid: string,
  targetEmail: string,
  targetName: string,
  currentIsAdmin: boolean,
  adminInfo?: { email: string; name: string }
) {
  const db = getDbInstance();
  const newAdminState = !currentIsAdmin;

  await updateDoc(doc(db, 'users', targetUid), {
    isAdmin: newAdminState,
    status: 'APPROVED', // Admins are always approved
  });

  if (adminInfo) {
    await logAdminAction(
      adminInfo.email,
      adminInfo.name,
      'UPDATE_STATUS',
      `${newAdminState ? 'Granted' : 'Revoked'} Admin privileges for ${targetName} (${targetEmail})`,
      'User Management'
    );
  }
}

/**
 * Permanently delete a user account document from Firestore.
 */
export async function deleteUserAccount(
  targetUid: string,
  targetEmail: string,
  targetName: string,
  adminInfo?: { email: string; name: string }
) {
  const db = getDbInstance();
  await deleteDoc(doc(db, 'users', targetUid));

  if (adminInfo) {
    await logAdminAction(
      adminInfo.email,
      adminInfo.name,
      'DELETE_IPO',
      `Permanently deleted user account for ${targetName} (${targetEmail})`,
      'User Management'
    );
  }
}

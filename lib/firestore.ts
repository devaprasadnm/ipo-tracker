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
} from 'firebase/firestore';
import { getDbInstance } from './firebase';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface IPO {
  id: string;
  name: string;
  lotSize: number;
  issuePrice: number;
  openDate: string;
  closeDate: string;
  status: 'OPEN' | 'APPLIED' | 'ALLOTTED' | 'SOLD';
  totalInvested: number;
  netProfit: number;
  createdAt: Timestamp;
}

export interface IPOInvestment {
  id: string;
  ipoId: string;
  uid: string;
  userEmail: string;
  userDisplayName: string;
  investedAmount: number;
  profitEarned: number;
}

export interface UserInfo {
  uid: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
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
 * Subscribe to all investments for a specific user (for user dashboard).
 */
export function useUserInvestments(uid: string | undefined) {
  const [investments, setInvestments] = useState<IPOInvestment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined' || !uid) { setLoading(false); return; }
    const db = getDbInstance();
    const q = query(collection(db, 'ipo_investments'), where('uid', '==', uid));

    const unsubscribe = onSnapshot(q, (snap) => {
      setInvestments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as IPOInvestment)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid]);

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
 * Create a new IPO entry. Admin only.
 */
export async function createIPO(data: {
  name: string;
  lotSize: number;
  issuePrice: number;
  openDate: string;
  closeDate: string;
}) {
  const db = getDbInstance();
  await addDoc(collection(db, 'ipos'), {
    ...data,
    status: 'OPEN',
    totalInvested: 0,
    netProfit: 0,
    createdAt: serverTimestamp(),
  });
}

/**
 * Update IPO status (OPEN → APPLIED → ALLOTTED).
 */
export async function updateIPOStatus(ipoId: string, status: IPO['status']) {
  const db = getDbInstance();
  await updateDoc(doc(db, 'ipos', ipoId), { status });
}

/**
 * Add an investment for a user to a specific IPO.
 * Updates the IPO's totalInvested using atomic increment.
 */
export async function addInvestment(
  ipoId: string,
  uid: string,
  userEmail: string,
  userDisplayName: string,
  investedAmount: number
) {
  const db = getDbInstance();
  const batch = writeBatch(db);

  // Create investment document
  const investmentRef = doc(collection(db, 'ipo_investments'));
  batch.set(investmentRef, {
    ipoId,
    uid,
    userEmail,
    userDisplayName,
    investedAmount,
    profitEarned: 0,
  });

  // Atomically increment totalInvested on the IPO
  const ipoRef = doc(db, 'ipos', ipoId);
  batch.update(ipoRef, {
    totalInvested: increment(investedAmount),
  });

  await batch.commit();
}

/**
 * Remove an investment and update the IPO's totalInvested.
 */
export async function removeInvestment(investmentId: string, ipoId: string, investedAmount: number) {
  const db = getDbInstance();
  const batch = writeBatch(db);

  // Delete the investment doc
  batch.delete(doc(db, 'ipo_investments', investmentId));

  // Decrement totalInvested on the IPO
  batch.update(doc(db, 'ipos', ipoId), {
    totalInvested: increment(-investedAmount),
  });

  await batch.commit();
}

/**
 * Resolve an IPO as SOLD.
 * 
 * CORE BUSINESS LOGIC:
 * 1. Admin enters the net profit/loss for the IPO.
 * 2. For each investor:
 *    - Share % = investedAmount / totalInvested
 *    - profitEarned = netProfit × Share %
 * 3. Updates all investment docs and sets IPO status to SOLD.
 */
export async function resolveIPO(ipoId: string, netProfit: number) {
  const db = getDbInstance();

  // Fetch all investments for this IPO
  const investmentsSnap = await getDocs(
    query(collection(db, 'ipo_investments'), where('ipoId', '==', ipoId))
  );

  // Calculate total invested (from docs, not from IPO doc, for accuracy)
  let totalInvested = 0;
  investmentsSnap.docs.forEach((d) => {
    totalInvested += d.data().investedAmount;
  });

  if (totalInvested === 0) {
    throw new Error('No investments found for this IPO');
  }

  const batch = writeBatch(db);

  // Distribute profit to each investor proportionally
  investmentsSnap.docs.forEach((d) => {
    const data = d.data();
    const sharePercent = data.investedAmount / totalInvested;
    const profitEarned = Math.round(netProfit * sharePercent * 100) / 100;

    batch.update(doc(db, 'ipo_investments', d.id), {
      profitEarned,
    });
  });

  // Update IPO status and netProfit
  batch.update(doc(db, 'ipos', ipoId), {
    status: 'SOLD',
    netProfit,
  });

  await batch.commit();
}

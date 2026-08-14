'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  BASE_NAV,
  PoolStats,
  calculateNAV,
  calculateDepositUnits,
  calculateWithdrawalUnits,
  calculateIPOApply,
  calculateIPORefund,
  calculateIPOSold,
} from './nav-engine';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  uid: string;
  displayName: string;
  type: 'DEPOSIT' | 'WITHDRAW';
  amount: number;
  unitsAllocated: number;
  navAtTransaction: number;
  timestamp: Timestamp;
}

export interface IPO {
  id: string;
  name: string;
  applyDate: Timestamp;
  blockAmount: number;
  status: 'APPLIED' | 'ALLOTTED' | 'REJECTED' | 'SOLD';
  saleAmount?: number;
  profitLoss: number;
  taxWithheld: number;
  resolvedAt?: Timestamp;
}

export interface MemberInfo {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  totalUnitsOwned: number;
  role: 'admin' | 'member';
}

// ─── Real-time Hooks ────────────────────────────────────────────────────────────

/**
 * Subscribe to pool_stats/current in real-time
 */
export function usePoolStats() {
  const [stats, setStats] = useState<PoolStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, 'pool_stats', 'current');
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setStats(snap.data() as PoolStats);
      } else {
        setStats(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { stats, loading };
}

/**
 * Subscribe to all members in real-time
 */
export function useAllMembers() {
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = collection(db, 'users');
    const unsubscribe = onSnapshot(ref, (snap) => {
      const data = snap.docs.map((d) => ({ ...d.data(), uid: d.id } as MemberInfo));
      setMembers(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { members, loading };
}

/**
 * Subscribe to transactions, optionally filtered by user
 */
export function useTransactions(uid?: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = collection(db, 'transactions');
    const q = uid
      ? query(ref, where('uid', '==', uid), orderBy('timestamp', 'desc'))
      : query(ref, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction));
      setTransactions(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid]);

  return { transactions, loading };
}

/**
 * Subscribe to all IPOs in real-time
 */
export function useIPOs() {
  const [ipos, setIPOs] = useState<IPO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = collection(db, 'ipos');
    const q = query(ref, orderBy('applyDate', 'desc'));

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as IPO));
      setIPOs(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { ipos, loading };
}

// ─── Firestore Transaction Functions ────────────────────────────────────────────

/**
 * Initialize the pool with starting values.
 * Creates pool_stats/current if it doesn't exist.
 */
export async function initializePool() {
  const ref = doc(db, 'pool_stats', 'current');
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const initialStats: PoolStats = {
      totalCashLiquid: 0,
      totalCashBlocked: 0,
      totalTaxReserve: 0,
      totalUnitsInCirculation: 0,
      currentNav: BASE_NAV,
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, initialStats);
  }
}

/**
 * Process a deposit using a Firestore transaction for atomicity.
 * 1. Read current pool stats and user data
 * 2. Calculate units at current NAV
 * 3. Update pool stats, user units, and create transaction record
 */
export async function processDeposit(uid: string, displayName: string, amount: number) {
  const poolRef = doc(db, 'pool_stats', 'current');
  const userRef = doc(db, 'users', uid);

  await runTransaction(db, async (transaction) => {
    const poolSnap = await transaction.get(poolRef);
    const userSnap = await transaction.get(userRef);

    if (!poolSnap.exists()) throw new Error('Pool not initialized');
    if (!userSnap.exists()) throw new Error('User not found');

    const pool = poolSnap.data() as PoolStats;
    const user = userSnap.data();

    const currentNav = pool.totalUnitsInCirculation > 0
      ? calculateNAV(pool.totalCashLiquid, pool.totalCashBlocked, pool.totalUnitsInCirculation)
      : BASE_NAV;

    const { unitsAllocated } = calculateDepositUnits(amount, currentNav);

    // Update pool stats
    transaction.update(poolRef, {
      totalCashLiquid: pool.totalCashLiquid + amount,
      totalUnitsInCirculation: pool.totalUnitsInCirculation + unitsAllocated,
      currentNav: calculateNAV(
        pool.totalCashLiquid + amount,
        pool.totalCashBlocked,
        pool.totalUnitsInCirculation + unitsAllocated
      ),
      updatedAt: serverTimestamp(),
    });

    // Update user units
    transaction.update(userRef, {
      totalUnitsOwned: (user.totalUnitsOwned || 0) + unitsAllocated,
    });

    // Create transaction record
    const txnRef = doc(collection(db, 'transactions'));
    transaction.set(txnRef, {
      uid,
      displayName,
      type: 'DEPOSIT',
      amount,
      unitsAllocated,
      navAtTransaction: currentNav,
      timestamp: serverTimestamp(),
    });
  });
}

/**
 * Process a withdrawal using a Firestore transaction for atomicity.
 * Validates that the user has enough units before proceeding.
 */
export async function processWithdrawal(uid: string, displayName: string, amount: number) {
  const poolRef = doc(db, 'pool_stats', 'current');
  const userRef = doc(db, 'users', uid);

  await runTransaction(db, async (transaction) => {
    const poolSnap = await transaction.get(poolRef);
    const userSnap = await transaction.get(userRef);

    if (!poolSnap.exists()) throw new Error('Pool not initialized');
    if (!userSnap.exists()) throw new Error('User not found');

    const pool = poolSnap.data() as PoolStats;
    const user = userSnap.data();

    const currentNav = calculateNAV(pool.totalCashLiquid, pool.totalCashBlocked, pool.totalUnitsInCirculation);
    const { unitsDeducted } = calculateWithdrawalUnits(amount, currentNav);

    if (unitsDeducted > (user.totalUnitsOwned || 0)) {
      throw new Error('Insufficient units for this withdrawal');
    }

    if (amount > pool.totalCashLiquid) {
      throw new Error('Insufficient liquid funds in pool');
    }

    // Update pool stats
    transaction.update(poolRef, {
      totalCashLiquid: pool.totalCashLiquid - amount,
      totalUnitsInCirculation: pool.totalUnitsInCirculation - unitsDeducted,
      currentNav: calculateNAV(
        pool.totalCashLiquid - amount,
        pool.totalCashBlocked,
        pool.totalUnitsInCirculation - unitsDeducted
      ),
      updatedAt: serverTimestamp(),
    });

    // Update user units
    transaction.update(userRef, {
      totalUnitsOwned: (user.totalUnitsOwned || 0) - unitsDeducted,
    });

    // Create transaction record
    const txnRef = doc(collection(db, 'transactions'));
    transaction.set(txnRef, {
      uid,
      displayName,
      type: 'WITHDRAW',
      amount,
      unitsAllocated: -unitsDeducted,
      navAtTransaction: currentNav,
      timestamp: serverTimestamp(),
    });
  });
}

/**
 * Apply for an IPO — moves cash from Liquid to Blocked.
 */
export async function applyForIPO(name: string, blockAmount: number) {
  const poolRef = doc(db, 'pool_stats', 'current');

  await runTransaction(db, async (transaction) => {
    const poolSnap = await transaction.get(poolRef);
    if (!poolSnap.exists()) throw new Error('Pool not initialized');

    const pool = poolSnap.data() as PoolStats;
    const { newLiquid, newBlocked } = calculateIPOApply(pool.totalCashLiquid, pool.totalCashBlocked, blockAmount);

    // Update pool stats
    transaction.update(poolRef, {
      totalCashLiquid: newLiquid,
      totalCashBlocked: newBlocked,
      updatedAt: serverTimestamp(),
    });

    // Create IPO record
    const ipoRef = doc(collection(db, 'ipos'));
    transaction.set(ipoRef, {
      name,
      applyDate: serverTimestamp(),
      blockAmount,
      status: 'APPLIED',
      profitLoss: 0,
      taxWithheld: 0,
    });
  });
}

/**
 * Resolve an IPO as Rejected/Refunded — returns blocked funds to Liquid.
 */
export async function resolveIPORefund(ipoId: string, blockAmount: number) {
  const poolRef = doc(db, 'pool_stats', 'current');
  const ipoRef = doc(db, 'ipos', ipoId);

  await runTransaction(db, async (transaction) => {
    const poolSnap = await transaction.get(poolRef);
    if (!poolSnap.exists()) throw new Error('Pool not initialized');

    const pool = poolSnap.data() as PoolStats;
    const { newLiquid, newBlocked } = calculateIPORefund(pool.totalCashLiquid, pool.totalCashBlocked, blockAmount);

    transaction.update(poolRef, {
      totalCashLiquid: newLiquid,
      totalCashBlocked: newBlocked,
      updatedAt: serverTimestamp(),
    });

    transaction.update(ipoRef, {
      status: 'REJECTED',
      resolvedAt: serverTimestamp(),
    });
  });
}

/**
 * Resolve an IPO as Allotted — keeps funds blocked (status change only).
 */
export async function resolveIPOAllotted(ipoId: string) {
  const ipoRef = doc(db, 'ipos', ipoId);
  await updateDoc(ipoRef, {
    status: 'ALLOTTED',
    resolvedAt: serverTimestamp(),
  });
}

/**
 * Resolve an IPO as Sold — returns to liquid with profit/loss, deducts 20% tax on profit.
 * This is the critical function that handles the STCG tax reserve.
 */
export async function resolveIPOSold(ipoId: string, blockAmount: number, saleAmount: number) {
  const poolRef = doc(db, 'pool_stats', 'current');
  const ipoRef = doc(db, 'ipos', ipoId);

  await runTransaction(db, async (transaction) => {
    const poolSnap = await transaction.get(poolRef);
    if (!poolSnap.exists()) throw new Error('Pool not initialized');

    const pool = poolSnap.data() as PoolStats;

    const result = calculateIPOSold(
      pool.totalCashLiquid,
      pool.totalCashBlocked,
      pool.totalTaxReserve,
      pool.totalUnitsInCirculation,
      blockAmount,
      saleAmount
    );

    transaction.update(poolRef, {
      totalCashLiquid: result.newLiquid,
      totalCashBlocked: result.newBlocked,
      totalTaxReserve: result.newTaxReserve,
      currentNav: result.newNav,
      updatedAt: serverTimestamp(),
    });

    transaction.update(ipoRef, {
      status: 'SOLD',
      saleAmount,
      profitLoss: result.grossProfit,
      taxWithheld: result.taxWithheld,
      resolvedAt: serverTimestamp(),
    });
  });
}

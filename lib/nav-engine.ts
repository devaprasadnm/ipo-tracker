/**
 * NAV Engine — Core business logic for the IPO Investment Pool
 * 
 * Implements mutual-fund-style unit-based accounting:
 * - 1 Unit = ₹100 at inception (BASE_NAV)
 * - Deposits allocate units at current NAV
 * - Withdrawals deduct units at current NAV
 * - IPO profits trigger automatic 20% STCG tax reserve deduction
 * - NAV = (Total Liquid Cash + Total Blocked Cash) / Total Units In Circulation
 * 
 * NOTE: Tax reserve is excluded from NAV because it belongs to the PAN holder,
 * not the pool. This ensures fairness.
 */

// ─── Constants ──────────────────────────────────────────────────────────────────

export const BASE_NAV = 100; // ₹100 per unit at pool inception
export const STCG_TAX_RATE = 0.20; // 20% Short-Term Capital Gains tax

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface PoolStats {
  totalCashLiquid: number;
  totalCashBlocked: number;
  totalTaxReserve: number;
  totalUnitsInCirculation: number;
  currentNav: number;
  updatedAt: unknown;
}

export interface DepositResult {
  unitsAllocated: number;
  navUsed: number;
}

export interface WithdrawalResult {
  unitsDeducted: number;
  navUsed: number;
}

export interface IPOApplyResult {
  newLiquid: number;
  newBlocked: number;
}

export interface IPORefundResult {
  newLiquid: number;
  newBlocked: number;
}

export interface IPOSoldResult {
  grossProfit: number;
  taxWithheld: number;
  netToPool: number;
  newLiquid: number;
  newBlocked: number;
  newTaxReserve: number;
  newNav: number;
}

// ─── Pure Calculation Functions ──────────────────────────────────────────────────

/**
 * Calculate the current Net Asset Value (NAV).
 * NAV = (Liquid Cash + Blocked Cash) / Total Units in Circulation
 * 
 * Tax reserve is intentionally excluded — it's earmarked for the PAN holder's
 * tax liability and doesn't belong to unitholders.
 */
export function calculateNAV(
  totalCashLiquid: number,
  totalCashBlocked: number,
  totalUnitsInCirculation: number
): number {
  if (totalUnitsInCirculation <= 0) return BASE_NAV;
  return (totalCashLiquid + totalCashBlocked) / totalUnitsInCirculation;
}

/**
 * Calculate units allocated for a deposit.
 * Units = Deposit Amount / Current NAV
 */
export function calculateDepositUnits(amount: number, currentNav: number): DepositResult {
  if (amount <= 0) throw new Error('Deposit amount must be positive');
  if (currentNav <= 0) throw new Error('NAV must be positive');

  const unitsAllocated = amount / currentNav;
  return {
    unitsAllocated: Math.round(unitsAllocated * 100) / 100, // Round to 2 decimals
    navUsed: currentNav,
  };
}

/**
 * Calculate units deducted for a withdrawal.
 * Units = Withdrawal Amount / Current NAV
 */
export function calculateWithdrawalUnits(amount: number, currentNav: number): WithdrawalResult {
  if (amount <= 0) throw new Error('Withdrawal amount must be positive');
  if (currentNav <= 0) throw new Error('NAV must be positive');

  const unitsDeducted = amount / currentNav;
  return {
    unitsDeducted: Math.round(unitsDeducted * 100) / 100,
    navUsed: currentNav,
  };
}

/**
 * Calculate pool changes when applying for an IPO.
 * Moves funds from Liquid to Blocked.
 */
export function calculateIPOApply(
  currentLiquid: number,
  currentBlocked: number,
  blockAmount: number
): IPOApplyResult {
  if (blockAmount <= 0) throw new Error('Block amount must be positive');
  if (blockAmount > currentLiquid) throw new Error('Insufficient liquid funds');

  return {
    newLiquid: currentLiquid - blockAmount,
    newBlocked: currentBlocked + blockAmount,
  };
}

/**
 * Calculate pool changes when an IPO is rejected/refunded.
 * Returns blocked funds to Liquid.
 */
export function calculateIPORefund(
  currentLiquid: number,
  currentBlocked: number,
  blockAmount: number
): IPORefundResult {
  return {
    newLiquid: currentLiquid + blockAmount,
    newBlocked: currentBlocked - blockAmount,
  };
}

/**
 * Calculate pool changes when an IPO is sold.
 * 
 * CRITICAL TAX LOGIC:
 * 1. Gross Profit = Sale Amount - Block Amount
 * 2. If profit > 0, deduct 20% STCG tax and add to Tax Reserve
 * 3. Net amount returned to liquid = Sale Amount - Tax Withheld
 * 4. Recalculate NAV with new pool totals
 * 
 * If the IPO was sold at a loss, no tax is deducted.
 */
export function calculateIPOSold(
  currentLiquid: number,
  currentBlocked: number,
  currentTaxReserve: number,
  totalUnitsInCirculation: number,
  blockAmount: number,
  saleAmount: number
): IPOSoldResult {
  const grossProfit = saleAmount - blockAmount;
  
  // Tax is only on profits, never on losses
  const taxWithheld = grossProfit > 0 ? Math.round(grossProfit * STCG_TAX_RATE * 100) / 100 : 0;
  
  // Net amount returned to the pool's liquid cash
  const netToPool = saleAmount - taxWithheld;
  
  const newLiquid = currentLiquid + netToPool;
  const newBlocked = currentBlocked - blockAmount;
  const newTaxReserve = currentTaxReserve + taxWithheld;

  // Recalculate NAV with updated figures
  const newNav = calculateNAV(newLiquid, newBlocked, totalUnitsInCirculation);

  return {
    grossProfit,
    taxWithheld,
    netToPool,
    newLiquid,
    newBlocked,
    newTaxReserve,
    newNav,
  };
}

/**
 * Format a number as Indian Rupees (₹)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format units to 2 decimal places
 */
export function formatUnits(units: number): string {
  return units.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

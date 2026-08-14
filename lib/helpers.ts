/**
 * Shared helper utilities for the IPO Investment Pool Tracker.
 */

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
 * Format a percentage to 1 decimal place
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

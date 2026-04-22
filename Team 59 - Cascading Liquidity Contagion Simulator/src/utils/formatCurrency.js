/**
 * formatCurrency.js
 * Formats monetary values based on scenario currency.
 * @param {number} value - Raw numeric value
 * @param {'USD'|'INR'} currency - Currency code
 * @returns {string} - Formatted string e.g. "$42.3B" or "₹3,24,921 Cr"
 */
export function formatCurrency(value, currency = 'USD') {
  if (value === undefined || value === null) return '—';

  if (currency === 'INR') {
    // Indian numbering: crore formatting
    // Note: value is assumed to be in Crores for India 2025 scenario
    if (value >= 1e7) return `₹${(value / 1e7).toFixed(2)} Lakh Cr`;
    if (value >= 1e5) return `₹${(value / 1e5).toFixed(1)} Lakh Cr`;
    return `₹${value.toLocaleString('en-IN')} Cr`;
  }
  // USD
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9)  return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6)  return `$${(value / 1e6).toFixed(1)}M`;
  return `$${value.toLocaleString()}B`; // Values in simulation are usually in Billions
}

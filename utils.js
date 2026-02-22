// utils.js — Formatting, IDs, sanitization, validation helpers

/**
 * Generate a unique ID (UUID v4-like)
 */
export function generateId() {
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
    ((Math.random() * 16) | 0).toString(16)
  );
}

/**
 * Sanitize a string for safe HTML rendering.
 * Escapes &, <, >, ", and ' characters.
 */
export function sanitize(str) {
  if (typeof str !== 'string') return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return str.replace(/[&<>"']/g, (c) => map[c]);
}

/**
 * Format a number as currency using Intl.NumberFormat.
 * @param {number} amount
 * @param {string} symbol - Currency symbol (e.g. '₹')
 * @param {string} locale - Locale string (default 'en-IN')
 */
export function formatCurrency(amount, symbol = '₹', locale = 'en-IN') {
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  return `${symbol}${formatted}`;
}

/**
 * Format an ISO date string to a human-readable format.
 * @param {string} isoStr - e.g. '2025-03-15'
 * @param {string} locale
 */
export function formatDate(isoStr, locale = 'en-IN') {
  if (!isoStr) return '';
  const d = new Date(isoStr + 'T00:00:00');
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Format date for grouping headers (e.g. "Today", "Yesterday", "15 Mar 2025")
 */
export function formatDateGroup(isoStr) {
  if (!isoStr) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(isoStr + 'T00:00:00');
  const diff = Math.floor((today - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return formatDate(isoStr);
}

/**
 * Get the current date as ISO string 'YYYY-MM-DD'
 */
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Validate a transaction object.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateTransaction(data) {
  const errors = [];

  if (!data.type || !['expense', 'income'].includes(data.type)) {
    errors.push('Type must be "expense" or "income".');
  }

  const amount = parseFloat(data.amount);
  if (isNaN(amount) || amount <= 0) {
    errors.push('Amount must be a positive number.');
  }

  if (!data.category || data.category.trim() === '') {
    errors.push('Category is required.');
  }

  if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    errors.push('A valid date is required.');
  } else {
    const d = new Date(data.date + 'T00:00:00');
    if (isNaN(d.getTime())) {
      errors.push('Date is invalid.');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Convert transactions array to CSV string.
 */
export function toCSV(transactions) {
  const headers = ['ID', 'Type', 'Amount', 'Category', 'Date', 'Note', 'Payment Method', 'Created At'];
  const rows = transactions.map((t) => [
    t.id,
    t.type,
    t.amount,
    `"${(t.category || '').replace(/"/g, '""')}"`,
    t.date,
    `"${(t.note || '').replace(/"/g, '""')}"`,
    `"${(t.paymentMethod || '').replace(/"/g, '""')}"`,
    t.createdAt,
  ].join(','));
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Trigger a file download in-browser.
 */
export function downloadFile(content, filename, mime = 'text/csv') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Debounce a function.
 */
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Get categories list (defaults).
 */
export const DEFAULT_CATEGORIES = [
  'Food & Dining',
  'Transport',
  'Shopping',
  'Bills & Utilities',
  'Entertainment',
  'Health',
  'Education',
  'Salary',
  'Freelance',
  'Investment',
  'Gift',
  'Other',
];

/**
 * Default payment methods.
 */
export const PAYMENT_METHODS = [
  'Cash',
  'UPI',
  'Credit Card',
  'Debit Card',
  'Net Banking',
  'Other',
];

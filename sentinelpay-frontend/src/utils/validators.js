/**
 * validators.js — form field validation helpers
 * Mirrors backend validation constraints.
 */

/** Email must match a basic RFC pattern */
export const validateEmail = (email) => {
  if (!email) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address';
  return null;
};

/**
 * Password: min 6 chars, at least 1 digit.
 * Mirrors backend: ^(?=.*[0-9]).{6,}$
 */
export const validatePassword = (password) => {
  if (!password) return 'Password is required';
  if (password.length < 6) return 'Password must be at least 6 characters';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one digit';
  return null;
};

/** Name: 2–100 characters */
export const validateName = (name) => {
  if (!name || name.trim().length < 2) return 'Name must be at least 2 characters';
  if (name.trim().length > 100)        return 'Name must be at most 100 characters';
  return null;
};

/** Amount must be a positive number */
export const validateAmount = (amount) => {
  const num = parseFloat(amount);
  if (!amount && amount !== 0) return 'Amount is required';
  if (isNaN(num) || num <= 0) return 'Amount must be a positive number';
  return null;
};

/** UPI ID: basic format check (something@something) */
export const validateUpiId = (upiId) => {
  if (!upiId) return 'UPI ID is required';
  if (!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(upiId)) return 'Enter a valid UPI ID (e.g. name@upi)';
  return null;
};

/** Transaction ID must be non-empty */
export const validateTransactionId = (txId) => {
  if (!txId || !txId.trim()) return 'Transaction ID is required';
  return null;
};

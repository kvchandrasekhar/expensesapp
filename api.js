// api.js — Offline-first persistence layer with AWS API Gateway syncing

import { getSession, logout } from './auth.js';

const STORAGE_KEY = 'expenseTracker:data';
const CURRENT_VERSION = 1;

export const API_URL = window.APP_CONFIG ? window.APP_CONFIG.API_URL : "";

/**
 * Perform an authenticated API call to the cloud backend.
 */
export async function syncToCloud(path, method = 'GET', body = null) {
    const session = getSession();
    if (!session || !session.idToken) return null; // Use idToken for Cognito Authorizer

    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.idToken}`
            }
        };
        if (body) options.body = JSON.stringify(body);

        const res = await fetch(`${API_URL}${path}`, options);
        if (res.status === 401) {
            console.warn('Session expired, logging out.');
            logout();
            window.location.reload();
            return null;
        }

        // Wait, API gateway Lambda returns 200 normally
        const data = await res.json().catch(() => ({}));
        return data;
    } catch (error) {
        console.error(`Cloud Sync Error (${method} ${path}):`, error);
        return null; // Silent failure for offline support
    }
}

/**
 * Default data shape.
 */
function defaultData() {
    return {
        version: CURRENT_VERSION,
        settings: {
            currencySymbol: '₹',
            locale: 'en-IN',
            startOfWeek: 'Mon',
        },
        budget: {
            monthly: 0,
        },
        transactions: [],
    };
}

/**
 * Safely load data from localStorage.
 */
function loadRaw() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return defaultData();
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.transactions)) {
            return defaultData();
        }
        return parsed;
    } catch (e) {
        return defaultData();
    }
}

/**
 * Persist data to localStorage.
 */
function save(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('Failed to save to localStorage:', e);
    }
}

// ---------- Public API ----------

/**
 * Sync entire state from cloud on startup. (Optional to call in app.js on load)
 */
export async function pullFromCloud() {
    const [txData, settingsData] = await Promise.all([
        syncToCloud('/transactions', 'GET'),
        syncToCloud('/settings', 'GET')
    ]);

    if (txData && Array.isArray(txData)) {
        const data = loadRaw();

        // Merge strategy: Cloud wins for simplicity, but could be more robust
        // Just storing exactly what's in the cloud for now.
        const cloudTxs = txData;

        // Merge settings
        let mergedSettings = data.settings;
        let mergedBudget = data.budget;
        if (settingsData && Object.keys(settingsData).length > 0) {
            if (settingsData.currencySymbol) mergedSettings.currencySymbol = settingsData.currencySymbol;
            if (settingsData.monthlyBudget !== undefined) mergedBudget.monthly = settingsData.monthlyBudget;
        }

        const mergedData = {
            version: CURRENT_VERSION,
            settings: mergedSettings,
            budget: mergedBudget,
            transactions: cloudTxs
        };
        save(mergedData);
        return true; // Indicate data changed
    }
    return false;
}

/**
 * Get all data (full store).
 */
export function getAllData() {
    return loadRaw();
}

/**
 * Get all transactions.
 */
export function getTransactions() {
    return loadRaw().transactions;
}

/**
 * Add a transaction.
 */
export function addTransaction(tx) {
    const data = loadRaw();
    const now = new Date().toISOString();
    const newTx = {
        ...tx,
        amount: parseFloat(tx.amount),
        createdAt: now,
        updatedAt: now,
    };
    data.transactions.push(newTx);
    save(data);

    // Cloud Sync
    syncToCloud('/transactions', 'POST', newTx);

    return newTx;
}

/**
 * Update a transaction by ID.
 */
export function updateTransaction(id, updates) {
    const data = loadRaw();
    const idx = data.transactions.findIndex((t) => t.id === id);
    if (idx === -1) return null;

    const updated = {
        ...data.transactions[idx],
        ...updates,
        amount: parseFloat(updates.amount ?? data.transactions[idx].amount),
        updatedAt: new Date().toISOString(),
    };
    data.transactions[idx] = updated;
    save(data);

    // Cloud Sync
    syncToCloud(`/transactions/${id}`, 'PUT', updated);

    return data.transactions[idx];
}

/**
 * Delete a transaction by ID.
 */
export function deleteTransaction(id) {
    const data = loadRaw();
    const idx = data.transactions.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    const [deleted] = data.transactions.splice(idx, 1);
    save(data);

    // Cloud Sync
    syncToCloud(`/transactions/${id}`, 'DELETE');

    return deleted;
}

/**
 * Restore a previously deleted transaction.
 */
export function restoreTransaction(tx) {
    const data = loadRaw();
    data.transactions.push(tx);
    save(data);

    // Cloud Sync
    syncToCloud('/transactions', 'POST', tx);
}

/**
 * Get settings.
 */
export function getSettings() {
    return loadRaw().settings;
}

/**
 * Update settings (partial merge).
 */
export function updateSettings(partial) {
    const data = loadRaw();
    data.settings = { ...data.settings, ...partial };
    save(data);

    // Cloud Sync
    syncToCloud('/settings', 'POST', {
        currencySymbol: data.settings.currencySymbol,
        monthlyBudget: data.budget.monthly
    });

    return data.settings;
}

/**
 * Get budget.
 */
export function getBudget() {
    return loadRaw().budget;
}

/**
 * Set monthly budget.
 */
export function setBudget(monthly) {
    const data = loadRaw();
    const val = parseFloat(monthly) || 0;
    data.budget = { monthly: val };
    save(data);

    // Cloud Sync
    syncToCloud('/settings', 'POST', {
        currencySymbol: data.settings.currencySymbol,
        monthlyBudget: val
    });

    return data.budget;
}

/**
 * Import transactions from JSON. Validates each entry.
 */
export function importTransactions(jsonArray) {
    const errors = [];
    const valid = [];
    if (!Array.isArray(jsonArray)) {
        return { imported: 0, errors: ['Data must be an array of transactions.'] };
    }
    jsonArray.forEach((item, i) => {
        if (!item.id || !item.type || !item.amount || !item.category || !item.date) {
            errors.push(`Entry ${i + 1}: missing required fields.`);
            return;
        }
        if (!['expense', 'income'].includes(item.type)) {
            errors.push(`Entry ${i + 1}: type must be "expense" or "income".`);
            return;
        }
        if (isNaN(parseFloat(item.amount)) || parseFloat(item.amount) <= 0) {
            errors.push(`Entry ${i + 1}: amount must be a positive number.`);
            return;
        }
        valid.push({
            id: item.id,
            type: item.type,
            amount: parseFloat(item.amount),
            category: item.category,
            date: item.date,
            note: item.note || '',
            paymentMethod: item.paymentMethod || '',
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: item.updatedAt || new Date().toISOString(),
        });
    });

    if (valid.length > 0) {
        const data = loadRaw();
        data.transactions.push(...valid);
        save(data);

        // Cloud Sync: push each imported transaction
        // (In a real app, a batch API would be better, but this works for now)
        valid.forEach(tx => syncToCloud('/transactions', 'POST', tx));
    }

    return { imported: valid.length, errors };
}

/**
 * Reset ALL data. Returns fresh default data.
 */
export function resetAllData() {
    const data = defaultData();
    save(data);
    // Hard to reset all on cloud without a specific endpoint, ignoring for now
    return data;
}

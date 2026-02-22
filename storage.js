// storage.js — localStorage persistence layer with versioned schema + migrations

const STORAGE_KEY = 'expenseTracker:data';
const CURRENT_VERSION = 1;

/**
 * Default data shape.
 */
function defaultData() {
    return {
        version: CURRENT_VERSION,
        settings: {
            currencySymbol: '₹',
            locale: 'en-IN',
            startOfWeek: 'Mon', // 'Mon' | 'Sun'
        },
        budget: {
            monthly: 0, // 0 means not set
        },
        transactions: [],
    };
}

/**
 * Migrate data from older versions.
 */
function migrate(data) {
    let d = { ...data };
    // Version 0 → 1 (initial schema, nothing to migrate yet)
    // Future migrations go here:
    // if (d.version < 2) { ... d.version = 2; }
    d.version = CURRENT_VERSION;
    return d;
}

/**
 * Safely load data from localStorage.
 * Returns valid data or default if corrupted.
 */
function loadRaw() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return defaultData();
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.transactions)) {
            console.warn('Corrupted localStorage data detected, resetting.');
            return defaultData();
        }
        if (parsed.version < CURRENT_VERSION) {
            return migrate(parsed);
        }
        return parsed;
    } catch (e) {
        console.error('Failed to parse localStorage data:', e);
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
 * Add a transaction. Returns the new transaction.
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
    return newTx;
}

/**
 * Update a transaction by ID.
 */
export function updateTransaction(id, updates) {
    const data = loadRaw();
    const idx = data.transactions.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    data.transactions[idx] = {
        ...data.transactions[idx],
        ...updates,
        amount: parseFloat(updates.amount ?? data.transactions[idx].amount),
        updatedAt: new Date().toISOString(),
    };
    save(data);
    return data.transactions[idx];
}

/**
 * Delete a transaction by ID. Returns the deleted transaction or null.
 */
export function deleteTransaction(id) {
    const data = loadRaw();
    const idx = data.transactions.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    const [deleted] = data.transactions.splice(idx, 1);
    save(data);
    return deleted;
}

/**
 * Restore a previously deleted transaction.
 */
export function restoreTransaction(tx) {
    const data = loadRaw();
    data.transactions.push(tx);
    save(data);
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
    data.budget = { monthly: parseFloat(monthly) || 0 };
    save(data);
    return data.budget;
}

/**
 * Import transactions from JSON. Validates each entry.
 * Returns { imported: number, errors: string[] }
 */
export function importTransactions(jsonArray) {
    const errors = [];
    const valid = [];
    if (!Array.isArray(jsonArray)) {
        return { imported: 0, errors: ['Data must be an array of transactions.'] };
    }
    jsonArray.forEach((item, i) => {
        if (!item.id || !item.type || !item.amount || !item.category || !item.date) {
            errors.push(`Entry ${i + 1}: missing required fields (id, type, amount, category, date).`);
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
    }

    return { imported: valid.length, errors };
}

/**
 * Reset ALL data. Returns fresh default data.
 */
export function resetAllData() {
    const data = defaultData();
    save(data);
    return data;
}

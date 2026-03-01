// app.js — Main application module
import {
    getTransactions, addTransaction, updateTransaction, deleteTransaction,
    restoreTransaction, getSettings, updateSettings, getBudget, setBudget,
    importTransactions, resetAllData, getAllData, pullFromCloud
} from './api.js';

import {
    generateId, sanitize, formatCurrency, formatDate, formatDateGroup,
    todayISO, validateTransaction, toCSV, downloadFile, debounce,
    DEFAULT_CATEGORIES, PAYMENT_METHODS,
} from './utils.js';

import { login, register, logout, getSession, isLoggedIn } from './auth.js';

// ────────────────────────────────────────
// STATE
// ────────────────────────────────────────
let currentView = 'dashboard';
let selectedMonth = new Date(); // month being viewed
let sortField = 'date';
let sortDir = 'desc';
let editingTxId = null; // null = adding, string = editing
let deleteUndoTimer = null;
let deletedTx = null;

// ────────────────────────────────────────
// DOM REFERENCES
// ────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Views
const views = {
    dashboard: $('#view-dashboard'),
    transactions: $('#view-transactions'),
    settings: $('#view-settings'),
};

// Dashboard
const monthLabel = $('#monthLabel');
const totalIncome = $('#totalIncome');
const totalExpense = $('#totalExpense');
const netBalance = $('#netBalance');
const budgetSection = $('#budgetSection');
const categoryBreakdown = $('#categoryBreakdown');
const trendChart = $('#trendChart');
const dashboardEmpty = $('#dashboardEmpty');
const summaryGrid = $('#summaryGrid');

// Transactions
const transactionsList = $('#transactionsList');
const transactionsEmpty = $('#transactionsEmpty');
const searchInput = $('#searchInput');
const filterType = $('#filterType');
const filterCategory = $('#filterCategory');
const filterDateFrom = $('#filterDateFrom');
const filterDateTo = $('#filterDateTo');

// Modal
const modalBackdrop = $('#modalBackdrop');
const txModal = $('#txModal');
const modalTitle = $('#modalTitle');
const txForm = $('#txForm');
const txIdField = $('#txId');
const txAmount = $('#txAmount');
const txCategory = $('#txCategory');
const txDate = $('#txDate');
const txNote = $('#txNote');
const txPayment = $('#txPayment');
const modalSaveBtn = $('#modalSaveBtn');
const txAmountError = $('#txAmountError');
const txCategoryError = $('#txCategoryError');
const txDateError = $('#txDateError');

// Confirm modal
const confirmBackdrop = $('#confirmBackdrop');
const confirmModal = $('#confirmModal');
const confirmTitle = $('#confirmTitle');
const confirmMessage = $('#confirmMessage');
const confirmOkBtn = $('#confirmOkBtn');
const confirmCancelBtn = $('#confirmCancelBtn');
let confirmCallback = null;

// Toast
const toast = $('#toast');
const toastMessage = $('#toastMessage');
const toastAction = $('#toastAction');

// Settings
const settingCurrency = $('#settingCurrency');
const settingBudget = $('#settingBudget');

// Auth
const authScreen = $('#authScreen');
const appLayout = $('#appLayout');
const authForm = $('#authForm');
const authTitle = $('#authTitle');
const authEmail = $('#authEmail');
const authPassword = $('#authPassword');
const authConfirmPassword = $('#authConfirmPassword');
const authConfirmGroup = $('#authConfirmGroup');
const authSubmitBtn = $('#authSubmitBtn');
const authSwitchText = $('#authSwitchText');
const authSwitchBtn = $('#authSwitchBtn');
const authEmailError = $('#authEmailError');
const authPasswordError = $('#authPasswordError');
const authConfirmError = $('#authConfirmError');
const authGeneralError = $('#authGeneralError');
const headerUser = $('#headerUser');
const logoutBtn = $('#logoutBtn');
let isSignUpMode = false;

// ────────────────────────────────────────
// SETTINGS HELPERS
// ────────────────────────────────────────
function getCurrency() {
    return getSettings().currencySymbol || '₹';
}

function fmtCurrency(amount) {
    return formatCurrency(amount, getCurrency(), getSettings().locale || 'en-IN');
}

// ────────────────────────────────────────
// ROUTING / NAVIGATION
// ────────────────────────────────────────
function navigate(view) {
    currentView = view;
    Object.entries(views).forEach(([key, el]) => {
        el.classList.toggle('active', key === view);
    });
    // Update nav buttons
    $$('.desktop-nav .nav-link').forEach((btn) => {
        const isActive = btn.dataset.view === view;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
    $$('.bottom-nav .nav-item').forEach((btn) => {
        const isActive = btn.dataset.view === view;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-current', isActive ? 'page' : 'false');
    });

    if (view === 'dashboard') renderDashboard();
    if (view === 'transactions') renderTransactions();
    if (view === 'settings') renderSettings();
}

// ────────────────────────────────────────
// MONTH HELPERS
// ────────────────────────────────────────
function getMonthRange(date) {
    const y = date.getFullYear();
    const m = date.getMonth();
    const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { start, end, year: y, month: m, lastDay };
}

function formatMonthLabel(date) {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function filterByMonth(transactions) {
    const { start, end } = getMonthRange(selectedMonth);
    return transactions.filter((t) => t.date >= start && t.date <= end);
}

// ────────────────────────────────────────
// DASHBOARD
// ────────────────────────────────────────
function renderDashboard() {
    monthLabel.textContent = formatMonthLabel(selectedMonth);
    const allTx = getTransactions();
    const monthTx = filterByMonth(allTx);

    if (monthTx.length === 0) {
        dashboardEmpty.classList.remove('hidden');
        summaryGrid.style.display = 'none';
        budgetSection.innerHTML = '';
        categoryBreakdown.innerHTML = '';
        clearChart();
        return;
    }

    dashboardEmpty.classList.add('hidden');
    summaryGrid.style.display = '';

    // Compute totals
    let income = 0, expense = 0;
    monthTx.forEach((t) => {
        if (t.type === 'income') income += t.amount;
        else expense += t.amount;
    });
    const net = income - expense;

    totalIncome.textContent = fmtCurrency(income);
    totalExpense.textContent = fmtCurrency(expense);
    netBalance.textContent = (net >= 0 ? '+' : '-') + fmtCurrency(Math.abs(net));
    netBalance.className = 'card-value net ' + (net >= 0 ? 'positive' : 'negative');

    // Budget
    renderBudget(expense);

    // Category breakdown
    renderCategoryBreakdown(monthTx);

    // Trend chart
    renderTrendChart(monthTx);
}

function renderBudget(spent) {
    const budget = getBudget();
    if (!budget.monthly || budget.monthly <= 0) {
        budgetSection.innerHTML = `
      <div class="budget-card">
        <div class="budget-not-set">
          <p>No monthly budget set</p>
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('settingBudget').focus(); document.querySelectorAll('[data-view=settings]')[0].click();">Set Budget</button>
        </div>
      </div>`;
        return;
    }

    const pct = Math.min((spent / budget.monthly) * 100, 100);
    let barClass = '';
    let statusClass = '';
    let statusText = `${sanitize(fmtCurrency(spent))} of ${sanitize(fmtCurrency(budget.monthly))} spent`;

    if (pct >= 100) {
        barClass = 'danger';
        statusClass = 'danger';
        statusText = `Over budget by ${sanitize(fmtCurrency(spent - budget.monthly))}!`;
    } else if (pct >= 80) {
        barClass = 'warning';
        statusClass = 'warning';
        statusText += ' — approaching limit';
    }

    budgetSection.innerHTML = `
    <div class="budget-card">
      <div class="budget-header">
        <span class="budget-label">Monthly Budget</span>
        <span class="budget-amount">${sanitize(fmtCurrency(budget.monthly))}</span>
      </div>
      <div class="budget-bar-track">
        <div class="budget-bar-fill ${barClass}" style="width: ${pct}%"></div>
      </div>
      <div class="budget-status ${statusClass}">${statusText}</div>
    </div>`;
}

function renderCategoryBreakdown(monthTx) {
    const expenses = monthTx.filter((t) => t.type === 'expense');
    if (expenses.length === 0) {
        categoryBreakdown.innerHTML = '<p style="color:var(--text-muted); font-size:var(--text-small);">No expenses this month.</p>';
        return;
    }

    const catMap = {};
    expenses.forEach((t) => {
        catMap[t.category] = (catMap[t.category] || 0) + t.amount;
    });

    const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
    const top5 = sorted.slice(0, 5);
    const otherTotal = sorted.slice(5).reduce((s, [, v]) => s + v, 0);
    if (otherTotal > 0) top5.push(['Other', otherTotal]);

    const maxVal = top5[0][1];
    const colors = ['#2DD4A8', '#60A5FA', '#FBBF24', '#F87171', '#A78BFA', '#6B6B6B'];

    categoryBreakdown.innerHTML = top5.map(([cat, val], i) => `
    <div class="category-row">
      <span class="category-name">${sanitize(cat)}</span>
      <div class="category-bar-track">
        <div class="category-bar-fill" style="width:${(val / maxVal) * 100}%;background:${colors[i % colors.length]}"></div>
      </div>
      <span class="category-amount">${sanitize(fmtCurrency(val))}</span>
    </div>
  `).join('');
}

// ────────────────────────────────────────
// TREND CHART (Canvas)
// ────────────────────────────────────────
function renderTrendChart(monthTx) {
    const canvas = trendChart;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const pad = { top: 20, right: 16, bottom: 32, left: 50 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    ctx.clearRect(0, 0, w, h);

    const { lastDay } = getMonthRange(selectedMonth);
    const dailySpend = new Array(lastDay).fill(0);

    monthTx.filter((t) => t.type === 'expense').forEach((t) => {
        const day = parseInt(t.date.split('-')[2], 10);
        dailySpend[day - 1] += t.amount;
    });

    const maxSpend = Math.max(...dailySpend, 1);
    const barW = Math.max(chartW / lastDay - 2, 2);

    // Grid lines
    ctx.strokeStyle = '#2E2E2E';
    ctx.lineWidth = 0.5;
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
        const y = pad.top + (chartH / gridLines) * i;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(w - pad.right, y);
        ctx.stroke();

        // Y labels
        const val = maxSpend - (maxSpend / gridLines) * i;
        ctx.fillStyle = '#6B6B6B';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(val >= 1000 ? (val / 1000).toFixed(1) + 'k' : Math.round(val).toString(), pad.left - 8, y + 4);
    }

    // Bars
    const accentColor = '#2DD4A8';
    dailySpend.forEach((val, i) => {
        const barH = (val / maxSpend) * chartH;
        const x = pad.left + (chartW / lastDay) * i + (chartW / lastDay - barW) / 2;
        const y = pad.top + chartH - barH;

        ctx.fillStyle = val > 0 ? accentColor : 'transparent';
        ctx.beginPath();
        const r = Math.min(barW / 2, 3);
        if (barH > r) {
            ctx.moveTo(x, y + r);
            ctx.arcTo(x, y, x + barW, y, r);
            ctx.arcTo(x + barW, y, x + barW, y + barH, r);
            ctx.lineTo(x + barW, pad.top + chartH);
            ctx.lineTo(x, pad.top + chartH);
        } else if (barH > 0) {
            ctx.rect(x, y, barW, barH);
        }
        ctx.fill();
    });

    // X labels (every 5 days + last day)
    ctx.fillStyle = '#6B6B6B';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < lastDay; i++) {
        if ((i + 1) % 5 === 0 || i === 0 || i === lastDay - 1) {
            const x = pad.left + (chartW / lastDay) * i + (chartW / lastDay) / 2;
            ctx.fillText(String(i + 1), x, h - pad.bottom + 16);
        }
    }
}

function clearChart() {
    const canvas = trendChart;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.fillStyle = '#6B6B6B';
    ctx.font = '13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data for this month', rect.width / 2, rect.height / 2);
}

// ────────────────────────────────────────
// TRANSACTIONS LIST
// ────────────────────────────────────────
function getFilteredTransactions() {
    let txs = getTransactions();

    // Filter by type
    const typeFilter = filterType.value;
    if (typeFilter !== 'all') txs = txs.filter((t) => t.type === typeFilter);

    // Filter by category
    const catFilter = filterCategory.value;
    if (catFilter !== 'all') txs = txs.filter((t) => t.category === catFilter);

    // Filter by date range
    const from = filterDateFrom.value;
    const to = filterDateTo.value;
    if (from) txs = txs.filter((t) => t.date >= from);
    if (to) txs = txs.filter((t) => t.date <= to);

    // Search by note
    const q = searchInput.value.trim().toLowerCase();
    if (q) txs = txs.filter((t) => (t.note || '').toLowerCase().includes(q));

    // Sort
    txs.sort((a, b) => {
        let cmp = 0;
        if (sortField === 'date') cmp = a.date.localeCompare(b.date);
        else if (sortField === 'amount') cmp = a.amount - b.amount;
        return sortDir === 'desc' ? -cmp : cmp;
    });

    return txs;
}

function renderTransactions() {
    // Populate filter category dropdown
    populateFilterCategories();

    const txs = getFilteredTransactions();

    if (txs.length === 0) {
        transactionsEmpty.classList.remove('hidden');
        transactionsList.innerHTML = '';
        return;
    }

    transactionsEmpty.classList.add('hidden');

    // Group by day
    const groups = {};
    txs.forEach((t) => {
        if (!groups[t.date]) groups[t.date] = [];
        groups[t.date].push(t);
    });

    const currency = getCurrency();
    let html = '';
    Object.entries(groups).forEach(([date, items]) => {
        const dayTotal = items.reduce((s, t) => s + (t.type === 'expense' ? -t.amount : t.amount), 0);
        const totalStr = (dayTotal >= 0 ? '+' : '') + fmtCurrency(Math.abs(dayTotal));
        const totalColor = dayTotal >= 0 ? 'var(--color-income)' : 'var(--color-expense)';

        html += `<div class="day-group">
      <div class="day-header">
        <span class="day-label">${sanitize(formatDateGroup(date))}</span>
        <span class="day-total" style="color:${totalColor}">${sanitize(totalStr)}</span>
      </div>`;

        items.forEach((t) => {
            const icon = t.type === 'expense' ? '↗' : '↙';
            const sign = t.type === 'expense' ? '-' : '+';
            html += `
        <div class="tx-row" data-id="${sanitize(t.id)}" tabindex="0" role="button" aria-label="${sanitize(t.category)} ${sign}${sanitize(fmtCurrency(t.amount))}">
          <div class="tx-icon ${t.type}">${icon}</div>
          <div class="tx-details">
            <div class="tx-category">${sanitize(t.category)}</div>
            ${t.note ? `<div class="tx-note">${sanitize(t.note)}</div>` : ''}
          </div>
          <div class="tx-meta">
            <div class="tx-amount ${t.type}">${sign}${sanitize(fmtCurrency(t.amount))}</div>
            ${t.paymentMethod ? `<div class="tx-payment">${sanitize(t.paymentMethod)}</div>` : ''}
          </div>
        </div>`;
        });

        html += '</div>';
    });

    transactionsList.innerHTML = html;

    // Attach click handlers to tx rows
    transactionsList.querySelectorAll('.tx-row').forEach((row) => {
        row.addEventListener('click', () => openEditModal(row.dataset.id));
        row.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEditModal(row.dataset.id); }
        });
    });
}

function populateFilterCategories() {
    const txs = getTransactions();
    const cats = [...new Set(txs.map((t) => t.category))].sort();
    const current = filterCategory.value;
    filterCategory.innerHTML = '<option value="all">All Categories</option>';
    cats.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        if (c === current) opt.selected = true;
        filterCategory.appendChild(opt);
    });
}

// ────────────────────────────────────────
// ADD / EDIT MODAL
// ────────────────────────────────────────
function populateFormDropdowns() {
    // Categories
    txCategory.innerHTML = '<option value="">Select category</option>';
    DEFAULT_CATEGORIES.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        txCategory.appendChild(opt);
    });

    // Payment methods
    txPayment.innerHTML = '<option value="">None</option>';
    PAYMENT_METHODS.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        txPayment.appendChild(opt);
    });
}

function openAddModal() {
    editingTxId = null;
    modalTitle.textContent = 'Add Transaction';
    modalSaveBtn.textContent = 'Save';
    txForm.reset();
    txDate.value = todayISO();
    setTypeToggle('expense');
    clearFormErrors();
    populateFormDropdowns();

    // Remove delete button if exists
    const existingDel = txModal.querySelector('.modal-delete-btn');
    if (existingDel) existingDel.remove();

    openModal(txModal, modalBackdrop);
    txAmount.focus();
}

function openEditModal(id) {
    const tx = getTransactions().find((t) => t.id === id);
    if (!tx) return;

    editingTxId = id;
    modalTitle.textContent = 'Edit Transaction';
    modalSaveBtn.textContent = 'Update';
    populateFormDropdowns();

    txIdField.value = tx.id;
    txAmount.value = tx.amount;
    txCategory.value = tx.category;
    txDate.value = tx.date;
    txNote.value = tx.note || '';
    txPayment.value = tx.paymentMethod || '';
    setTypeToggle(tx.type);
    clearFormErrors();

    // Add or update delete button
    let delBtn = txModal.querySelector('.modal-delete-btn');
    if (!delBtn) {
        delBtn = document.createElement('button');
        delBtn.className = 'btn btn-destructive btn-sm modal-delete-btn';
        delBtn.type = 'button';
        delBtn.textContent = 'Delete';
        delBtn.style.marginTop = 'var(--space-12)';
        delBtn.style.width = '100%';
        txModal.querySelector('.modal-body').appendChild(delBtn);
    }
    delBtn.onclick = () => {
        closeModal(txModal, modalBackdrop);
        handleDelete(id);
    };

    openModal(txModal, modalBackdrop);
    txAmount.focus();
}

function setTypeToggle(type) {
    $$('.type-toggle-btn').forEach((btn) => {
        const isActive = btn.dataset.type === type;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-checked', isActive.toString());
    });
}

function getSelectedType() {
    const active = document.querySelector('.type-toggle-btn.active');
    return active ? active.dataset.type : 'expense';
}

function clearFormErrors() {
    [txAmountError, txCategoryError, txDateError].forEach((el) => {
        el.classList.add('hidden');
        el.textContent = '';
    });
    [txAmount, txCategory, txDate].forEach((el) => el.classList.remove('error'));
}

function showFormError(inputEl, errorEl, msg) {
    inputEl.classList.add('error');
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
}

function handleSave() {
    clearFormErrors();
    const data = {
        type: getSelectedType(),
        amount: txAmount.value,
        category: txCategory.value,
        date: txDate.value,
        note: txNote.value.trim(),
        paymentMethod: txPayment.value,
    };

    const { valid, errors } = validateTransaction(data);

    if (!valid) {
        errors.forEach((err) => {
            if (err.includes('Amount')) showFormError(txAmount, txAmountError, err);
            if (err.includes('Category')) showFormError(txCategory, txCategoryError, err);
            if (err.includes('date') || err.includes('Date')) showFormError(txDate, txDateError, err);
        });
        return;
    }

    if (editingTxId) {
        updateTransaction(editingTxId, data);
    } else {
        data.id = generateId();
        addTransaction(data);
    }

    closeModal(txModal, modalBackdrop);
    refreshCurrentView();
}

// ────────────────────────────────────────
// DELETE + UNDO
// ────────────────────────────────────────
function handleDelete(id) {
    const tx = deleteTransaction(id);
    if (!tx) return;

    deletedTx = tx;
    clearTimeout(deleteUndoTimer);
    showToast('Transaction deleted.', 'Undo', () => {
        restoreTransaction(deletedTx);
        deletedTx = null;
        hideToast();
        refreshCurrentView();
    });

    deleteUndoTimer = setTimeout(() => {
        deletedTx = null;
        hideToast();
    }, 5000);

    refreshCurrentView();
}

// ────────────────────────────────────────
// MODAL HELPERS
// ────────────────────────────────────────
let previousFocus = null;

function openModal(modal, backdrop) {
    previousFocus = document.activeElement;
    backdrop.classList.add('open');
    backdrop.setAttribute('aria-hidden', 'false');
    modal.classList.add('open');
    trapFocus(modal);
}

function closeModal(modal, backdrop) {
    modal.classList.remove('open');
    backdrop.classList.remove('open');
    backdrop.setAttribute('aria-hidden', 'true');
    if (previousFocus) previousFocus.focus();
}

function trapFocus(modal) {
    const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    modal.addEventListener('keydown', function handler(e) {
        if (e.key === 'Escape') {
            closeModal(modal, modal === txModal ? modalBackdrop : confirmBackdrop);
            modal.removeEventListener('keydown', handler);
            return;
        }
        if (e.key !== 'Tab') return;
        if (e.shiftKey) {
            if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
            if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
    });
}

// ────────────────────────────────────────
// CONFIRM MODAL
// ────────────────────────────────────────
function showConfirm(title, message, okText, callback) {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmOkBtn.textContent = okText;
    confirmCallback = callback;
    openModal(confirmModal, confirmBackdrop);
}

// ────────────────────────────────────────
// TOAST
// ────────────────────────────────────────
function showToast(message, actionText, actionFn) {
    toastMessage.textContent = message;
    if (actionText && actionFn) {
        toastAction.textContent = actionText;
        toastAction.classList.remove('hidden');
        toastAction.onclick = actionFn;
    } else {
        toastAction.classList.add('hidden');
    }
    toast.classList.add('show');
}

function hideToast() {
    toast.classList.remove('show');
}

// ────────────────────────────────────────
// SETTINGS
// ────────────────────────────────────────
function renderSettings() {
    const settings = getSettings();
    const budget = getBudget();
    settingCurrency.value = settings.currencySymbol || '₹';
    settingBudget.value = budget.monthly || '';
}

function handleCurrencyChange() {
    const val = settingCurrency.value.trim();
    if (val) {
        updateSettings({ currencySymbol: val });
        refreshCurrentView();
    }
}

function handleBudgetChange() {
    const val = parseFloat(settingBudget.value);
    setBudget(isNaN(val) ? 0 : val);
}

function handleExportCSV() {
    const txs = getTransactions();
    if (txs.length === 0) {
        showToast('No transactions to export.', null, null);
        setTimeout(hideToast, 3000);
        return;
    }
    const csv = toCSV(txs);
    downloadFile(csv, `kv-transactions-${todayISO()}.csv`);
}

function handleImportJSON() {
    const fileInput = $('#importFileInput');
    fileInput.click();
}

function processImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const jsonData = JSON.parse(ev.target.result);
            const { imported, errors } = importTransactions(jsonData);
            const resultArea = $('#importResultArea');
            let html = `<p style="color:var(--color-success); font-size:var(--text-small); margin-top:var(--space-8);">${imported} transaction(s) imported.</p>`;
            if (errors.length > 0) {
                html += '<ul class="import-errors">';
                errors.forEach((err) => { html += `<li>${sanitize(err)}</li>`; });
                html += '</ul>';
            }
            resultArea.innerHTML = html;
            refreshCurrentView();
        } catch (err) {
            $('#importResultArea').innerHTML = `<p style="color:var(--color-error); font-size:var(--text-small); margin-top:var(--space-8);">Invalid JSON file: ${sanitize(err.message)}</p>`;
        }
        e.target.value = '';
    };
    reader.readAsText(file);
}

function handleResetData() {
    showConfirm(
        'Reset All Data?',
        'This will permanently delete all transactions, budgets, and settings. This cannot be undone.',
        'Reset Everything',
        () => {
            resetAllData();
            closeModal(confirmModal, confirmBackdrop);
            renderSettings();
            refreshCurrentView();
            showToast('All data has been reset.', null, null);
            setTimeout(hideToast, 3000);
        }
    );
}

// ────────────────────────────────────────
// REFRESH
// ────────────────────────────────────────
function refreshCurrentView() {
    if (currentView === 'dashboard') renderDashboard();
    if (currentView === 'transactions') renderTransactions();
}

// ────────────────────────────────────────
// EVENT LISTENERS
// ────────────────────────────────────────
function setupEventListeners() {
    // Navigation
    $$('.desktop-nav .nav-link').forEach((btn) =>
        btn.addEventListener('click', () => navigate(btn.dataset.view))
    );
    $$('.bottom-nav .nav-item').forEach((btn) =>
        btn.addEventListener('click', () => navigate(btn.dataset.view))
    );

    // Month selector
    $('#prevMonth').addEventListener('click', () => {
        selectedMonth.setMonth(selectedMonth.getMonth() - 1);
        renderDashboard();
    });
    $('#nextMonth').addEventListener('click', () => {
        selectedMonth.setMonth(selectedMonth.getMonth() + 1);
        renderDashboard();
    });

    // Add transaction buttons
    $('#fabAdd').addEventListener('click', openAddModal);
    $('#headerAddBtn').addEventListener('click', openAddModal);
    $('#dashboardAddBtn').addEventListener('click', openAddModal);

    // Modal
    $('#modalCloseBtn').addEventListener('click', () => closeModal(txModal, modalBackdrop));
    $('#modalCancelBtn').addEventListener('click', () => closeModal(txModal, modalBackdrop));
    modalBackdrop.addEventListener('click', () => closeModal(txModal, modalBackdrop));
    modalSaveBtn.addEventListener('click', handleSave);

    // Type toggle
    $$('.type-toggle-btn').forEach((btn) => {
        btn.addEventListener('click', () => setTypeToggle(btn.dataset.type));
    });

    // Confirm modal
    confirmCancelBtn.addEventListener('click', () => closeModal(confirmModal, confirmBackdrop));
    confirmBackdrop.addEventListener('click', () => closeModal(confirmModal, confirmBackdrop));
    confirmOkBtn.addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
    });

    // Filters & search
    const debouncedRender = debounce(() => renderTransactions(), 300);
    searchInput.addEventListener('input', debouncedRender);
    filterType.addEventListener('change', () => renderTransactions());
    filterCategory.addEventListener('change', () => renderTransactions());
    filterDateFrom.addEventListener('change', () => renderTransactions());
    filterDateTo.addEventListener('change', () => renderTransactions());

    // Sort buttons
    $$('.sort-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const field = btn.dataset.sort;
            if (sortField === field) {
                sortDir = sortDir === 'desc' ? 'asc' : 'desc';
            } else {
                sortField = field;
                sortDir = 'desc';
            }
            $$('.sort-btn').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            btn.textContent = field.charAt(0).toUpperCase() + field.slice(1) + (sortDir === 'desc' ? ' ↓' : ' ↑');
            renderTransactions();
        });
    });

    // Settings
    settingCurrency.addEventListener('change', handleCurrencyChange);
    settingBudget.addEventListener('change', handleBudgetChange);
    $('#exportCsvBtn').addEventListener('click', handleExportCSV);
    $('#importJsonBtn').addEventListener('click', handleImportJSON);
    $('#importFileInput').addEventListener('change', processImportFile);
    $('#resetDataBtn').addEventListener('click', handleResetData);

    // Keyboard: Esc closes modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (txModal.classList.contains('open')) closeModal(txModal, modalBackdrop);
            if (confirmModal.classList.contains('open')) closeModal(confirmModal, confirmBackdrop);
        }
    });

    // Chart resize
    window.addEventListener('resize', debounce(() => {
        if (currentView === 'dashboard') renderDashboard();
    }, 250));
}

// ────────────────────────────────────────
// AUTH
// ────────────────────────────────────────
function showApp() {
    authScreen.classList.add('hidden');
    appLayout.classList.remove('hidden');
    const session = getSession();
    if (session) {
        headerUser.textContent = session.email;
    }
    populateFormDropdowns();
    navigate('dashboard');
}

function showAuth() {
    authScreen.classList.remove('hidden');
    appLayout.classList.add('hidden');
    isSignUpMode = false;
    updateAuthMode();
}

function updateAuthMode() {
    authTitle.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
    authSubmitBtn.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
    authSwitchText.textContent = isSignUpMode ? 'Already have an account?' : "Don't have an account?";
    authSwitchBtn.textContent = isSignUpMode ? 'Sign In' : 'Sign Up';
    authConfirmGroup.classList.toggle('hidden', !isSignUpMode);
    clearAuthErrors();
}

function clearAuthErrors() {
    [authEmailError, authPasswordError, authConfirmError, authGeneralError].forEach((el) => {
        el.classList.add('hidden');
        el.textContent = '';
    });
    [authEmail, authPassword, authConfirmPassword].forEach((el) => el.classList.remove('error'));
}

function showAuthError(inputEl, errorEl, msg) {
    if (inputEl) inputEl.classList.add('error');
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    clearAuthErrors();

    const email = authEmail.value.trim();
    const password = authPassword.value;

    if (!email) {
        showAuthError(authEmail, authEmailError, 'Email is required.');
        return;
    }

    if (!password || password.length < 6) {
        showAuthError(authPassword, authPasswordError, 'Password must be at least 6 characters.');
        return;
    }

    if (isSignUpMode) {
        const confirm = authConfirmPassword.value;
        if (password !== confirm) {
            showAuthError(authConfirmPassword, authConfirmError, 'Passwords do not match.');
            return;
        }
        const result = await register(email, password);
        if (!result.success) {
            showAuthError(null, authGeneralError, result.error);
            return;
        }
    } else {
        const result = await login(email, password);
        if (!result.success) {
            showAuthError(null, authGeneralError, result.error);
            return;
        }
    }

    authForm.reset();
    showApp();
}

function handleLogout() {
    logout();
    showAuth();
}

function setupAuthListeners() {
    authForm.addEventListener('submit', handleAuthSubmit);
    authSwitchBtn.addEventListener('click', () => {
        isSignUpMode = !isSignUpMode;
        updateAuthMode();
    });
    logoutBtn.addEventListener('click', handleLogout);
}

// ────────────────────────────────────────
// INIT
// ────────────────────────────────────────
function init() {
    setupAuthListeners();
    setupEventListeners();

    if (isLoggedIn()) {
        showApp();
        // Sync with backend asynchronously
        pullFromCloud().then((changed) => {
            if (changed) {
                // If cloud data is different/newer, refresh the UI
                refreshCurrentView();
            }
        });
    } else {
        showAuth();
    }
}

init();

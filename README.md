# KV — Expense Tracker

A premium, matte-black expense tracker web app built with vanilla HTML, CSS, and JavaScript. Runs entirely in the browser with localStorage — no backend needed.

**Track smart. Spend calm.**

## Features

- **Transactions CRUD** — Add, edit, delete (with 5-second undo) income and expenses
- **Dashboard** — Monthly summary cards, category breakdown, daily spending trend chart (Canvas)
- **Budgeting** — Set monthly budget, progress bar with 80%/100% warning states
- **Filters & Search** — Filter by type, category, date range; search by note; sort by date or amount
- **Grouped Transactions** — Day-grouped list with subtotals, "Today"/"Yesterday" labels
- **Export CSV** — Download all transactions as a CSV file
- **Import JSON** — Import transactions with validation and error summary
- **Settings** — Currency symbol, monthly budget, data reset
- **Accessible** — Keyboard navigable, focus traps in modals, ARIA attributes, semantic HTML
- **Responsive** — Mobile-first layout with bottom nav & FAB; desktop layout with top nav
- **Offline** — All data persisted in localStorage, no network required
- **Matte Black Theme** — Premium design with teal accent, Inter + JetBrains Mono fonts

## How to Run

1. Open `index.html` in any modern browser (Chrome, Firefox, Safari, Edge).
2. That's it. No build step, no Node.js required.

For a local dev server (optional):
```bash
npx serve .
```

## Data Schema

### Storage Key: `expenseTracker:data`

```json
{
  "version": 1,
  "settings": {
    "currencySymbol": "₹",
    "locale": "en-IN",
    "startOfWeek": "Mon"
  },
  "budget": {
    "monthly": 0
  },
  "transactions": [
    {
      "id": "a1b2-c3d4-e5f6",
      "type": "expense",
      "amount": 250.00,
      "category": "Food & Dining",
      "date": "2025-03-15",
      "note": "Coffee with team",
      "paymentMethod": "UPI",
      "createdAt": "2025-03-15T10:30:00.000Z",
      "updatedAt": "2025-03-15T10:30:00.000Z"
    }
  ]
}
```

### Storage Versioning

The `version` field enables safe schema migrations. When the app loads:
1. Parse stored JSON
2. If `version < CURRENT_VERSION`, run `migrate()` to transform data
3. Save updated data back to localStorage
4. If data is corrupted, reset to defaults with a warning

## Manual Test Checklist

1. **Open app** — should show Dashboard with empty state and "Add Transaction" CTA
2. **Add expense** — click FAB/Add button → fill fields → Save → verify on dashboard & transactions
3. **Add income** — toggle type to Income → fill fields → Save → verify totals update
4. **Edit transaction** — click a row → change amount/category → Update → verify changes
5. **Delete transaction** — click row → Delete → verify toast with Undo → test Undo works
6. **Month navigation** — use ← → arrows to switch months → verify data filters correctly
7. **Set budget** — Settings → enter budget → go to Dashboard → verify progress bar
8. **Budget warnings** — add expenses exceeding 80% and 100% of budget → verify color changes
9. **Category breakdown** — verify top categories with bar chart on dashboard
10. **Daily trend chart** — verify bars appear for days with expenses
11. **Search** — go to Transactions → type in search box → verify filtering by note
12. **Filter by type** — select "Expenses" or "Income" → verify list updates
13. **Filter by date range** — set From/To dates → verify
14. **Sort** — click Date/Amount sort buttons → verify toggle asc/desc
15. **Export CSV** — Settings → Export → verify file downloads with correct data
16. **Import JSON** — Settings → Import → select valid JSON → verify import count
17. **Import invalid JSON** — import malformed file → verify error messages
18. **Currency change** — Settings → change symbol → verify formatting updates
19. **Reset data** — Settings → Reset → confirm → verify all data cleared
20. **Responsive** — resize browser to mobile width → verify bottom nav, FAB, layout
21. **Keyboard** — Tab through elements, Esc closes modals, Enter activates buttons/rows
22. **No console errors** — open DevTools Console → verify clean

## Project Structure

```
/index.html    — HTML layout with semantic structure
/styles.css    — Design system with CSS variables + component styles
/app.js        — Main application module (routing, views, events)
/storage.js    — localStorage CRUD + schema versioning + migrations
/utils.js      — Formatting, validation, sanitization, CSV helpers
/README.md     — This file
```

## Future Improvements

- Dark/light theme toggle
- Recurring transactions
- Multi-currency support with conversion
- PWA with service worker for install prompt
- Chart type options (line, cumulative)
- Custom categories management
- Data sync across devices (cloud backend)
- Drag-to-reorder payment methods

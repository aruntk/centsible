# Centsible

Personal finance tracker. Import bank statements or add transactions manually, auto-categorize with keyword rules, and view spending analytics — all stored locally in SQLite.

## Features

- Import transactions from HDFC bank statements or CSV files
- Add transactions manually
- Auto-categorization with customizable keyword and amount-based rules
- Spending analytics with charts and breakdowns
- Export/import categories and rules
- Desktop app for macOS (DMG) and Windows (NSIS installer)
- All data stored locally — nothing leaves your machine

## Prerequisites

- **Node.js** >= 20.9.0 (required by Next.js 16)
- **npm**
- **Python 3** with `setuptools` (needed to compile `better-sqlite3`)

## Install & Run (Web)

```bash
# Install dependencies (also rebuilds better-sqlite3 for your Node version)
npm install

# Start dev server
npm run dev
```

Open http://localhost:3000.

## Desktop App (Electron)

### Run locally

```bash
npm run electron:dev
```

Builds the Next.js app, compiles the Electron TypeScript, and opens a native window.

### Build macOS DMG

```bash
npm run electron:build
```

Output: `dist/Centsible-<version>-arm64.dmg`

Mount the DMG, drag Centsible to Applications, and launch. Data is stored in `~/Library/Application Support/Centsible/`.

### Build Windows installer

```bash
npm run electron:build:win
```

Output: `dist/Centsible Setup <version>.exe`

> Cross-compiling from macOS may fail for native modules. For reliable Windows builds, use a Windows machine or CI (e.g. GitHub Actions with `windows-latest`).

### Build all platforms

```bash
npm run electron:build:all
```

## Usage

### Importing transactions

1. **Bank statement**: Go to the Import page and upload an HDFC bank statement (CSV/text format).
2. **CSV file**: On the Transactions page, click "Import CSV". Download the template first to see the expected format.

Supported CSV columns (header names are flexible):

| Column | Aliases |
|---|---|
| Date | `date`, `txn date`, `transaction date` |
| Narration | `narration`, `description`, `particulars`, `remarks` |
| Withdrawal | `withdrawal`, `debit`, `debit amount` |
| Deposit | `deposit`, `credit`, `credit amount` |
| Closing Balance | `closing balance`, `balance` |
| Category | `category` |
| Merchant | `merchant`, `payee` |
| Ref No | `ref no`, `reference`, `cheque no` |

### Adding transactions manually

On the Transactions page, click "Add Transaction" to expand the form.

### Categorization rules

Go to the Categories page to:
- Add/edit keyword and amount-based rules
- Create new categories
- Re-categorize all existing transactions
- Export/import rules (includes categories)

You can also select text in the Narration column on the Transactions page to quickly add it as a rule.

### Exporting data

On the Transactions page, click "Export" to download all transactions as CSV.

### Reset data

On the Categories page, scroll to the Danger Zone section. Type `RESET` to confirm. This deletes all transactions, categories, and rules, then re-seeds the default categories and rules.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production Next.js build |
| `npm run start` | Start production server |
| `npm run electron:dev` | Build + run in Electron |
| `npm run electron:build` | Package macOS DMG |
| `npm run electron:build:win` | Package Windows installer |
| `npm run electron:build:all` | Package both platforms |

## Tech Stack

- Next.js 16 (App Router)
- React 19
- SQLite via better-sqlite3
- AG Grid for transaction tables
- Recharts for analytics
- Tailwind CSS 4
- Electron 33 + electron-builder

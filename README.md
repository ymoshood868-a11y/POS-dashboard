# POSDash — POS Transaction Dashboard

A responsive, full-featured Point-of-Sale transaction dashboard built for agents to track income, expenses, deposits, and withdrawals in real time — powered by a mock REST API via JSON Server.

> **Project code:** JS-01 | Tech Talent Academy Capstone Sprint

---

## Project Overview

POSDash is a team-built web application that allows POS agents to:
- Log in securely and access a protected dashboard
- View summarised financial statistics (income, expenses, deposits, withdrawals)
- Add, view, edit, and delete transactions
- Filter and search transaction history
- View revenue trends on a weekly bar chart
- Manage profile and app settings

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES Modules) |
| Charts | Chart.js v4 |
| Icons | Font Awesome 6 |
| Fonts | Google Fonts — Poppins |
| Mock API | JSON Server v0.17 |
| Version Control | Git / GitHub |

---

## Setup & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) v14 or higher
- npm (comes with Node.js)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/ymoshood868-a11y/POS-dashboard.git

# 2. Enter the project folder
cd POS-dashboard

# 3. Install dependencies (JSON Server)
npm install

# 4. Start the JSON Server mock API
npm run server
# Server runs at: http://localhost:3000

# 5. Open the app
# Open login.html in your browser
# Or use a local server extension (e.g. VS Code Live Server)
```

### Default Login
```
Email:    admin@posdash.com
Password: admin123
```
> In development mode, any valid email + password is accepted.

---

## API Endpoints (JSON Server)

Base URL: `http://localhost:3000`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/transactions` | List all transactions |
| POST | `/transactions` | Create a new transaction |
| PUT | `/transactions/:id` | Update a transaction |
| DELETE | `/transactions/:id` | Delete a transaction |
| GET | `/users` | Get users (auth) |
| GET/PUT | `/settings` | Get or update app settings |

---

## Project Structure

```
POS-dashboard/
├── login.html              # Login page (Module 1)
├── dashboard.html          # Dashboard overview (Module 1)
├── transactions.html       # Transaction history (Module 3)
├── new-transaction.html    # Add/Edit transaction (Module 2)
├── reports.html            # Reports & Analytics (Module 4)
├── settings.html           # Settings & Profile (Module 5)
├── db.json                 # JSON Server database
├── package.json
│
├── css/
│   ├── style.css           # Global variables & reset
│   ├── layout.css          # Shared layout (sidebar, navbar, footer)
│   ├── login.css           # Login page styles
│   ├── dashboard.css       # Dashboard page styles
│   └── responsive.css      # Responsive breakpoints
│
├── js/
│   ├── api.js              # Reusable API layer (shared)
│   ├── utils.js            # Shared utility functions
│   ├── layout.js           # Shared layout controller (sidebar, navbar)
│   ├── auth.js             # Login / authentication
│   ├── dashboard.js        # Dashboard page logic
│   └── logout.js           # Logout functionality
│
├── components/
│   ├── sidebar.html        # Reusable sidebar component
│   ├── navbar.html         # Reusable navbar component
│   └── footer.html         # Reusable footer component
│
└── assets/
    └── images/             # Project images
```

---

## Team Members & Modules

| Module | Developer | Responsibility |
|---|---|---|
| Module 1 | Yusuf (Team Lead) | Login, Dashboard, Layout system |
| Module 2 | TM 2 | New Transaction, Edit Transaction |
| Module 3 | TM 3 | Transaction History, Search, Filter |
| Module 4 | TM 4 | Reports & Analytics |
| Module 5 | TM 5 | Settings, Profile |

---

## Features Implemented

- ✅ Login page with email validation and localStorage session
- ✅ Protected dashboard with auth guard
- ✅ Summary cards: Total Income, Expenses, Deposits, Withdrawals
- ✅ Revenue Overview bar chart (Mon–Sun weekly)
- ✅ Recent Transactions table with status badges
- ✅ Net Profit and today's transaction count in welcome banner
- ✅ Collapsible sidebar with active state highlighting
- ✅ Top navbar with search, notifications, user dropdown
- ✅ Logout functionality
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ JSON Server mock API with users, transactions, settings
- ✅ Reusable layout system for all team modules

---

## Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| ≥ 1024px | Full desktop — sidebar expanded |
| 768px–1023px | Tablet — sidebar collapses to overlay |
| < 480px | Mobile — single column, stacked layout |

---

## Live Demo

> _Link will be added after deployment to Vercel/Netlify_

---

## Screenshots

> _Screenshots will be added before final submission_

---

*Tech Talent Academy — JS-01 Capstone Project © 2025*

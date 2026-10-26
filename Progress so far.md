# DocClear Project: Progress So Far

Welcome to the **DocClear Management System**! This document is a beginner-friendly guide to everything we've built so far. It explains what each file does, why we wrote the code the way we did, and how you can get everything running on your computer.

---

## 📂 Project Structure

Here is how your project is organized. Think of the **backend** as the "brain" (handles data and logic) and the **frontend** as the "face" (what the user sees).

```
DocClear/
├── docker-compose.yml           # Runs the MySQL database in a "container"
├── backend/                     # The API (Brain)
│   ├── config/
│   │   └── database.js          # Connects the app to your MySQL database
│   ├── controllers/             # The logic (The "Doers")
│   │   ├── auth.controller.js   # Handles Login/Logout logic
│   │   ├── wallet.controller.js # Handles Money/Balance logic
│   │   └── customer.controller.js # Handles CRM/Customer logic
│   ├── middleware/              # Security guards (Check if user is logged in)
│   │   └── auth.middleware.js
│   ├── models/                  # Database structure (The "Blueprints")
│   │   ├── User.js              # What a "User" looks like
│   │   ├── Customer.js          # What a "Client/Company" looks like
│   │   ├── WalletAccount.js     # What a "Bank/Cash account" looks like
│   │   └── WalletTransaction.js # What a "Receipt/Transaction" looks like
│   ├── routes/                  # The "Doors" to our API (URLs)
│   │   ├── auth.routes.js       # Paths like /api/v1/auth/login
│   │   ├── wallet.routes.js     # Paths like /api/v1/wallet/accounts
│   │   └── customer.routes.js   # Paths like /api/v1/customers
│   ├── validators/              # Input checkers (Ensures data is correct)
│   │   ├── auth.validators.js
│   │   └── customer.validators.js
│   ├── app.js                   # The starting point of the backend
│   ├── package.json             # List of backend tools (libraries)
│   └── .env.example             # Template for secret keys and config
└── frontend/                    # The Website (Face)
    ├── components/              # Small, reusable parts of the UI
│   │   ├── wallet/
│   │   │   └── TransferDialog.vue # The popup for moving money
│   │   └── customers/
│   │       └── CustomerForm.vue # The popup for adding/editing clients
│   ├── layouts/                 # Page frames
│   │   └── default.vue          # The Sidebar and Topbar seen on every page
│   ├── middleware/              # Permission checks (Redirects to login)
│   │   └── auth.global.ts
│   ├── pages/                   # The actual pages you visit
│   │   ├── index.vue            # Dashboard (The Home Page)
│   │   ├── login.vue            # Login Page
│   │   ├── customers/
│   │   │   ├── index.vue        # Customer List Page
│   │   │   └── [id].vue         # Customer Profile/Details Page
│   │   └── wallet/
│   │       └── index.vue        # Wallet/Bank Management Page
│   ├── plugins/                 # Add-ons for the frontend
│   │   └── axios.js             # Setup for "Axios" (How the FE talks to the BE)
│   ├── stores/                  # Global data storage (State)
│   │   ├── auth.js              # Remembers if you are logged in
│   │   └── wallet.js            # Remembers your balances and transactions
│   ├── composables/             # Reusable UI logic
│   │   └── useWhatsApp.js       # Logic for sending WhatsApp messages
    ├── nuxt.config.ts           # Main configuration for the frontend
    └── package.json             # List of frontend tools (libraries)
```

---

## 🧠 Logic & Explanations (The "Why")

### 1. The Backend (Brain)

#### **`backend/app.js`**
*   **What**: The entry point.
*   **Logic**: It sets up security (Helmet), allows the frontend to talk to it (CORS), and connects all the "Doors" (Routes).
*   **Why**: We need a central place to start the server and apply settings that affect everything.

#### **`backend/config/database.js`**
*   **What**: Database connection.
*   **Logic**: Uses a tool called **Sequelize** to talk to MySQL.
*   **Why**: It's easier to write JavaScript to talk to a database than raw SQL code.

#### **`backend/models/ (User, WalletAccount, WalletTransaction)`**
*   **What**: These files define how our data is stored.
*   **User Logic**: We hash (scramble) passwords using **bcrypt**. We never store "123456" in the database; we store a long string of gibberish for safety.
*   **Wallet Logic**: We established that `WalletTransaction` is our "truth." We don't just update a number; we record every movement (+ or -).
*   **Why**: It's safer to have records of every transaction so we can calculate balances accurately anytime.

#### **`backend/controllers/wallet.controller.js`**
*   **What**: The "Brain" of the wallet.
*   **The Transfer Logic**: When you move money from "Cash" to "Bank," this controller:
    1.  Checks if you have enough money.
    2.  Starts a "Transaction" (this ensures either BOTH entries are created, or NEITHER, so money doesn't disappear).
    3.  Creates an "Out" entry for Cash.
    4.  Creates an "In" entry for Bank.
*   **Why**: Database transactions prevent "half-done" operations if the power goes out mid-save.

---

### 2. The Frontend (Face)

#### **`frontend/stores/auth.js` & `wallet.js`**
*   **What**: These are powered by **Pinia**.
*   **Logic**: They take data from the Backend and store it in a way all pages can see. `auth.js` keeps your "Token" (your digital key).
*   **Why**: Without these, every time you switched pages, the app would forget who you are or what your balance is.

#### **`frontend/plugins/axios.js`**
*   **What**: The communication bridge.
*   **Logic**: It "intercepts" every request we send to the backend and automatically attaches your "Token" (JWT) to the header.
*   **Why**: This saves us from having to manually add the security key in every single piece of code we write.

#### **`frontend/middleware/auth.global.ts`**
*   **What**: The door lock.
*   **Logic**: Every time you move to a new page, it checks "Is there a token?". If no $\rightarrow$ send to login.
*   **Why**: To prevent strangers from seeing your financial data by just typing a URL.

#### **`frontend/pages/wallet/index.vue`**
*   **What**: The wallet dashboard.
*   **Logic**: It fetches the list of accounts and the last 10 transactions. It uses "Computed Balances" which means it asks the backend to calculate the sum from the ledger.
*   **Why**: This is more accurate than just storing a static number that might get out of sync.

### 3. The Customer Module (CRM)

#### **`backend/controllers/customer.controller.js`**
*   **What**: Handles all customer data.
*   **Logic**: Performs "Fuzzy Search" (finding names even with partial matches) and "Soft Deletion" (marking as inactive instead of wiping data).
*   **Why**: You never want to accidentally delete a customer who still has unpaid bills!

#### **`frontend/composables/useWhatsApp.js`**
*   **What**: A helper for WhatsApp messaging.
*   **Logic**: It formats phone numbers into a link that opens WhatsApp directly.
*   **Why**: This makes it 1-click for the staff to remind a customer about their visa expiry.

---

## 🚀 How to Run the Project

Since you already have MySQL running locally:

### 1. Backend Setup
1.  Open a terminal in the `backend` folder.
2.  Install dependencies: `npm install`
3.  Copy `.env.example` to a new file named `.env`.
4.  Open `.env` and put your MySQL username and password there.
5.  Run it: `npm run dev` (This starts the server on `http://127.0.0.2:5000`).

### 2. Frontend Setup
1.  Open a NEW terminal in the `frontend` folder.
2.  Install dependencies: `npm install`
3.  Run it: `npm run dev` (This starts the website on `http://127.0.0.2:3000`).
4.  Open your browser to `http://127.0.0.2:3000`.

---

## 📝 The Prompts We Used

1.  **Prompt 0 (Bootstrap)**: "Build the skeleton of DocClear... setup Nutx 3, Node, and MySQL."
2.  **Prompt 1 (Auth)**: "Build the Login system... generate secure keys (JWT) and protect pages."
3.  **Prompt 2 (Customer)**: "Build the CRM... manage client list and WhatsApp integration."
4.  **Prompt 7 (Wallet)**: "Build the Bank/Cash management... track every single transaction and allow transfers."

---

1.  **Prompt 2 (Customer Module)**: COMPLETED. Centralized client management with WhatsApp integration.
2.  **Prompt 3 (Document Module)**: COMPLETED. Kanban and Calendar views for tracking expiring documents.
3.  **Prompt 4 (Service Module)**: COMPLETED. Workflow management for service orders with auto-invoicing.
4.  **Prompt 5 (Invoices)**: COMPLETED. PDF generation and financial tracking for billing.
5.  **Prompt 6 (Expenses)**: COMPLETED. Tracking operational costs and balancing with wallet accounts.
6.  **Prompt 7 (Wallet)**: COMPLETED. Triple-entry bookkeeping for cash and bank accounts.
7.  **Prompt 8 (Dashboard)**: COMPLETED. Real-time insights and alerts across all modules.
8.  **Prompt 9 (Reports)**: COMPLETED. Financial trends and service-based profit analytics.
9.  **Prompt 10 (Production Hardening)**: COMPLETED. Migrations, Refresh Tokens (HttpOnly), and Granular RBAC.

---

> [!TIP]
> **Pro-Tip for Newbies**: If you see an error like `401 Unauthorized`, it usually means your login token expired or wasn't sent. Check `localStorage` in your browser!

**You are doing great! Keep this file as a map.**

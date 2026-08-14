# 🏢 IPO Syndicate — Deal & Capital Allocation Tracker

A production-ready web application for tracking per-IPO investment deals, capital allocations, and proportional profit distributions among a group of investors.

---

## ✨ Features & Architecture

- **Per-IPO Deal Syndication** — Track investments on a per-deal basis rather than a global continuous pool.
- **Strict Proportional Profit Distribution** — Payouts are strictly calculated based on the user's capital contribution ratio for that specific deal:
  - `User Share % = User Invested / Total Invested in IPO`
  - `User Profit = Total Net Profit * User Share %`
- **Email & Password Authentication** — Built with Firebase Auth (Email/Password).
- **Admin / User Role Separation** — Controlled via `isAdmin: boolean` flag on the `users` Firestore document.
- **Admin Panel** — Create IPO deals, allocate capital by selecting registered user emails, monitor running totals, and resolve deals upon sale.
- **User Dashboard** — Read-only personal view of participated IPOs, invested amounts, ownership shares, deal status, and realized profit/loss.

---

## 🗄️ Firestore Database Schema

### `users`
- `uid`: string (Document ID)
- `email`: string
- `displayName`: string
- `isAdmin`: boolean
- `createdAt`: Timestamp

### `ipos`
- `id`: string (Document ID)
- `name`: string
- `issuePrice`: number
- `lotSize`: number
- `openDate`: string
- `closeDate`: string
- `status`: `'OPEN' | 'APPLIED' | 'ALLOTTED' | 'SOLD'`
- `totalInvested`: number (Calculated total capital allocated)
- `netProfit`: number (Entered by admin upon sale)
- `createdAt`: Timestamp

### `ipo_investments`
- `id`: string (Document ID)
- `ipoId`: string
- `uid`: string
- `userEmail`: string
- `userDisplayName`: string
- `investedAmount`: number
- `profitEarned`: number (Calculated upon deal resolution)

---

## 🔒 Setting Up Your Admin User

1. Register a new user using the Sign Up form in the app.
2. Open **Firebase Console → Firestore Database → `users` collection**.
3. Locate your user document (ID matches Auth `uid`).
4. Set `isAdmin` to `true` (boolean).
5. Refresh the app — you will now see the **Admin Panel** link in the navigation sidebar!

---

---

## 🚀 Deployment to Vercel (100% Free)

### Option 1: Via Vercel CLI (Fastest)

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```
2. Deploy to Production:
   ```bash
   vercel --prod
   ```
3. Follow the CLI prompts. When prompted for environment variables, add your `NEXT_PUBLIC_FIREBASE_*` keys from `.env.local`.

### Option 2: Via GitHub + Vercel Dashboard

1. Push your repository to GitHub.
2. Go to [Vercel New Project](https://vercel.com/new).
3. Import your GitHub repository.
4. Under **Environment Variables**, add all 6 `NEXT_PUBLIC_FIREBASE_*` keys:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
5. Click **Deploy**.

---

## 🔑 Crucial Step for Google Sign-In on Vercel

Once deployed, Vercel gives you a production domain (e.g. `your-app-name.vercel.app`).
To allow Google Sign-In on your Vercel URL:

1. Go to [Firebase Console](https://console.firebase.google.com/) → **Authentication** → **Settings** → **Authorized domains**.
2. Click **Add domain**.
3. Type in your Vercel domain (e.g. `your-app-name.vercel.app`).
4. Click **Save**.


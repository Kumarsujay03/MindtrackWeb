MindTrack Web
=============

A modern, privacy-conscious web app for focused studying and habit building. Includes an admin dashboard, user verification, a streak-based leaderboard, tasks, stopwatch/flowtime timers, and profile management with avatars.

Live: https://mindtrack-web.vercel.app/


Features
--------
- Firebase Auth (Google) with Firestore user profiles
- Admin dashboard: verify/unverify, search, and manage users
- Turso (libSQL) integration for questions, progress, and leaderboard
- Accurate streak tracking with per-day stats and tie-breakers
- Leaderboard for verified users with avatars and “jump to my rank”
- Profile page with avatar picker, DOB, and usernames
- Consistent site-wide date format (DD-MM-YYYY)
- Static Privacy Policy page, linked from Profile


Tech stack
----------
- React + Vite + TypeScript
- Tailwind (utility-first styles) and Radix UI primitives
- Firebase (Auth + Firestore)
- Turso (libSQL) via serverless API routes
- Vercel deployment with SPA rewrites


Project structure
-----------------

Top-level
- `index.html` — Vite entry
- `vite.config.ts` — Vite config plus local dev API middleware
- `vercel.json` — SPA rewrites and serverless config
- `public/` — static assets (logo, robots, sitemap, PrivacyPolicy.html)

Src highlights
- `src/pages/` — main pages (Dashboard, Leaderboard, Profile, Questions, UserTasks)
- `src/features/Auth/` — auth context, protected routes, hooks
- `src/components/` — UI building blocks (navigation, theme, Starfield, etc.)
- `src/lib/` — Firebase init and utilities (`formatDateDMY`)


Environment variables
---------------------

Client (Vite): define in `.env.local`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`

Server (Vercel project settings)
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`


Local development
-----------------
1. Install dependencies
   - npm install
2. Configure `.env.local` with your Firebase values
3. Start the dev server
   - npm run dev
4. Open http://localhost:5173


Build and preview
-----------------
- Build: npm run build
- Preview: npm run preview


APIs (serverless)
-----------------

All routes live under `/api/*` and use Turso (libSQL). In dev, the Vite config wires local handlers for parity.

- GET `/api/users` — Admin list and search
  - Query: `q?`, `limit?`, `offset?`
  - Response: `{ ok, total, limit, offset, columns, rows }`

- GET `/api/leaderboard` — Leaderboard for verified users
  - Query: `limit?`, `offset?`, `user_id?`
  - Response: `{ ok, total, limit, offset, rows, my? }`

- GET `/api/user-stats` — Per-user counters for mobile/app dashboard

- POST `/api/verify-user` — Admin verification write-through to Turso (uniqueness enforced)

- POST `/api/delete-user` — Admin: clear user in Turso


Admin dashboard
---------------
- Verify/unverify applicants, with reasons and violation counts
- View Turso users with pagination and search
- Keep usernames unique (Firestore checks + Turso constraints)


Profile and privacy
-------------------
- Profile: avatar picker (from a curated Firestore document), DOB, usernames
- Privacy: `public/PrivacyPolicy.html` (linked from Profile, opens in a new tab)
- Date format: `formatDateDMY` utility ensures DD-MM-YYYY across UI


Security & data safety
----------------------
- Auth flows do not write to Firestore on login/logout
- Writes are targeted (`updateDoc`) and non-destructive
- New docs use `setDoc(..., { merge: true })` where applicable
- Turso secrets are only used server-side in API routes


Deployment
----------
- Vercel with `vercel.json` SPA rewrites
  - `/(api/*)` → serverless
  - All other routes without file extensions → `/`
- Static assets under `public/` are served as-is (e.g., `/PrivacyPolicy.html`)


Contributing
------------
1. Create a feature branch
2. Make focused commits
3. Run lint and build locally
4. Open a PR with a clear summary of changes


License
-------
MIT


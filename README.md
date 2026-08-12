# My Home — Family Digital Vault (MERN)

A MERN scaffold of the design preview: React (Vite) frontend + Express/MongoDB
backend. The **Grocery List** is fully wired to a real database — add an item
from your phone, and it's there when anyone else on the family loads the app.
Dashboard, Vault, Folder, and Expenses screens fetch from real API endpoints
too, but those endpoints currently return static demo data (see
`server/src/routes/familyRoutes.js`) rather than a database — that's the
fastest way to get every screen rendering real fetched data without first
building out five more Mongoose models. Grocery is the template to follow
when you're ready to make the others real collections.

## What's real vs. mocked

| Feature | Status |
|---|---|
| Grocery list (add / check off / list) | **Real** — MongoDB via Mongoose, `GroceryItem` model |
| Dashboard, Member Profile, Folder, Expenses | Served from Express, but from static in-memory data, not a DB |
| Family AI, auth, file upload, real-time sync, notifications | Not built — see the original spec for what's still ahead |

## Prerequisites

- Node.js 18+ and npm
- MongoDB running locally, **or** a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) cluster

### Installing MongoDB locally (pick one)

**macOS (Homebrew)**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Windows / Linux** — follow MongoDB's official install guide for your OS:
https://www.mongodb.com/docs/manual/administration/install-community/

**Or skip installing anything** — create a free cluster at
https://www.mongodb.com/cloud/atlas/register and use its connection string
instead (see `.env` setup below).

## 1. Start the backend

```bash
cd server
cp .env.example .env
# Edit .env if you're using Atlas — paste your connection string into MONGODB_URI

npm install
npm run seed   # optional: pre-fills the grocery list with demo items
npm run dev    # starts on http://localhost:5000
```

You should see:
```
MongoDB connected -> mongodb://127.0.0.1:27017/my-home
API running on http://localhost:5000
```

Sanity check: open http://localhost:5000/api/health — you should see `{"status":"ok"}`.

## 2. Start the frontend

In a **new terminal**:

```bash
cd client
npm install
npm run dev    # starts on http://localhost:5173
```

Open http://localhost:5173 — the app talks to the API automatically (Vite
proxies `/api` requests to `http://localhost:5000`, configured in
`client/vite.config.js`).

## Try it

1. Go to the **Grocery** tab, add an item, refresh the page — it's still there (real persistence).
2. Open the app in two browser tabs, add an item in one, refresh the other — same list (real shared data, not per-browser state).
3. Check MongoDB directly: `mongosh my-home --eval "db.groceryitems.find().pretty()"`

## Project structure

```
my-home-mern/
├── server/
│   ├── src/
│   │   ├── index.js              # Express app entry
│   │   ├── config/db.js          # Mongoose connection
│   │   ├── models/GroceryItem.js # the one real collection
│   │   ├── routes/
│   │   │   ├── groceryRoutes.js  # GET/POST/PATCH/DELETE — real DB
│   │   │   └── familyRoutes.js   # static demo data for other screens
│   │   └── seed.js               # optional demo data seeder
│   └── .env.example
└── client/
    ├── src/
    │   ├── App.jsx                # screen routing (no router lib needed yet)
    │   ├── api.js                 # fetch wrapper for the backend
    │   ├── index.css              # design tokens — mint/purple palette, Fraunces + Manrope
    │   ├── components/            # TabBar, icons
    │   └── screens/               # Dashboard, Profile, Folder, Expenses, Grocery, FamilyAI
    └── vite.config.js
```

## Next steps toward the full spec

The original brief (family auth, roles, real document upload to S3/Cloudinary,
OCR search, real-time sync via Socket.IO, bill reminders, live location, SOS,
audit logs) is a much larger build. To extend this scaffold:

1. **Auth** — add a `User` model, JWT or session-based auth, and protect routes with middleware.
2. **Real document storage** — add a `Document` and `DocumentGroup` model, wire an S3 or Cloudinary SDK for uploads, store only the URL + metadata in Mongo.
3. **Real-time** — add `socket.io` on the server and `socket.io-client` on the frontend; emit an event on every grocery/expense change instead of relying on manual refresh.
4. **Everything else in familyRoutes.js** — swap the static objects for real Mongoose models one at a time, following the exact pattern `groceryRoutes.js` already uses.

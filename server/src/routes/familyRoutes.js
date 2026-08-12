import { Router } from "express";

const router = Router();

// This route intentionally returns static demo data instead of hitting
// MongoDB — it exists so the client screens (Dashboard, Profile, Folder,
// Expenses) have something real to fetch. Grocery is the fully DB-backed
// example (see groceryRoutes.js); follow that same pattern (Mongoose model
// + router) to make Members, Documents, and Expenses real collections.

const family = {
  name: "Reddy Family",
  familyId: "FAM-933045",
  stats: { documents: 248, monthlySpend: 42300 },
  alert: {
    title: "Aadhaar for Ravi expires in 14 days",
    detail: "Renew before Aug 13 to avoid delays",
  },
  quote: "A family's paperwork, kept the way a family remembers it.",
};

const members = [
  { id: "chandrakala", name: "Chandrakala", relation: "Mother", online: true, color: "#7C3AED" },
  { id: "ravi", name: "Ravi", relation: "Father", online: true, color: "#3FB6A3" },
  { id: "sindhu", name: "Sindhu", relation: "Daughter", online: false, color: "#F5A623" },
  { id: "lakshmi", name: "Lakshmi", relation: "Grandmother", online: false, color: "#FF7A6E" },
];

const documentGroups = {
  chandrakala: [
    { name: "Identity", count: 3, updated: "2d ago", sharedWith: "Family" },
    { name: "Banking", count: 4, updated: "5d ago", sharedWith: "Private" },
    { name: "Education", count: 3, updated: "3w ago", sharedWith: "Family" },
    { name: "Medical", count: 5, updated: "1d ago", sharedWith: "Parents only" },
    { name: "Property", count: 2, updated: "2mo ago", sharedWith: "Family" },
  ],
};

const recentUploads = [
  { name: "Aadhaar — Chandrakala.pdf", group: "Identity", when: "2 min ago" },
  { name: "SBI Passbook.pdf", group: "Banking", when: "Yesterday" },
];

const expenses = {
  total: 42300,
  breakdown: [
    { label: "Education", percent: 45 },
    { label: "Bills", percent: 25 },
    { label: "Other", percent: 30 },
  ],
  byPerson: [
    { member: "Chandrakala", note: "Groceries, hostel fee", amount: 19400 },
    { member: "Ravi", note: "Electricity, fuel", amount: 8100 },
    { member: "Sindhu", note: "Hostel fee", amount: 14800 },
  ],
  upcomingBills: [
    { name: "Insurance premium — LIC", dueIn: "5 days", amount: 6200 },
    { name: "School fee — Sindhu", dueIn: "12 days", amount: 9000 },
  ],
};

router.get("/", (req, res) => res.json(family));
router.get("/members", (req, res) => res.json(members));
router.get("/members/:id/documents", (req, res) =>
  res.json(documentGroups[req.params.id] || [])
);
router.get("/uploads/recent", (req, res) => res.json(recentUploads));
router.get("/expenses", (req, res) => res.json(expenses));

export default router;

// Optional: run `npm run seed` to pre-populate the grocery list so the
// demo isn't empty on first load.
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import GroceryItem from "./models/GroceryItem.js";
import mongoose from "mongoose";

dotenv.config();

const FAMILY_ID = "FAM-933045";

const items = [
  { name: "Milk, 2 packs", addedBy: { name: "Chandrakala", color: "#7C3AED" } },
  { name: "Rice — 10kg bag", addedBy: { name: "Ravi", color: "#3FB6A3" } },
  { name: "Tomatoes", addedBy: { name: "Sindhu", color: "#F5A623" }, checked: true },
  { name: "Cooking oil", addedBy: { name: "Chandrakala", color: "#7C3AED" } },
  { name: "Hostel snacks for Sindhu", addedBy: { name: "Lakshmi", color: "#FF7A6E" } },
];

async function run() {
  await connectDB();
  await GroceryItem.deleteMany({ familyId: FAMILY_ID });
  await GroceryItem.insertMany(
    items.map((item, i) => ({ ...item, familyId: FAMILY_ID, order: Date.now() - i }))
  );
  console.log(`Seeded ${items.length} grocery items for ${FAMILY_ID}`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

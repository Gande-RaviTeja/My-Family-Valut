import mongoose from "mongoose";

const groceryItemSchema = new mongoose.Schema(
  {
    familyId: {
      type: String,
      required: true,
      default: "FAM-933045", // single-family demo; swap for req.user's family in production
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    checked: {
      type: Boolean,
      default: false,
    },
    addedBy: {
      name: { type: String, required: true },
      color: { type: String, default: "#7C3AED" },
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("GroceryItem", groceryItemSchema);

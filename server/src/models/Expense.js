import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    familyId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    dueIn: { type: String, default: "3 days" },
    paid: { type: Boolean, default: false },
    addedBy: { type: String, default: "User" },
    category: { type: String, default: "Bills" },
  },
  { timestamps: true }
);

export default mongoose.model("Expense", expenseSchema);

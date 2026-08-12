import { Router } from "express";
import Expense from "../models/Expense.js";

const router = Router();

// GET all bills / expenses for a family
router.get("/family/:familyId", async (req, res, next) => {
  try {
    const { familyId } = req.params;
    const bills = await Expense.find({ familyId }).sort({ createdAt: -1 });
    res.json(bills);
  } catch (err) {
    next(err);
  }
});

// POST add new bill / expense
router.post("/", async (req, res, next) => {
  try {
    const { familyId, name, amount, dueIn, paid, addedBy, category } = req.body;
    if (!familyId || !name || amount === undefined) {
      return res.status(400).json({ message: "familyId, name, and amount are required" });
    }

    const newBill = await Expense.create({
      familyId,
      name: name.trim(),
      amount: Number(amount),
      dueIn: dueIn || "3 days",
      paid: Boolean(paid),
      addedBy: addedBy || "User",
      category: category || "Bills",
    });

    res.status(201).json(newBill);
  } catch (err) {
    next(err);
  }
});

// PATCH toggle paid status for a bill
router.patch("/:id/toggle", async (req, res, next) => {
  try {
    const bill = await Expense.findById(req.params.id);
    if (!bill) return res.status(404).json({ message: "Bill not found" });

    bill.paid = !bill.paid;
    await bill.save();
    res.json(bill);
  } catch (err) {
    next(err);
  }
});

// DELETE a bill
router.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await Expense.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Bill not found" });
    res.json({ message: "Bill deleted", id: req.params.id });
  } catch (err) {
    next(err);
  }
});

export default router;

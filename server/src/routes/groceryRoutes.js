import { Router } from "express";
import GroceryItem from "../models/GroceryItem.js";

const router = Router();
const DEFAULT_FAMILY_ID = "FAM-933045";

// GET /api/grocery — everyone in the family sees the same list
router.get("/", async (req, res, next) => {
  try {
    const familyId = req.query.familyId || DEFAULT_FAMILY_ID;
    const items = await GroceryItem.find({ familyId }).sort({
      checked: 1,
      order: -1,
      createdAt: -1,
    });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// POST /api/grocery — any family member can add an item
router.post("/", async (req, res, next) => {
  try {
    const { name, addedBy, familyId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Item name is required" });
    }
    if (!addedBy?.name) {
      return res.status(400).json({ message: "addedBy.name is required" });
    }

    const item = await GroceryItem.create({
      familyId: familyId || DEFAULT_FAMILY_ID,
      name: name.trim(),
      addedBy: { name: addedBy.name, color: addedBy.color || "#7C3AED" },
      order: Date.now(),
    });

    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/grocery/:id/toggle — any family member can check/uncheck
router.patch("/:id/toggle", async (req, res, next) => {
  try {
    const item = await GroceryItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    item.checked = !item.checked;
    await item.save();
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/grocery/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const item = await GroceryItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;

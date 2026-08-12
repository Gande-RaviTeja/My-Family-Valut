import { Router } from "express";
import Document from "../models/Document.js";

const router = Router();

// GET all documents for a family
router.get("/family/:familyId", async (req, res) => {
  try {
    const { familyId } = req.params;
    const documents = await Document.find({ familyId }).sort({ createdAt: -1 });
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch family documents: " + error.message });
  }
});

// GET search documents across family members
router.get("/search/:familyId", async (req, res) => {
  try {
    const { familyId } = req.params;
    const q = req.query.q || "";
    const filter = { familyId };

    if (q.trim()) {
      const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter.$or = [
        { name: regex },
        { category: regex },
        { member: regex },
        { uploadedBy: regex },
      ];
    }

    const documents = await Document.find(filter).sort({ createdAt: -1 });
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: "Failed to search documents: " + error.message });
  }
});

// GET documents for a specific family member
router.get("/member/:familyId/:member", async (req, res) => {
  try {
    const { familyId, member } = req.params;
    const documents = await Document.find({ familyId, member: new RegExp(`^${member}$`, "i") }).sort({ createdAt: -1 });
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch member documents: " + error.message });
  }
});

// POST create a new document in MongoDB
router.post("/", async (req, res) => {
  try {
    const { name, category, member, familyId, privacy, fileSize, fileUrl, uploadedBy } = req.body;

    if (!name || !category || !member || !familyId) {
      return res.status(400).json({ message: "Name, category, member, and familyId are required." });
    }

    const newDoc = await Document.create({
      name: name.trim(),
      category,
      member: member.trim(),
      familyId: familyId.trim(),
      privacy: privacy || "Shared with family",
      fileSize: fileSize || "1.2 MB",
      fileUrl: fileUrl || "",
      uploadedBy: uploadedBy || member,
    });

    res.status(201).json(newDoc);
  } catch (error) {
    res.status(500).json({ message: "Failed to create document: " + error.message });
  }
});

// DELETE a document from MongoDB
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Document.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Document not found" });
    }
    res.json({ message: "Document deleted successfully", id });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete document: " + error.message });
  }
});

export default router;

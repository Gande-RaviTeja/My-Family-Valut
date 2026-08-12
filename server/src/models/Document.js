import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ["Identity", "Banking", "Education", "Medical", "Property"],
      required: true,
    },
    member: {
      type: String,
      required: true,
      trim: true,
    },
    familyId: {
      type: String,
      required: true,
      index: true,
    },
    privacy: {
      type: String,
      enum: ["Shared with family", "Parents only", "Private"],
      default: "Shared with family",
    },
    fileSize: {
      type: String,
      default: "1.2 MB",
    },
    fileUrl: {
      type: String,
      default: "",
    },
    uploadedBy: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Document", documentSchema);

import mongoose from "mongoose";
import crypto from "crypto";

const familySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    familyName: {
      type: String,
      trim: true,
    },
    inviteCode: {
      type: String,
      unique: true,
      sparse: true,
      default: () => "FAM-" + crypto.randomBytes(3).toString("hex").toUpperCase(),
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Family", familySchema);


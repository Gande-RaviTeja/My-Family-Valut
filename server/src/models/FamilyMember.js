import mongoose from "mongoose";

const familyMemberSchema = new mongoose.Schema(
  {
    familyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Family",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["admin", "member"],
      default: "member",
    },
    permission: {
      type: String,
      enum: ["Full Access", "View Only"],
      default: "Full Access",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Prevent duplicate membership of the same user in the same family
familyMemberSchema.index({ familyId: 1, userId: 1 }, { unique: true });

export default mongoose.model("FamilyMember", familyMemberSchema);

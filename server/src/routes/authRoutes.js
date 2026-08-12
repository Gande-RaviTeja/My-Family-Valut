import express from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import User from "../models/User.js";
import Family from "../models/Family.js";
import Invitation from "../models/Invitation.js";
import FamilyMember from "../models/FamilyMember.js";
import { generateVerificationEmailHTML, generateInvitationEmailHTML } from "../utils/emailTemplates.js";
import { sendEmail } from "../utils/mailer.js";

const router = express.Router();
const AVATAR_COLORS = ["#7C3AED", "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#EC4899"];

function generateSecureToken() {
  return crypto.randomBytes(32).toString("hex");
}

// --------------------------------------------------
// 1. Create Family (Primary Registration)
// --------------------------------------------------
router.post("/create-family", async (req, res, next) => {
  try {
    const { name, familyName, email, password, confirmPassword } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Full Name, Email, and Password are required." });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }

    const cleanEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      if (existingUser.emailVerified || existingUser.isVerified) {
        return res.status(400).json({
          message: `An account with ${cleanEmail} is already registered. Please sign in instead.`,
        });
      }

      // If user account exists but is unverified, remove stale unverified user & family records
      if (existingUser.familyId) {
        await Family.deleteOne({ _id: existingUser.familyId });
        await FamilyMember.deleteMany({ familyId: existingUser.familyId });
      }
      await User.deleteOne({ _id: existingUser._id });
    }


    const cleanFamilyName = (familyName && familyName.trim()) ? familyName.trim() : `${name.trim()}'s Family`;

    // Create User (emailVerified = false)
    const verificationToken = generateSecureToken();
    const userColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password,
      role: "admin",
      color: userColor,
      emailVerified: false,
      isVerified: false,
      verificationToken,
      verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    // Create Family
    const family = await Family.create({
      name: cleanFamilyName,
      familyName: cleanFamilyName,
      createdBy: user._id,
    });

    user.familyId = family._id;
    await user.save();

    // Add to FamilyMember
    await FamilyMember.create({
      familyId: family._id,
      userId: user._id,
      role: "admin",
    });

    // Send Verification Email
    const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
    const verificationUrl = `${clientOrigin}/verify-email?token=${verificationToken}`;
    const html = generateVerificationEmailHTML({ name: name.trim(), verificationUrl });
    
    sendEmail({
      to: cleanEmail,
      subject: "Verify your My Home account",
      html,
    }).catch((err) => console.error("Error sending verification email:", err));

    res.status(201).json({
      success: true,
      email: cleanEmail,
      verificationToken,
      message: "We've sent a verification link to your email address. Please verify your email before signing in.",
    });

  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------
// 2. Invite Member (Admin Action)
// --------------------------------------------------
router.post("/invite-member", async (req, res, next) => {
  try {
    const { familyId, email, inviterUserId } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ message: "Email address is required to send an invitation." });
    }

    if (!familyId || !mongoose.Types.ObjectId.isValid(familyId)) {
      return res.status(400).json({ message: "Valid Family ID is required." });
    }

    const family = await Family.findById(familyId);
    if (!family) {
      return res.status(404).json({ message: "Family portal not found." });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user is already in any family
    const existingMemberUser = await User.findOne({ email: cleanEmail });
    if (existingMemberUser && existingMemberUser.familyId) {
      const existingFamily = await Family.findById(existingMemberUser.familyId);
      const existingFamilyName = existingFamily ? (existingFamily.name || existingFamily.familyName) : "another family";
      if (existingMemberUser.familyId.toString() === family._id.toString()) {
        return res.status(400).json({
          message: `${cleanEmail} is already a member of "${family.name || family.familyName}".`,
        });
      } else {
        return res.status(400).json({
          message: `${cleanEmail} is already a registered member of "${existingFamilyName}". A user cannot belong to multiple families.`,
        });
      }
    }

    // Check / update invitation record
    const token = generateSecureToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    let invitation = await Invitation.findOne({ familyId: family._id, email: cleanEmail });
    if (invitation) {
      invitation.token = token;
      invitation.status = "Pending";
      invitation.expiresAt = expiresAt;
      if (inviterUserId && mongoose.Types.ObjectId.isValid(inviterUserId)) {
        invitation.invitedBy = inviterUserId;
      }
      await invitation.save();
    } else {
      let inviterId = inviterUserId;
      if (!inviterId || !mongoose.Types.ObjectId.isValid(inviterId)) {
        inviterId = family.createdBy || new mongoose.Types.ObjectId();
      }
      invitation = await Invitation.create({
        familyId: family._id,
        email: cleanEmail,
        token,
        status: "Pending",
        expiresAt,
        invitedBy: inviterId,
      });
    }

    let inviterName = "Family Admin";
    if (invitation.invitedBy) {
      const inviter = await User.findById(invitation.invitedBy);
      if (inviter) inviterName = inviter.name;
    }

    const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
    const inviteUrl = `${clientOrigin}/invite/${token}`;

    const html = generateInvitationEmailHTML({ familyName: family.name, inviterName, inviteUrl });
    await sendEmail({
      to: cleanEmail,
      subject: `Invitation to Join ${family.name} on My Home`,
      html,
    });

    res.json({
      success: true,
      message: `Invitation link generated & sent to ${cleanEmail}!`,
      token,
      inviteUrl,
      email: cleanEmail,
      familyName: family.name,
      inviterName,
    });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------
// 3. Get Invitation Details by Token
// --------------------------------------------------
router.get("/invite/:token", async (req, res, next) => {
  try {
    const { token } = req.params;

    const invitation = await Invitation.findOne({ token }).populate("familyId").populate("invitedBy");

    if (!invitation) {
      const family = await Family.findOne({
        $or: [
          ...(mongoose.Types.ObjectId.isValid(token) ? [{ _id: token }] : []),
          { inviteCode: token },
        ],
      }).populate("createdBy");

      if (family) {
        let inviterName = family.createdBy?.name || "";
        if (!inviterName) {
          const adminUser = await User.findOne({ familyId: family._id, role: "admin" });
          if (adminUser) inviterName = adminUser.name;
        }

        return res.json({
          valid: true,
          token: token,
          email: "",
          familyName: family.name || family.familyName || "Family Vault",
          inviterName: inviterName || "Family Admin",
          status: "Pending",
        });
      }

      return res.status(404).json({
        valid: false,
        message: "This invitation is no longer valid.",
      });
    }

    if (invitation.status === "Accepted" || invitation.status === "Expired" || invitation.expiresAt < new Date()) {
      if (invitation.status !== "Expired" && invitation.expiresAt < new Date()) {
        invitation.status = "Expired";
        await invitation.save();
      }
      return res.json({
        valid: false,
        status: invitation.status,
        message: "This invitation is no longer valid.",
      });
    }

    res.json({
      valid: true,
      token: invitation.token,
      email: invitation.email,
      familyName: invitation.familyId?.name || invitation.familyId?.familyName || "Family Vault",
      inviterName: invitation.invitedBy?.name || "Family Admin",
      status: invitation.status,
    });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------
// 4. Accept Invitation Logic
// --------------------------------------------------
router.post("/accept-invite", async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Invitation token is required." });
    }

    let invitation = await Invitation.findOne({ token }).populate("familyId");
    let family = invitation ? invitation.familyId : null;

    if (!invitation) {
      family = await Family.findOne({
        $or: [
          ...(mongoose.Types.ObjectId.isValid(token) ? [{ _id: token }] : []),
          { inviteCode: token },
        ],
      });
    }

    if (!invitation && !family) {
      return res.status(400).json({ message: "This invitation is no longer valid." });
    }

    const cleanEmail = invitation?.email ? invitation.email.toLowerCase().trim() : "";
    const user = cleanEmail ? await User.findOne({ email: cleanEmail }) : null;

    // Case 1: No account exists -> redirect to create-account
    if (!user) {
      return res.json({
        action: "create_account_required",
        email: cleanEmail,
        token: token,
      });
    }

    // Case 1.5: User is already a member of another family
    const targetFamilyId = invitation ? invitation.familyId._id : family._id;
    if (user.familyId && user.familyId.toString() !== targetFamilyId.toString()) {
      const existingFamily = await Family.findById(user.familyId);
      const existingFamilyName = existingFamily ? (existingFamily.name || existingFamily.familyName) : "another family";
      return res.status(400).json({
        message: `This account (${cleanEmail}) is already a member of "${existingFamilyName}". A user cannot belong to multiple families with the same email.`,
      });
    }

    // Case 2: Account exists but email NOT verified -> redirect to verify email
    if (!user.emailVerified && !user.isVerified) {
      return res.json({
        action: "verify_required",
        email: cleanEmail,
        token: invitation.token,
        message: "Please verify your email before joining the family.",
      });
    }

    // Case 3: Account exists & verified -> join family immediately
    await FamilyMember.findOneAndUpdate(
      { familyId: invitation.familyId._id, userId: user._id },
      { role: "member", joinedAt: new Date() },
      { upsert: true, new: true }
    );

    user.familyId = invitation.familyId._id;
    await user.save();

    invitation.status = "Accepted";
    await invitation.save();

    res.json({
      action: "joined",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role || "member",
        color: user.color,
        emailVerified: true,
        familyId: invitation.familyId._id,
        familyName: invitation.familyId.name || invitation.familyId.familyName,
      },
      message: `Successfully joined ${invitation.familyId.name}!`,
    });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------
// 5. Create Account for Invited User
// --------------------------------------------------
router.post("/create-account-invite", async (req, res, next) => {
  try {
    const { token, name, email, password, confirmPassword } = req.body;

    if (!token || !name || !password) {
      return res.status(400).json({ message: "Full Name and Password are required." });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }

    let invitation = await Invitation.findOne({ token });
    let targetFamilyId = invitation ? invitation.familyId : null;

    if (!invitation) {
      const family = await Family.findOne({
        $or: [
          ...(mongoose.Types.ObjectId.isValid(token) ? [{ _id: token }] : []),
          { inviteCode: token },
        ],
      });
      if (family) targetFamilyId = family._id;
    }

    if (!targetFamilyId) {
      return res.status(400).json({ message: "This invitation link is invalid or has expired." });
    }

    const cleanEmail = (email || invitation?.email || "").toLowerCase().trim();
    if (!cleanEmail) {
      return res.status(400).json({ message: "Email address is required to create an account." });
    }

    let user = await User.findOne({ email: cleanEmail });
    if (user) {
      if (user.emailVerified || user.isVerified) {
        if (user.familyId) {
          const existingFamily = await Family.findById(user.familyId);
          const existingFamilyName = existingFamily ? (existingFamily.name || existingFamily.familyName) : "another family";
          return res.status(400).json({
            message: `The email address (${cleanEmail}) is already registered in "${existingFamilyName}". A user cannot belong to multiple families with the same email.`,
          });
        }
        return res.status(400).json({
          message: `An account with ${cleanEmail} already exists. Please sign in to accept your invitation.`,
        });
      }
      // If existing user account is unverified, remove stale record
      await User.deleteOne({ _id: user._id });
    }


    const verificationToken = generateSecureToken();
    const userColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password,
      familyId: targetFamilyId,
      role: "member",
      color: userColor,
      emailVerified: false,
      isVerified: false,
      verificationToken,
      verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    res.status(201).json({
      success: true,
      email: cleanEmail,
      verificationToken,
      inviteToken: token,
      message: "Account created! Please verify your email to complete joining the family.",
    });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------
// 6. Email Verification Endpoint
// --------------------------------------------------
router.get("/verify-email", async (req, res, next) => {
  try {
    const { token, inviteToken } = req.query;

    if (!token) {
      return res.status(400).json({ message: "Verification token is required." });
    }

    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired verification token." });
    }

    user.emailVerified = true;
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    // Automatically process pending invitation if present
    let invite = null;
    if (inviteToken) {
      invite = await Invitation.findOne({ token: inviteToken, email: user.email });
    }
    if (!invite) {
      invite = await Invitation.findOne({ email: user.email, status: "Pending" });
    }

    if (invite && invite.expiresAt >= new Date()) {
      await FamilyMember.findOneAndUpdate(
        { familyId: invite.familyId, userId: user._id },
        { role: "member", joinedAt: new Date() },
        { upsert: true, new: true }
      );
      user.familyId = invite.familyId;
      await user.save();
      invite.status = "Accepted";
      await invite.save();
    }

    const family = user.familyId ? await Family.findById(user.familyId) : null;

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role || "member",
        color: user.color,
        emailVerified: true,
        familyId: family ? family._id : null,
        familyName: family ? (family.name || family.familyName) : "My Family",
      },
      message: "Email verified successfully! Joining Family...",
    });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------
// 7. Mark Email Verified (Firebase Sync helper)
// --------------------------------------------------
router.post("/mark-verified", async (req, res, next) => {
  try {
    const { email, inviteToken } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOneAndUpdate(
      { email: cleanEmail },
      { emailVerified: true, isVerified: true },
      { new: true }
    );

    if (user) {
      // Process pending invitation auto-join
      let invite = null;
      if (inviteToken) {
        invite = await Invitation.findOne({ token: inviteToken, email: cleanEmail });
      }
      if (!invite) {
        invite = await Invitation.findOne({ email: cleanEmail, status: "Pending" });
      }
      if (invite && invite.expiresAt >= new Date()) {
        await FamilyMember.findOneAndUpdate(
          { familyId: invite.familyId, userId: user._id },
          { role: "member", joinedAt: new Date() },
          { upsert: true, new: true }
        );
        user.familyId = invite.familyId;
        await user.save();
        invite.status = "Accepted";
        await invite.save();
      }
    }

    res.json({ message: "Email verified successfully.", emailVerified: true });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------
// 8. Sign In Endpoint
// --------------------------------------------------
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and Password are required." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // Strict Email Verification Enforcement
    if (!user.emailVerified && !user.isVerified) {
      return res.status(403).json({
        message: "Your email is not verified.",
        emailVerified: false,
        email: user.email,
      });
    }

    // Find user's active family member record
    let familyMember = await FamilyMember.findOne({ userId: user._id }).populate("familyId");
    let family = familyMember?.familyId;

    if (!family && user.familyId) {
      family = await Family.findById(user.familyId);
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role || familyMember?.role || "member",
        color: user.color,
        emailVerified: true,
        familyId: family ? family._id : null,
        familyName: family ? (family.name || family.familyName) : "My Family",
      },
    });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------
// 9. Resend Verification Email
// --------------------------------------------------
router.post("/resend-verification", async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email address is required." });

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).json({ message: "User account not found." });
    }

    if (user.emailVerified || user.isVerified) {
      return res.json({ message: "Email is already verified. You can sign in directly." });
    }

    const verificationToken = generateSecureToken();
    user.verificationToken = verificationToken;
    user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    res.json({
      success: true,
      message: `A fresh verification link has been sent to ${cleanEmail}. Please check your inbox.`,
      verificationToken,
    });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------
// 10. Get Family Members List
// --------------------------------------------------
router.get("/members/:familyId", async (req, res, next) => {
  try {
    const { familyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(familyId)) {
      return res.json([]);
    }

    // Query User collection directly for all users matching familyId
    const usersInFamily = await User.find({ familyId }).select("name email role color permission createdAt");

    // Query FamilyMember collection
    const memberDocs = await FamilyMember.find({ familyId }).populate("userId", "name email role color permission createdAt");

    const memberMap = new Map();

    usersInFamily.forEach((u) => {
      memberMap.set(u._id.toString(), {
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role || "member",
        permission: u.permission || "Full Access",
        color: u.color || "#7C3AED",
        createdAt: u.createdAt,
      });
    });

    memberDocs.forEach((m) => {
      if (m.userId) {
        const uId = m.userId._id.toString();
        memberMap.set(uId, {
          id: m.userId._id,
          name: m.userId.name,
          email: m.userId.email,
          role: m.role || m.userId.role || "member",
          permission: m.permission || m.userId.permission || "Full Access",
          color: m.userId.color || "#7C3AED",
          createdAt: m.joinedAt || m.createdAt || m.userId.createdAt,
        });
      }
    });

    const members = Array.from(memberMap.values());
    res.json(members);
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------
// 11. Update Member Access Permission (Admin Only)
// --------------------------------------------------
router.patch("/members/permission", async (req, res, next) => {
  try {
    const { memberId, permission } = req.body;

    if (!memberId || !permission) {
      return res.status(400).json({ message: "memberId and permission are required" });
    }

    if (!["Full Access", "View Only"].includes(permission)) {
      return res.status(400).json({ message: "Invalid permission level. Must be Full Access or View Only." });
    }

    await User.findByIdAndUpdate(memberId, { permission });
    await FamilyMember.findOneAndUpdate({ userId: memberId }, { permission });

    res.json({ success: true, message: `Access permission updated to ${permission}` });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------
// 12. Rename Member Name Globally (Admin Only)
// --------------------------------------------------
router.patch("/members/rename", async (req, res, next) => {
  try {
    const { memberId, newName } = req.body;

    if (!memberId || !newName || !newName.trim()) {
      return res.status(400).json({ message: "memberId and newName are required" });
    }

    const trimmedName = newName.trim();

    if (mongoose.Types.ObjectId.isValid(memberId)) {
      await User.findByIdAndUpdate(memberId, { name: trimmedName });
      await FamilyMember.findOneAndUpdate({ userId: memberId }, { name: trimmedName });
    } else {
      await User.updateMany({ _id: memberId }, { name: trimmedName });
      await FamilyMember.updateMany({ _id: memberId }, { name: trimmedName });
    }

    res.json({ success: true, message: `Member renamed to ${trimmedName}`, newName: trimmedName });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------
// 13. Remove Member from Family Portal (Admin Only)
// --------------------------------------------------
router.delete("/members/:memberId", async (req, res, next) => {
  try {
    const { memberId } = req.params;

    if (!memberId) {
      return res.status(400).json({ message: "memberId is required" });
    }

    if (mongoose.Types.ObjectId.isValid(memberId)) {
      // Unlink familyId from User record
      await User.findByIdAndUpdate(memberId, { $unset: { familyId: 1 } });
      // Delete FamilyMember link record
      await FamilyMember.deleteMany({ userId: memberId });
    } else {
      await FamilyMember.deleteMany({ _id: memberId });
    }

    res.json({ success: true, message: "Member removed from family portal successfully." });
  } catch (err) {
    next(err);
  }
});

export default router;

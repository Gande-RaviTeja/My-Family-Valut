import { useState, useEffect } from "react";
import { api } from "../api.js";
import { getMemberDisplayName, savePersonalAlias } from "../utils/memberAliasHelper.js";

const SAMPLE_FAMILY_MEMBERS = [
  { id: "1", name: "Chandrakala", role: "admin", email: "chandrakala@myhome.app", online: true, color: "#7C3AED", permission: "Full Access" },
  { id: "2", name: "Ravi", role: "member", email: "ravi@myhome.app", online: true, color: "#3FB6A3", permission: "Full Access" },
  { id: "3", name: "Mummy", role: "member", email: "mummy@myhome.app", online: false, color: "#FF7A6E", permission: "Full Access" },
  { id: "4", name: "Daddy", role: "member", email: "daddy@myhome.app", online: false, color: "#F5A623", permission: "Full Access" },
];

export default function Account({ user, onSignOut }) {
  const isRegisteredUser = user?.familyId && !user?.isGuest;
  const isFresh = user?.isFresh || isRegisteredUser;
  const initialMembers = isRegisteredUser
    ? [{ id: user?.id || "owner", name: user?.name || "User", role: user?.role || "admin", email: user?.email || "", online: true, color: user?.color || "#7C3AED", permission: user?.role === "admin" ? "Admin" : "Full Access" }]
    : SAMPLE_FAMILY_MEMBERS;

  const [members, setMembers] = useState(initialMembers);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  // Toggles
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [copiedKey, setCopiedKey] = useState(false);

  const [confirmModal, setConfirmModal] = useState(null); // { memberId, memberName, oldPermission, newPermission }
  const [renameModal, setRenameModal] = useState(null); // { member, originalName, newName, renameScope }
  const [removeModal, setRemoveModal] = useState(null); // { member }
  const [storageBytes, setStorageBytes] = useState(0);

  function openRemoveMemberModal(m) {
    setRemoveModal({ member: m });
  }

  async function confirmRemoveMember() {
    if (!removeModal) return;
    const { member } = removeModal;
    const displayName = getMemberDisplayName(user, member.id, member.name);

    setMembers((prev) => prev.filter((m) => m.id !== member.id));

    try {
      if (user?.familyId && !user.isGuest) {
        await api.removeMember(member.id);
      }
      setToastMsg(`Removed "${displayName}" from ${familyName}.`);
    } catch (err) {
      console.error("Error removing member:", err);
      setToastMsg(`Failed to remove "${displayName}".`);
    } finally {
      setTimeout(() => setToastMsg(""), 3000);
      setRemoveModal(null);
    }
  }

  const familyName = user?.familyName || `${user?.name || "User"}'s Family`;
  const userName = user?.name || "User";
  const userEmail = user?.email || "user@myhome.app";
  const rawCode = user?.inviteCode || user?.familyId || "";
  const inviteCode = rawCode.length === 24 ? `FAM-${rawCode.slice(-6).toUpperCase()}` : (rawCode || "N/A");
  const existingInviteLink = lastInviteUrl || `${window.location.origin}/?code=${user?.familyId || inviteCode}`;

  function parseFileSizeToBytes(sizeStr, fileUrlStr) {
    if (fileUrlStr && typeof fileUrlStr === "string" && fileUrlStr.startsWith("data:")) {
      return Math.round((fileUrlStr.length * 3) / 4);
    }
    if (!sizeStr || typeof sizeStr !== "string") return 1200000;
    const match = sizeStr.trim().match(/^([\d.]+)\s*([A-Za-z]+)?$/);
    if (!match) return 1200000;
    const num = parseFloat(match[1]);
    const unit = (match[2] || "MB").toUpperCase();
    if (unit.startsWith("G")) return num * 1024 * 1024 * 1024;
    if (unit.startsWith("M")) return num * 1024 * 1024;
    if (unit.startsWith("K")) return num * 1024;
    return num;
  }

  function formatStorage(bytes) {
    if (!bytes || bytes <= 0) return "0.0 MB";
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 0.1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    if (mb >= 0.1) return `${mb.toFixed(1)} MB`;
    const kb = bytes / 1024;
    return `${kb.toFixed(0)} KB`;
  }

  useEffect(() => {
    const familyCode = user?.familyId || user?.inviteCode || "FAM-DEFAULT";
    if (user?.familyId && !user.isGuest) {
      api.getFamilyMembers(user.familyId)
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setMembers(data.map((m) => ({
              id: m.id || m._id,
              name: m.name,
              role: m.role || "member",
              email: m.email,
              color: m.color || "#7C3AED",
              online: true,
              permission: m.role === "admin" ? "Admin" : (m.permission || "Full Access"),
            })));
          }
        })
        .catch((err) => console.log("Error loading members:", err));

      api.getFamilyDocuments(user.familyId)
        .then((dbDocs) => {
          if (Array.isArray(dbDocs)) {
            const total = dbDocs.reduce((acc, doc) => acc + parseFileSizeToBytes(doc.fileSize, doc.fileUrl), 0);
            setStorageBytes(total);
          }
        })
        .catch(() => {});
    } else {
      try {
        const saved = localStorage.getItem(`myhome_documents_${familyCode}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const total = parsed.reduce((acc, doc) => acc + parseFileSizeToBytes(doc.fileSize, doc.fileUrl), 0);
            setStorageBytes(total);
          }
        } else if (!user?.isFresh) {
          setStorageBytes(4.2 * 1024 * 1024 * 1024);
        }
      } catch {}
    }
  }, [user]);

  function handleCopyKey() {
    const inviteUrl = `${window.location.origin}/?code=${inviteCode}`;
    navigator.clipboard?.writeText(inviteUrl);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  function handlePermissionChange(memberId, newPermission) {
    const targetMember = members.find((m) => m.id === memberId);
    if (!targetMember) return;
    if ((targetMember.permission || "Full Access") === newPermission) return;

    setConfirmModal({
      memberId,
      memberName: getMemberDisplayName(user, targetMember.id, targetMember.name),
      oldPermission: targetMember.permission || "Full Access",
      newPermission,
    });
  }

  function confirmPermissionChange() {
    if (!confirmModal) return;
    const { memberId, memberName, newPermission } = confirmModal;

    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, permission: newPermission } : m))
    );

    if (user?.familyId && !user.isGuest) {
      api.updateMemberPermission(memberId, newPermission)
        .then(() => {
          setToastMsg(`${memberName}'s access updated to ${newPermission}.`);
          setTimeout(() => setToastMsg(""), 2500);
        })
        .catch((err) => console.log("Error persisting permission:", err));
    }

    setConfirmModal(null);
  }

  function openRenameModal(m) {
    const currentDisplayName = getMemberDisplayName(user, m.id, m.name);
    setRenameModal({
      member: m,
      originalName: m.name,
      newName: currentDisplayName,
      renameScope: "personal",
    });
  }

  async function handleSaveRename() {
    if (!renameModal || !renameModal.newName.trim()) return;
    const { member, originalName, newName, renameScope } = renameModal;
    const cleanNewName = newName.trim();

    if (renameScope === "global" && user?.role === "admin") {
      try {
        if (user?.familyId && !user.isGuest) {
          await api.renameMemberGlobally(member.id, cleanNewName);
        }
        savePersonalAlias(user, member.id, originalName, "");

        setMembers((prev) =>
          prev.map((m) => (m.id === member.id ? { ...m, name: cleanNewName } : m))
        );
        setToastMsg(`Renamed member to "${cleanNewName}" for all family members.`);
      } catch (err) {
        console.error("Error renaming member globally:", err);
        setToastMsg("Failed to rename member globally.");
      }
    } else {
      // Personal Alias
      savePersonalAlias(user, member.id, originalName, cleanNewName);
      setMembers((prev) => [...prev]);
      setToastMsg(`Personal alias updated to "${cleanNewName}" (Visible only to you).`);
    }

    setTimeout(() => setToastMsg(""), 3000);
    setRenameModal(null);
  }

  function handleCopyInviteLink() {
    navigator.clipboard?.writeText(existingInviteLink);
    setCopiedLink(true);
    setToastMsg("Invitation link copied.");
    setTimeout(() => {
      setCopiedLink(false);
      setToastMsg("");
    }, 2500);
  }

  async function handleShareInviteLink() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${familyName}`,
          text: `Share this invitation link with your family members to let them join your family.`,
          url: existingInviteLink,
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          navigator.clipboard?.writeText(existingInviteLink);
          setToastMsg("Invitation link copied.");
          setTimeout(() => setToastMsg(""), 2500);
        }
      }
    } else {
      navigator.clipboard?.writeText(existingInviteLink);
      setToastMsg("Invitation link copied.");
      setTimeout(() => setToastMsg(""), 2500);
    }
  }

  return (
    <div className="account-view">
      <div className="top-row">
        <div>
          <div className="greet-label">PROFILE & FAMILY PORTAL</div>
          <div className="greet-name">{familyName}</div>
        </div>
        <button className="add-bill-btn" onClick={() => setShowInviteModal(true)}>
          + Share Invite
        </button>
      </div>

      {toastMsg && (
        <div style={{
          background: "var(--purple-tint)",
          color: "var(--purple)",
          padding: "10px 16px",
          borderRadius: 10,
          marginBottom: 16,
          fontWeight: 600,
          fontSize: 13.5,
          border: "1px solid var(--purple)"
        }}>
          {toastMsg}
        </div>
      )}

      {/* User Profile Banner Card */}
      <div className="profile-hero card" style={{ marginBottom: 24, padding: "24px 20px" }}>
        <div
          className="avatar-img online"
          style={{ background: `linear-gradient(135deg, ${user?.color || "var(--purple)"}, #a875f5)`, width: 68, height: 68, fontSize: 24, flexShrink: 0 }}
        >
          {userName.charAt(0)}
        </div>
        <div className="profile-info" style={{ flex: 1, minWidth: 0 }}>
          <h2>{userName}</h2>
          <div className="profile-status" style={{ marginBottom: 12, wordBreak: "break-word", overflowWrap: "anywhere" }}>
            {user?.role === "admin" ? "Family Head (Admin)" : "Family Member"} · {userEmail}
          </div>
          <div className="profile-hero-buttons" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div className="family-key-badge" style={{ background: "var(--purple-tint)", border: "1px solid var(--purple)", padding: "6px 14px", borderRadius: 10, maxWidth: "100%", wordBreak: "break-word" }}>
              Family Invite Code: <strong style={{ color: "var(--purple)", letterSpacing: "0.05em" }}>{inviteCode}</strong>
            </div>
            <button className="btn-outline-purple" onClick={handleCopyKey}>
              {copiedKey ? "Copied! ✓" : "Copy Code"}
            </button>
            {onSignOut && (
              <button className="btn-outline-danger" onClick={onSignOut}>
                Sign Out
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="expenses-grid">
        {/* Left Column: Family Members List */}
        <div className="expenses-col">
          <div className="section-head" style={{ flexWrap: "wrap", gap: 6 }}>
            <h4>Family Members Connected ({members.length})</h4>
            <span style={{ fontSize: 11, color: "var(--purple)", fontWeight: 700 }}>
              {user?.role === "admin" ? "Admin Controls Active" : "Shared Access Active"}
            </span>
          </div>
          <div className="card" style={{ padding: "14px 16px" }}>
            {members.map((m) => {
              const displayName = getMemberDisplayName(user, m.id, m.name);
              const hasAlias = displayName !== m.name;

              return (
                <div className="expense-row member-row" key={m.id} style={{ padding: "12px 0", flexWrap: "wrap", gap: 8 }}>
                  <div className="member-main-info" style={{ display: "flex", alignItems: "center", gap: 12, flex: "1 1 auto", minWidth: 0 }}>
                    <div
                      className={`avatar-img${m.online ? " online" : ""}`}
                      style={{
                        background: `linear-gradient(135deg, ${m.color || "#7C3AED"}, ${m.color || "#7C3AED"}aa)`,
                        width: 44,
                        height: 44,
                        fontSize: 16,
                        margin: 0,
                        flexShrink: 0,
                      }}
                    >
                      {displayName.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <p className="file-name" style={{ margin: 0, fontWeight: 700 }}>
                          {displayName}
                        </p>
                        {hasAlias && (
                          <span style={{ fontSize: 10, background: "var(--purple-tint)", color: "var(--purple)", padding: "2px 6px", borderRadius: 6, fontWeight: 700 }}>
                            Alias
                          </span>
                        )}
                        <button
                          className="rename-member-btn"
                          onClick={() => openRenameModal(m)}
                          title="Rename family member"
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "2px 4px",
                            fontSize: "13px",
                            opacity: 0.75,
                          }}
                        >
                          ✏️
                        </button>
                      </div>
                      <div className="file-meta" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
                        {m.role === "admin" ? "Family Admin" : "Member"} · {m.email}
                        {hasAlias && <span style={{ color: "var(--ink-soft)" }}> (Registered: {m.name})</span>}
                      </div>
                    </div>
                  </div>

                  <div className="member-actions" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {m.role === "admin" ? (
                      <div className="folder-share" style={{ margin: 0, background: "var(--purple-tint)", color: "var(--purple)", fontWeight: 700 }}>
                        Admin
                      </div>
                    ) : user?.role === "admin" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <select
                          className="folder-share-select"
                          value={m.permission || "Full Access"}
                          onChange={(e) => handlePermissionChange(m.id, e.target.value)}
                          title="Change member access permission (Admin Only)"
                        >
                          <option value="Full Access">Full Access</option>
                          <option value="View Only">View Only</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => openRemoveMemberModal(m)}
                          style={{
                            background: "#FEF2F2",
                            border: "1px solid #FCA5A5",
                            color: "#DC2626",
                            borderRadius: 8,
                            padding: "6px 10px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            whiteSpace: "nowrap",
                          }}
                          title="Remove member from family portal"
                        >
                          🗑️ Remove
                        </button>
                      </div>
                    ) : (
                      <div className="folder-share" style={{ margin: 0, background: "var(--mint-tint)", color: "var(--mint-deep)", fontWeight: 600 }}>
                        {m.permission || "Full Access"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Storage & App Preferences */}
        <div className="expenses-col">
          <div className="section-head">
            <h4>Storage & Security</h4>
          </div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, fontSize: 13, fontWeight: 700, flexWrap: "wrap", gap: 4 }}>
              <span>Vault Storage Used</span>
              <span style={{ color: "var(--purple)" }}>{formatStorage(storageBytes)} of 15 GB</span>
            </div>
            <div className="hero-bar" style={{ height: 8, background: "var(--line)" }}>
              <div style={{ width: `${Math.max(1, Math.min(100, (storageBytes / (15 * 1024 * 1024 * 1024)) * 100)).toFixed(1)}%`, background: "var(--purple)", borderRadius: 6, transition: "width 0.3s ease" }} />
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 8 }}>
              256-bit AES Encryption · Auto Cloud Backup
            </div>
          </div>

          <div className="section-head">
            <h4>Preferences</h4>
          </div>
          <div className="card">
            <div className="expense-row" style={{ border: "none", paddingBottom: 12 }}>
              <div>
                <p className="file-name" style={{ margin: 0 }}>Email Notifications</p>
                <div className="file-meta">Receive bill reminders and document alerts</div>
              </div>
              <input type="checkbox" checked={emailNotifs} onChange={(e) => setEmailNotifs(e.target.checked)} style={{ accentColor: "var(--purple)", width: 18, height: 18, cursor: "pointer" }} />
            </div>
            <div className="expense-row" style={{ paddingTop: 12 }}>
              <div>
                <p className="file-name" style={{ margin: 0 }}>Real-time Family Sync</p>
                <div className="file-meta">Sync grocery items & bills instantly</div>
              </div>
              <input type="checkbox" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} style={{ accentColor: "var(--purple)", width: 18, height: 18, cursor: "pointer" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Share Invite Link Modal */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="modal-card card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>Invite Family Member</h3>
              <button className="close-btn" onClick={() => setShowInviteModal(false)}>✕</button>
            </div>
            <p style={{ fontSize: 13.5, color: "var(--ink-soft)", margin: "0 0 16px 0", lineHeight: 1.5 }}>
              Share this direct invitation link with your family member. When they open this link, they will automatically join <strong>{familyName}</strong>!
            </p>

            <div style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: 12,
              padding: "12px 14px",
              marginBottom: 16,
              wordBreak: "break-all",
              fontFamily: "monospace",
              fontSize: 12.5,
              color: "var(--purple)",
              fontWeight: 600
            }}>
              {existingInviteLink}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                className="btn-outline-purple"
                style={{ width: "100%", padding: "12px", fontSize: "14px", fontWeight: 600, borderRadius: 12 }}
                onClick={handleCopyInviteLink}
              >
                {copiedLink ? "Link Copied! ✓" : "Copy Invitation Link"}
              </button>

              <button
                type="button"
                className="btn-primary"
                style={{ width: "100%", padding: "12px", fontSize: "14px", fontWeight: 600, borderRadius: 12 }}
                onClick={handleShareInviteLink}
              >
                Share Invitation Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Access Level Confirmation Modal Popup */}
      {confirmModal && (
        <div className="modal-overlay" onClick={() => setConfirmModal(null)}>
          <div className="modal-card card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, padding: "24px" }}>
            <div className="modal-header" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--purple-tint)", color: "var(--purple)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800 }}>
                  🛡️
                </div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Change Access Level</h3>
              </div>
              <button className="close-btn" onClick={() => setConfirmModal(null)}>✕</button>
            </div>

            <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.5, margin: "12px 0 16px 0" }}>
              Are you sure you want to change <strong>{confirmModal.memberName}</strong>'s access level?
            </p>

            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 16px", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <span style={{ fontSize: 11, color: "var(--ink-soft)", textTransform: "uppercase", fontWeight: 700, display: "block", marginBottom: 2 }}>Current Access</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "#64748B" }}>{confirmModal.oldPermission}</span>
              </div>
              <div style={{ fontSize: 16, color: "var(--purple)", fontWeight: 800 }}>➔</div>
              <div>
                <span style={{ fontSize: 11, color: "var(--purple)", textTransform: "uppercase", fontWeight: 700, display: "block", marginBottom: 2 }}>New Access</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--purple)" }}>{confirmModal.newPermission}</span>
              </div>
            </div>

            {confirmModal.newPermission === "View Only" && (
              <div style={{ fontSize: 12.5, color: "#B45309", background: "var(--amber-tint)", padding: "10px 14px", borderRadius: 10, marginBottom: 18, fontWeight: 600, lineHeight: 1.4 }}>
                ℹ️ In View Only mode, <strong>{confirmModal.memberName}</strong> can view and download shared family files, but cannot upload or delete files.
              </div>
            )}

            <div className="modal-actions" style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1, padding: "11px", fontWeight: 700, borderRadius: 10, fontSize: 13.5 }}
                onClick={() => setConfirmModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ flex: 1, padding: "11px", fontWeight: 700, borderRadius: 10, fontSize: 13.5 }}
                onClick={confirmPermissionChange}
              >
                Confirm & Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Family Member Modal */}
      {renameModal && (
        <div className="modal-overlay" onClick={() => setRenameModal(null)}>
          <div className="modal-card card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460, padding: "24px" }}>
            <div className="modal-header" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--purple-tint)", color: "var(--purple)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800 }}>
                  ✏️
                </div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Rename Family Member</h3>
              </div>
              <button className="close-btn" onClick={() => setRenameModal(null)}>✕</button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                Member Display Name
              </label>
              <input
                type="text"
                value={renameModal.newName}
                onChange={(e) => setRenameModal({ ...renameModal, newName: e.target.value })}
                placeholder="Enter new display name..."
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 14, boxSizing: "border-box" }}
                autoFocus
              />
              <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 6 }}>
                Registered system name: <strong>{renameModal.originalName}</strong>
              </div>
            </div>

            {user?.role === "admin" ? (
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 16px", marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--purple)", marginBottom: 10 }}>
                  Admin Scope Option
                </div>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 10 }}>
                  <input
                    type="radio"
                    name="renameScope"
                    value="personal"
                    checked={renameModal.renameScope === "personal"}
                    onChange={() => setRenameModal({ ...renameModal, renameScope: "personal" })}
                    style={{ marginTop: 3, accentColor: "var(--purple)" }}
                  />
                  <div>
                    <strong style={{ fontSize: 13, display: "block", color: "var(--ink-dark)" }}>Only for me (Personal alias)</strong>
                    <span style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>
                      Renames this member only on your profile & screens.
                    </span>
                  </div>
                </label>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="renameScope"
                    value="global"
                    checked={renameModal.renameScope === "global"}
                    onChange={() => setRenameModal({ ...renameModal, renameScope: "global" })}
                    style={{ marginTop: 3, accentColor: "var(--purple)" }}
                  />
                  <div>
                    <strong style={{ fontSize: 13, display: "block", color: "var(--purple)" }}>For all family members (Global change)</strong>
                    <span style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>
                      Officially updates the name for everyone in the family portal.
                    </span>
                  </div>
                </label>
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: "var(--purple)", background: "var(--purple-tint)", padding: "10px 14px", borderRadius: 10, marginBottom: 18, fontWeight: 600, lineHeight: 1.4 }}>
                ℹ️ <strong>Personal Alias:</strong> This name change is visible only to you on your profile and screens.
              </div>
            )}

            <div className="modal-actions" style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1, padding: "11px", fontWeight: 700, borderRadius: 10, fontSize: 13.5 }}
                onClick={() => setRenameModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ flex: 1, padding: "11px", fontWeight: 700, borderRadius: 10, fontSize: 13.5 }}
                onClick={handleSaveRename}
                disabled={!renameModal.newName.trim()}
              >
                Save Name
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Confirmation Modal */}
      {removeModal && (
        <div className="modal-overlay" onClick={() => setRemoveModal(null)}>
          <div className="modal-card card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, padding: "24px" }}>
            <div className="modal-header" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#FEF2F2", color: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800 }}>
                  🗑️
                </div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#991B1B" }}>Remove Member</h3>
              </div>
              <button className="close-btn" onClick={() => setRemoveModal(null)}>✕</button>
            </div>

            <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.5, margin: "12px 0 16px 0" }}>
              Are you sure you want to remove <strong>{getMemberDisplayName(user, removeModal.member.id, removeModal.member.name)}</strong> ({removeModal.member.email}) from <strong>{familyName}</strong>?
            </p>

            <div style={{ fontSize: 12.5, color: "#B45309", background: "var(--amber-tint)", padding: "10px 14px", borderRadius: 10, marginBottom: 18, fontWeight: 600, lineHeight: 1.4 }}>
              ⚠️ This user will immediately lose access to all shared family documents, household bills, grocery lists, and portal settings.
            </div>

            <div className="modal-actions" style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1, padding: "11px", fontWeight: 700, borderRadius: 10, fontSize: 13.5 }}
                onClick={() => setRemoveModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ flex: 1, padding: "11px", fontWeight: 700, borderRadius: 10, fontSize: 13.5, background: "#DC2626", borderColor: "#DC2626", color: "#FFF" }}
                onClick={confirmRemoveMember}
              >
                Remove Member
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

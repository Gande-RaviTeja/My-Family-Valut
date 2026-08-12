import { useEffect, useState } from "react";
import { api } from "../api.js";
import { FileIcon, RupeeIcon } from "../components/icons.jsx";
import { getMemberDisplayName } from "../utils/memberAliasHelper.js";
import { parseDueDays, isDueWithinDays } from "../utils/billHelper.js";

function formatTimeAgo(dateString) {
  if (!dateString) return "Just now";
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (isNaN(diffInSeconds) || diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

export default function Dashboard({ user, onOpenMember, onOpenBills }) {
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [billsList, setBillsList] = useState([]);

  useEffect(() => {
    const familyCode = user?.inviteCode || user?.familyId || "FAM-DEFAULT";
    const famName = user?.familyName || `${user?.name || "User"}'s Family`;

    const loadBillsData = (bList) => {
      if (Array.isArray(bList)) {
        const formatted = bList.map((b) => ({
          id: b._id || b.id,
          name: b.name,
          amount: Number(b.amount) || 0,
          dueIn: b.dueIn || "3 days",
          paid: Boolean(b.paid),
          addedBy: b.addedBy || "Family Member",
        }));
        setBillsList(formatted);
      }
    };

    // 1. Load bills from local cache first
    try {
      const saved = localStorage.getItem(`myhome_bills_${familyCode}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        loadBillsData(parsed);
      }
    } catch (err) {}

    // Compute monthly spend
    const getSavedSpend = () => {
      try {
        const saved = localStorage.getItem(`myhome_bills_${familyCode}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            return parsed.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
          }
        }
      } catch (err) {}
      return 0;
    };

    let initialSpend = getSavedSpend();

    // 2. If user is in a registered Family
    if (user?.familyId && !user.isGuest) {
      setFamily({
        name: famName,
        familyId: familyCode,
        alert: {
          title: `Welcome to ${famName} Vault!`,
          detail: "Your private family space is clean & ready. Upload your first document or add bills to get started.",
        },
        stats: { documents: 0, monthlySpend: initialSpend },
        quote: "Organize your family's digital records safely in one encrypted portal.",
      });

      api.getFamilyExpenses(familyCode)
        .then((bList) => {
          if (Array.isArray(bList) && bList.length > 0) {
            loadBillsData(bList);
            const apiTotal = bList.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
            setFamily((prev) => prev ? { ...prev, stats: { ...prev.stats, monthlySpend: apiTotal } } : prev);
          }
        })
        .catch(() => {});

      // Fetch real connected family members from database
      api.getFamilyMembers(user.familyId)
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setMembers(
              data.map((m) => ({
                id: m._id || m.id,
                name: m.name,
                role: m.role === "admin" ? "Admin" : "Member",
                online: true,
                color: m.color || "#7C3AED",
              }))
            );
          } else {
            setMembers([
              {
                id: user.name.toLowerCase().replace(/\s+/g, ""),
                name: user.name,
                role: user.role === "admin" ? "Admin" : "Member",
                online: true,
                color: user.color || "#7C3AED",
              },
            ]);
          }
        })
        .catch(() => {
          setMembers([
            {
              id: user.name.toLowerCase().replace(/\s+/g, ""),
              name: user.name,
              role: user.role === "admin" ? "Admin" : "Member",
              online: true,
              color: user.color || "#7C3AED",
            },
          ]);
        });

      // Fetch real uploaded documents from MongoDB
      api.getFamilyDocuments(user.familyId)
        .then((dbDocs) => {
          if (Array.isArray(dbDocs)) {
            const formattedUploads = dbDocs.map((d) => ({
              id: d._id,
              name: d.name,
              category: d.category || "General",
              uploadedBy: d.uploadedBy || d.member || "Family Member",
              fileSize: d.fileSize || "1.2 MB",
              when: formatTimeAgo(d.createdAt),
            }));

            setUploads(formattedUploads);

            setFamily((prev) => ({
              ...(prev || {}),
              name: famName,
              familyId: familyCode,
              alert: {
                title: `Welcome to ${famName} Vault!`,
                detail: dbDocs.length > 0
                  ? `Your family has ${dbDocs.length} document${dbDocs.length > 1 ? "s" : ""} securely stored.`
                  : "Your private family space is clean & ready. Upload your first document or add bills to get started.",
              },
              stats: { documents: dbDocs.length, monthlySpend: prev?.stats?.monthlySpend || initialSpend },
              quote: "Organize your family's digital records safely in one encrypted portal.",
            }));
          }
        })
        .catch((err) => console.log("Error fetching family docs:", err));
    } else if (user?.isFresh) {
      setFamily({
        name: user.familyName || `${user.name}'s Family`,
        familyId: user.inviteCode || user.familyId,
        alert: { title: "Welcome to My Home Portal!", detail: "Upload your first document or add household bills to get started." },
        stats: { documents: 0, monthlySpend: initialSpend },
        quote: "Organize your family's digital records safely in one encrypted portal.",
      });
      setMembers([{ id: user.name.toLowerCase(), name: user.name, online: true, color: "#7C3AED" }]);
      setUploads([]);
    } else {
      // Guest / Demo Mode fallback
      api.getFamily().then((res) => {
        setFamily({
          ...res,
          name: user?.familyName || res.name,
          familyId: user?.inviteCode || user?.familyId || res.familyId,
          stats: { ...res.stats, monthlySpend: initialSpend > 0 ? initialSpend : res.stats?.monthlySpend || 0 },
        });
      });
      api.getMembers().then((res) => {
        if (user?.name && !res.some((m) => m.id === user.name.toLowerCase())) {
          setMembers([{ id: user.name.toLowerCase(), name: user.name, online: true, color: "#7C3AED" }, ...res]);
        } else {
          setMembers(res);
        }
      });
      api.getRecentUploads().then((res) => {
        if (Array.isArray(res)) {
          setUploads(
            res.map((u) => ({
              id: u.id || u.name,
              name: u.name,
              category: u.group || u.category || "General",
              uploadedBy: u.uploadedBy || "Family Member",
              fileSize: u.fileSize || "1.2 MB",
              when: u.when || "Recently",
            }))
          );
        }
      });
    }
  }, [user]);

  const [docToDelete, setDocToDelete] = useState(null);

  async function confirmDeleteDoc() {
    if (!docToDelete) return;
    const { id: docId, name: docName } = docToDelete;
    try {
      if (docId) {
        await api.deleteDocument(docId);
      }
      setUploads((prev) => prev.filter((d) => (d.id || d._id) !== docId && d.name !== docName));
      setFamily((prev) => ({
        ...(prev || {}),
        stats: {
          ...(prev?.stats || {}),
          documents: Math.max(0, (prev?.stats?.documents || 1) - 1),
        },
      }));
    } catch (err) {
      console.log("Error deleting doc from Dashboard:", err);
    } finally {
      setDocToDelete(null);
    }
  }

  async function handleTogglePaidDashboard(billId) {
    const familyCode = user?.inviteCode || user?.familyId || "FAM-DEFAULT";
    const updated = billsList.map((b) => (b.id === billId ? { ...b, paid: true } : b));
    setBillsList(updated);

    try {
      localStorage.setItem(`myhome_bills_${familyCode}`, JSON.stringify(updated));
      if (billId && typeof billId === "string" && !billId.startsWith("local-")) {
        await api.toggleExpense(billId);
      }
    } catch (err) {
      console.error("Error toggling bill from dashboard:", err);
    }
  }

  const urgentBills = billsList.filter((b) => !b.paid && isDueWithinDays(b.dueIn, 2));

  if (!family) return <div className="grocery-empty">Loading…</div>;

  return (
    <div className="dashboard-view">
      <div className="top-row">
        <div>
          <div className="greet-label">WELCOME BACK, {user?.name?.toUpperCase() || "USER"}</div>
          <div className="greet-name">{family.name}</div>
        </div>
        <div className="top-row-actions">
          <div className="family-badge-pill">CODE: {(family.familyId || "").length === 24 ? `FAM-${family.familyId.slice(-6).toUpperCase()}` : family.familyId}</div>
        </div>
      </div>

      <div className="members-section">
        <div className="avatar-row">
          {members.map((m) => {
            const displayName = getMemberDisplayName(user, m.id, m.name);
            return (
              <div className="avatar" key={m.id} onClick={() => onOpenMember(m.id)}>
                <div
                  className={`avatar-img${m.online ? " online" : ""}`}
                  style={{ background: `linear-gradient(135deg, ${m.color || "#7C3AED"}, ${m.color || "#7C3AED"}aa)` }}
                >
                  {displayName.charAt(0)}
                </div>
                <div className="avatar-name">{displayName}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-primary">
          {/* URGENT BILLS (< 2 DAYS) VISUALIZATION CARD */}
          {urgentBills.length > 0 && (
            <div
              className="urgent-bills-card card"
              style={{
                background: "linear-gradient(135deg, #FFF1F2 0%, #FFFFFF 100%)",
                border: "1.5px solid #FDA4AF",
                borderRadius: 16,
                padding: "20px 22px",
                marginBottom: 24,
                boxShadow: "0 8px 24px -6px rgba(225, 29, 72, 0.12)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      background: "#FFE4E6",
                      color: "#E11D48",
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                      fontWeight: 800,
                      boxShadow: "0 2px 8px rgba(225, 29, 72, 0.2)",
                    }}
                  >
                    🚨
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, color: "#881337" }}>
                      Urgent Family Bills Due Soon ({urgentBills.length})
                    </h4>
                    <span style={{ fontSize: 12.5, color: "#BE123C", fontWeight: 600 }}>
                      Bills due within 2 days require immediate attention!
                    </span>
                  </div>
                </div>
                <button
                  onClick={onOpenBills}
                  className="btn-primary"
                  style={{
                    background: "#E11D48",
                    borderColor: "#E11D48",
                    color: "#FFF",
                    padding: "8px 16px",
                    fontSize: 13,
                    fontWeight: 700,
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                >
                  Manage Bills ➔
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {urgentBills.map((b) => {
                  const dueDays = parseDueDays(b.dueIn);
                  const dueLabel = dueDays === 0 ? "DUE TODAY ⚡" : dueDays === 1 ? "DUE TOMORROW (1 day)" : "DUE IN 2 DAYS ⚠️";
                  const badgeBg = dueDays === 0 ? "#FFE4E6" : "#FEF3C7";
                  const badgeFg = dueDays === 0 ? "#991B1B" : "#92400E";

                  return (
                    <div
                      key={b.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        background: "#FFFFFF",
                        border: "1px solid #FFE4E6",
                        padding: "12px 16px",
                        borderRadius: 12,
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--amber-tint)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <RupeeIcon color="#F5A623" size={20} />
                        </div>
                        <div>
                          <strong style={{ fontSize: 14.5, color: "var(--ink)", display: "block" }}>{b.name}</strong>
                          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Added by {b.addedBy}</span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11.5, fontWeight: 800, background: badgeBg, color: badgeFg, padding: "5px 12px", borderRadius: 8, letterSpacing: "0.02em" }}>
                          {dueLabel}
                        </span>
                        <strong style={{ fontSize: 16, color: "var(--ink)", fontWeight: 800 }}>
                          ₹{Number(b.amount).toLocaleString("en-IN")}
                        </strong>
                        <button
                          type="button"
                          className="status-btn pending"
                          style={{ fontSize: 12.5, padding: "6px 14px", fontWeight: 700, borderRadius: 8, cursor: "pointer" }}
                          onClick={() => handleTogglePaidDashboard(b.id)}
                        >
                          Mark Paid ✓
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="alert-banner">
            <div className="icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M12 9v4M12 17h.01M10.3 3.9L2.5 17a1.5 1.5 0 001.3 2.2h16.4a1.5 1.5 0 001.3-2.2L13.7 3.9a1.5 1.5 0 00-2.6 0z" />
              </svg>
            </div>
            <div className="txt">
              <strong>{family.alert.title}</strong>
              <span>{family.alert.detail}</span>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card stat-mint">
              <div className="stat-label">Documents</div>
              <div className="stat-value stat-mint-val">{family.stats.documents}</div>
            </div>
            <div className="stat-card stat-purple" onClick={onOpenBills} style={{ cursor: "pointer" }}>
              <div className="stat-label">This Month Bills</div>
              <div className="stat-value stat-purple-val">
                ₹{family.stats.monthlySpend.toLocaleString("en-IN")}
              </div>
            </div>
          </div>

          <div className="quote-card">
            <p className="quote-text">"{family.quote}"</p>
            <span className="quote-label">TODAY'S NOTE</span>
          </div>
        </div>

        <div className="dashboard-secondary">
          <div className="section-head" style={{ marginTop: 0 }}>
            <h4>Recent Uploads ({uploads.length})</h4>
          </div>
          <div className="card recent-uploads-card">
            {uploads.length === 0 ? (
              <div className="grocery-empty" style={{ padding: "24px 16px", textAlign: "center" }}>
                No documents uploaded yet.<br />
                <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                  Upload documents from the Profile screen to see them here!
                </span>
              </div>
            ) : (
              uploads.map((u, i) => (
                <div className="file-row" key={u.id || i} style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, borderBottom: i < uploads.length - 1 ? "1px solid var(--line)" : "none" }}>
                  <div className="file-ico" style={{ background: "var(--purple-tint)", width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <FileIcon color="#7C3AED" size={20} />
                  </div>
                  <div className="file-details" style={{ flex: 1, minWidth: 0 }}>
                    <p className="file-name" style={{ margin: 0, fontWeight: 700, fontSize: 13.5, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {u.name}
                    </p>
                    <div className="file-meta" style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>
                      <span style={{ color: "var(--purple)", fontWeight: 600 }}>{u.category}</span> · uploaded by <strong style={{ color: "var(--ink)" }}>{u.uploadedBy}</strong> · {u.when}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--purple)", background: "var(--purple-tint)", padding: "4px 8px", borderRadius: 6 }}>
                      {u.fileSize}
                    </div>
                    <button
                      type="button"
                      onClick={() => setDocToDelete({ id: u.id, name: u.name })}
                      style={{
                        background: "#FEF2F2",
                        border: "1px solid #FCA5A5",
                        color: "#DC2626",
                        borderRadius: 6,
                        padding: "4px 8px",
                        fontSize: 12,
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                      title="Delete document"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {docToDelete && (
        <div className="modal-overlay" onClick={() => setDocToDelete(null)}>
          <div className="modal-card card" style={{ maxWidth: 420, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ background: "#FEF2F2", width: 56, height: 56, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#DC2626", fontSize: 26 }}>
              🗑️
            </div>
            <h3 style={{ margin: "0 0 8px", color: "var(--ink)", fontSize: 18, fontWeight: 700 }}>
              Delete Document?
            </h3>
            <p style={{ margin: "0 0 20px", color: "var(--ink-soft)", fontSize: 13.5, lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>"{docToDelete.name}"</strong>? This document will be permanently removed from your family's vault.
            </p>
            <div className="modal-actions" style={{ justifyContent: "center", gap: 12 }}>
              <button type="button" className="btn-secondary" onClick={() => setDocToDelete(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" style={{ background: "#DC2626", borderColor: "#DC2626", color: "#FFF" }} onClick={confirmDeleteDoc}>
                Delete Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

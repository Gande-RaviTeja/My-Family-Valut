import { useEffect, useState, useRef } from "react";
import { api } from "../api.js";
import { FolderIcon } from "../components/icons.jsx";
import { downloadDocumentFile } from "../utils/downloadHelper.js";
import { getMemberDisplayName } from "../utils/memberAliasHelper.js";

const GROUP_TINTS = {
  Identity: { bg: "var(--purple-tint)", fg: "#7C3AED" },
  Banking: { bg: "var(--mint-tint)", fg: "#3FB6A3" },
  Education: { bg: "var(--amber-tint)", fg: "#F5A623" },
  Medical: { bg: "var(--coral-tint)", fg: "#FF7A6E" },
  Property: { bg: "var(--purple-tint)", fg: "#7C3AED" },
};

const FRESH_GROUPS = [
  { name: "Identity", count: 0, updated: "Not uploaded", sharedWith: "Shared with family" },
  { name: "Banking", count: 0, updated: "Not uploaded", sharedWith: "Shared with family" },
  { name: "Education", count: 0, updated: "Not uploaded", sharedWith: "Shared with family" },
  { name: "Medical", count: 0, updated: "Not uploaded", sharedWith: "Shared with family" },
  { name: "Property", count: 0, updated: "Not uploaded", sharedWith: "Shared with family" },
];

const DEFAULT_CATEGORIES = ["Identity", "Banking", "Education", "Medical", "Property"];

export default function Profile({ user, memberId, onBack, onOpenFolder }) {
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState(FRESH_GROUPS);
  const [activeMemberId, setActiveMemberId] = useState(memberId || user?.id || user?.name?.toLowerCase() || "user");
  const [searchQuery, setSearchQuery] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Upload modal state
  const [selectedFile, setSelectedFile] = useState(null); // { name, size, type }
  const [docName, setDocName] = useState("");
  const [docCategory, setDocCategory] = useState("Identity");
  const [docShared, setDocShared] = useState("Shared with family");
  const [isDragging, setIsDragging] = useState(false);

  const familyKey = user?.familyId || user?.inviteCode || "FAM-DEFAULT";
  const DOCS_STORAGE_KEY = `myhome_documents_${familyKey}`;

  const fileInputRef = useRef(null);
  const [allFamilyDocs, setAllFamilyDocs] = useState(() => {
    try {
      const saved = localStorage.getItem(DOCS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {}
    return [];
  });

  useEffect(() => {
    try {
      if (allFamilyDocs && allFamilyDocs.length > 0) {
        localStorage.setItem(DOCS_STORAGE_KEY, JSON.stringify(allFamilyDocs));
      }
    } catch (err) {}
  }, [allFamilyDocs, DOCS_STORAGE_KEY]);

  const [searchResults, setSearchResults] = useState([]);
  const [selectedSearchDoc, setSelectedSearchDoc] = useState(null);

  // Helper function for fuzzy/variant searching (e.g. Aadhar <-> Aadhaar, PAN, names)
  function matchesQuery(fieldVal, query) {
    if (!fieldVal) return false;
    const str = String(fieldVal).toLowerCase();
    const q = String(query).toLowerCase();
    if (str.includes(q)) return true;

    // Normalize double-a spelling variations (e.g. Aadhar <-> Aadhaar)
    const normStr = str.replace(/aa/g, "a").replace(/\s+/g, "");
    const normQ = q.replace(/aa/g, "a").replace(/\s+/g, "");
    return normStr.includes(normQ);
  }

  useEffect(() => {
    if (user?.familyId && !user.isGuest) {
      api.getFamilyMembers(user.familyId)
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            const formatted = data.map((m) => ({
              id: m._id || m.id,
              name: m.name,
              role: m.role === "admin" ? "Family Admin" : "Member",
              online: true,
              color: m.color || "#7C3AED",
            }));
            setMembers(formatted);

            if (memberId) {
              const matched = formatted.find((m) => m.id === memberId);
              if (matched) {
                setActiveMemberId(matched.id);
                return;
              }
            }

            const loggedInMember = formatted.find(
              (m) =>
                m.name?.toLowerCase() === user?.name?.toLowerCase() ||
                m.id === user?.id ||
                m.email?.toLowerCase() === user?.email?.toLowerCase()
            ) || formatted[0];

            setActiveMemberId(loggedInMember.id);
          } else {
            const fallback = [{ id: user.id || user.name.toLowerCase(), name: user.name, role: user.role === "admin" ? "Family Admin" : "Member", online: true, color: user.color || "#7C3AED" }];
            setMembers(fallback);
            setActiveMemberId(fallback[0].id);
          }
        })
        .catch(() => {
          const fallback = [{ id: user.id || user.name.toLowerCase(), name: user.name, role: user.role === "admin" ? "Family Admin" : "Member", online: true, color: user.color || "#7C3AED" }];
          setMembers(fallback);
          setActiveMemberId(fallback[0].id);
        });
    } else if (user?.isFresh) {
      const fallback = [{ id: user.id || user.name.toLowerCase(), name: user.name, role: user.role === "admin" ? "Family Admin" : "Member", online: true, color: user.color || "#7C3AED" }];
      setMembers(fallback);
      setGroups(FRESH_GROUPS);
      setActiveMemberId(fallback[0].id);
    } else {
      api.getMembers().then((m) => {
        setMembers(m);
        if (!memberId && m.length > 0) setActiveMemberId(m[0].id);
      });
    }
  }, [user, memberId]);

  const loadDocumentsFromDB = () => {
    if (user?.familyId && !user.isGuest) {
      const currentMember = members.find((m) => m.id === activeMemberId) || members[0] || { name: user?.name || "User" };
      const isOwner = user?.name?.toLowerCase() === currentMember.name?.toLowerCase();
      const isAdmin = user?.role === "admin";

      api.getFamilyDocuments(user.familyId)
        .then((dbDocs) => {
          if (Array.isArray(dbDocs)) {
            setAllFamilyDocs(dbDocs);

            // 1. Filter documents belonging to the selected member vault
            const memberDocs = dbDocs.filter(
              (d) =>
                d.member?.toLowerCase() === currentMember.name?.toLowerCase() ||
                d.uploadedBy?.toLowerCase() === currentMember.name?.toLowerCase()
            );

            // 2. Apply Privacy Visibility Rules for folder view
            const visibleDocs = memberDocs.filter((d) => {
              if (isOwner) return true;
              if (d.privacy === "Private") return false;
              if (d.privacy === "Parents only") return isAdmin;
              return true;
            });

            const computedGroups = DEFAULT_CATEGORIES.map((catName) => {
              const catDocs = visibleDocs.filter((d) => d.category === catName);
              const fileList = catDocs.map((d) => d.name);
              const fileObjs = catDocs.map((d) => ({
                id: d._id,
                name: d.name,
                category: d.category,
                fileSize: d.fileSize,
                member: d.member,
                uploadedBy: d.uploadedBy,
                privacy: d.privacy,
              }));

              return {
                name: catName,
                count: catDocs.length,
                updated: catDocs.length > 0 ? "Just now" : "Not uploaded",
                sharedWith: catDocs[0]?.privacy || "Shared with family",
                files: fileList,
                fileObjects: fileObjs,
              };
            });

            setGroups(computedGroups);
          }
        })
        .catch((err) => console.log("Error fetching family docs:", err));
    } else {
      // Demo / Guest mode sample family documents
      const sampleDocs = [
        { _id: "s1", name: "Aadhaar Card.pdf", category: "Identity", member: members[0]?.name || user?.name || "Family Member", uploadedBy: members[0]?.name || user?.name || "Family Member", privacy: "Shared with family", fileSize: "1.4 MB", createdAt: new Date().toISOString() },
        { _id: "s2", name: "PAN Card.pdf", category: "Identity", member: members[1]?.name || "Gande Sai Teja", uploadedBy: members[0]?.name || user?.name || "Family Member", privacy: "Shared with family", fileSize: "850 KB", createdAt: new Date().toISOString() },
        { _id: "s3", name: "SBI Passbook.pdf", category: "Banking", member: members[0]?.name || user?.name || "Family Member", uploadedBy: members[0]?.name || user?.name || "Family Member", privacy: "Shared with family", fileSize: "2.1 MB", createdAt: new Date().toISOString() },
        { _id: "s4", name: "Degree Certificate.pdf", category: "Education", member: members[2]?.name || "Ruthvika", uploadedBy: members[2]?.name || "Ruthvika", privacy: "Shared with family", fileSize: "3.5 MB", createdAt: new Date().toISOString() },
        { _id: "s5", name: "Health Card.pdf", category: "Medical", member: members[0]?.name || user?.name || "Family Member", uploadedBy: members[0]?.name || user?.name || "Family Member", privacy: "Shared with family", fileSize: "1.1 MB", createdAt: new Date().toISOString() },
      ];
      setAllFamilyDocs(sampleDocs);
      if (activeMemberId) {
        api.getMemberDocuments(activeMemberId).then(setGroups);
      }
    }
  };

  useEffect(() => {
    loadDocumentsFromDB();
  }, [activeMemberId, members, user]);

  // Handle live global document search filtering across all family members
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const q = searchQuery.trim();
    const isAdmin = user?.role === "admin";
    const loggedInUser = user?.name?.toLowerCase() || "";

    const visibleDocs = allFamilyDocs.filter((doc) => {
      const docOwner = (doc.member || "").toLowerCase();
      const uploader = (doc.uploadedBy || "").toLowerCase();
      const isMine = docOwner === loggedInUser || uploader === loggedInUser;

      // Privacy Rules:
      // 1. "Shared with family" -> Visible to ALL family members
      // 2. "Private" -> Visible ONLY to the owner/uploader
      // 3. "Parents only" -> Visible to Admins or owner
      if (doc.privacy === "Private" && !isMine) return false;
      if (doc.privacy === "Parents only" && !isAdmin && !isMine) return false;
      return true;
    });

    const matches = visibleDocs.filter(
      (d) =>
        matchesQuery(d.name, q) ||
        matchesQuery(d.category, q) ||
        matchesQuery(d.member, q) ||
        matchesQuery(d.uploadedBy, q)
    );

    setSearchResults(matches);
  }, [searchQuery, allFamilyDocs, user]);

  const member = members.find((m) => m.id === activeMemberId) || members[0] || { name: user?.name || "User", color: "#7C3AED" };

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function formatBytes(bytes) {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  const [docToDelete, setDocToDelete] = useState(null);

  async function confirmDeleteSearchDoc() {
    if (!docToDelete) return;
    const doc = docToDelete;
    try {
      if (doc._id && !doc._id.startsWith("s")) {
        await api.deleteDocument(doc._id);
      }
      setAllFamilyDocs((prev) => prev.filter((d) => d._id !== doc._id && d.name !== doc.name));
      setSearchResults((prev) => prev.filter((d) => d._id !== doc._id && d.name !== doc.name));
      setSelectedSearchDoc(null);
      loadDocumentsFromDB();
    } catch (err) {
      console.log("Error deleting document from search:", err);
    } finally {
      setDocToDelete(null);
    }
  }

  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuccessMsg, setAiSuccessMsg] = useState("");

  async function processAutoFill(fileName) {
    if (!fileName) return;
    setAiLoading(true);
    setAiSuccessMsg("");
    try {
      const res = await api.autoFillDocumentInfo(fileName);
      if (res?.cleanName) setDocName(res.cleanName);
      if (res?.category) setDocCategory(res.category);
      if (res?.privacy) setDocShared(res.privacy);
      setAiSuccessMsg(`Groq AI auto-categorized into ${res.category || "Identity"}!`);
    } catch (err) {
      console.log("AI AutoFill error:", err);
      setDocName(fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
    } finally {
      setAiLoading(false);
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        setSelectedFile({
          name: file.name,
          size: formatBytes(file.size),
          type: file.type || "Document",
          fileUrl: evt.target.result,
        });
      };
      reader.readAsDataURL(file);
      processAutoFill(file.name);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        setSelectedFile({
          name: file.name,
          size: formatBytes(file.size),
          type: file.type || "Document",
          fileUrl: evt.target.result,
        });
      };
      reader.readAsDataURL(file);
      processAutoFill(file.name);
    }
  }

  async function handleUploadDoc(e) {
    e.preventDefault();
    if (!docName.trim()) return;

    const currentMemberObj = members.find((m) => m.id === activeMemberId);

    const docPayload = {
      name: docName.trim(),
      category: docCategory,
      member: currentMemberObj?.name || user?.name || "Member",
      familyId: user?.familyId || user?.inviteCode || "FAM-DEFAULT",
      privacy: docShared,
      fileSize: selectedFile?.size || "1.2 MB",
      fileUrl: selectedFile?.fileUrl || "",
      uploadedBy: user?.name || "User",
    };

    const newLocalDoc = {
      _id: `local-${Date.now()}`,
      ...docPayload,
      createdAt: new Date().toISOString(),
    };
    setAllFamilyDocs((prev) => [newLocalDoc, ...prev]);

    try {
      await api.uploadDocument(docPayload);
      loadDocumentsFromDB();
    } catch (err) {
      console.log("Saved document context locally:", err.message);
      setGroups((prev) => {
        const existing = prev.find((g) => g.name === docCategory);
        if (existing) {
          return prev.map((g) =>
            g.name === docCategory
              ? { ...g, count: g.count + 1, updated: "Just now" }
              : g
          );
        } else {
          return [
            ...prev,
            { name: docCategory, count: 1, updated: "Just now", sharedWith: docShared },
          ];
        }
      });
    }

    // Reset modal state
    setDocName("");
    setSelectedFile(null);
    setShowUploadModal(false);
  }

  return (
    <div className="profile-view">
      <div className="top-row">
        <div>
          <div className="greet-label back-link" onClick={onBack}>
            ← DASHBOARD
          </div>
          <div className="greet-name">Family Documents</div>
        </div>
        {user?.permission === "View Only" && user?.role !== "admin" ? (
          <div className="folder-share" style={{ background: "var(--amber-tint)", color: "#B45309", fontWeight: 700, padding: "8px 16px", borderRadius: 8 }}>
            👁️ View Only Access Active
          </div>
        ) : (
          <button className="add-bill-btn" onClick={() => setShowUploadModal(true)}>
            + Upload Document
          </button>
        )}
      </div>

      {/* Member Selector Bar */}
      <div className="member-selector-row">
        {members.map((m) => {
          const dName = getMemberDisplayName(user, m.id, m.name);
          return (
            <button
              key={m.id}
              className={`member-pill${m.id === activeMemberId ? " active" : ""}`}
              onClick={() => setActiveMemberId(m.id)}
            >
              <span
                className="member-pill-dot"
                style={{ background: `linear-gradient(135deg, ${m.color}, ${m.color}aa)` }}
              >
                {dName.charAt(0)}
              </span>
              {dName}
            </button>
          );
        })}
      </div>

      <div className="profile-hero card">
        <div
          className={`avatar-img${member.online ? " online" : ""}`}
          style={{ background: `linear-gradient(135deg, ${member.color || "#7C3AED"}, ${member.color || "#7C3AED"}aa)` }}
        >
          {getMemberDisplayName(user, member.id, member.name).charAt(0)}
        </div>
        <div className="profile-info">
          <h2>{getMemberDisplayName(user, member.id, member.name)}'s Document Vault</h2>
          <div className="profile-status">
            {member.role || "Family Member"} · {member.online ? "Online now" : "Offline"}
          </div>
          <div className="profile-pill">Access Level: Family Shared</div>
        </div>
      </div>

      {/* Document Search Bar */}
      <div className="doc-search-bar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#726F8C" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          type="text"
          placeholder="Search all family documents (e.g. Aadhaar, PAN, Bank Passbook, Member Name...)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="clear-search-btn" onClick={() => setSearchQuery("")}>
            ✕
          </button>
        )}
      </div>

      {/* SEARCH RESULTS VIEW (when searchQuery is non-empty) */}
      {searchQuery.trim() ? (
        <div>
          <div className="section-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h4>
              Family Search Results for "{searchQuery}" ({searchResults.length})
            </h4>
            <span style={{ fontSize: 12, color: "var(--purple)", fontWeight: 700 }}>
              Showing files shared with family across all members
            </span>
          </div>

          <div className="card folder-files-card">
            {searchResults.length === 0 ? (
              <div className="grocery-empty" style={{ padding: "32px 16px", textAlign: "center" }}>
                🔍 No family documents found matching "<strong>{searchQuery}</strong>".<br />
                <span style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 6, display: "block" }}>
                  Try searching for keywords like <em>Aadhaar</em>, <em>PAN</em>, <em>Passbook</em>, or a family member's name.
                </span>
              </div>
            ) : (
              searchResults.map((d, index) => {
                const tint = GROUP_TINTS[d.category] || GROUP_TINTS.Identity;
                const isOwnerOrAdmin =
                  user?.role === "admin" ||
                  user?.name?.toLowerCase() === (d.uploadedBy || "").toLowerCase() ||
                  user?.name?.toLowerCase() === (d.member || "").toLowerCase();

                return (
                  <div
                    className="file-row"
                    key={d._id || index}
                    onClick={() => setSelectedSearchDoc(d)}
                    style={{
                      padding: "14px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      borderBottom: index < searchResults.length - 1 ? "1px solid var(--line)" : "none",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      className="file-ico"
                      style={{
                        background: tint.bg,
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <FolderIcon color={tint.fg} size={22} />
                    </div>

                    <div className="file-details" style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <p
                          className="file-name"
                          style={{
                            margin: 0,
                            fontWeight: 700,
                            fontSize: 14,
                            color: "var(--ink)",
                          }}
                        >
                          {d.name}
                        </p>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: tint.fg,
                            background: tint.bg,
                            padding: "2px 8px",
                            borderRadius: 6,
                          }}
                        >
                          {d.category}
                        </span>
                      </div>

                      <div
                        className="file-meta"
                        style={{
                          fontSize: 12.5,
                          color: "var(--ink-soft)",
                          marginTop: 4,
                          display: "flex",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <span>
                          👤 <strong>Belongs to:</strong>{" "}
                          <span style={{ color: "var(--purple)", fontWeight: 700 }}>
                            {d.member || "Family Member"}
                          </span>
                        </span>
                        <span>
                          📤 <strong>Uploaded by:</strong>{" "}
                          <strong style={{ color: "var(--ink)" }}>{d.uploadedBy || d.member || "Family Member"}</strong>
                        </span>
                        <span>🔒 {d.privacy || "Shared with family"}</span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <div
                        style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: "var(--purple)",
                          background: "var(--purple-tint)",
                          padding: "4px 8px",
                          borderRadius: 6,
                        }}
                      >
                        {d.fileSize || "1.2 MB"}
                      </div>
                      <button
                        type="button"
                        className="file-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSearchDoc(d);
                        }}
                      >
                        Preview
                      </button>
                      {isOwnerOrAdmin && (
                        <button
                          type="button"
                          className="file-action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDocToDelete(d);
                          }}
                          style={{ color: "#DC2626", borderColor: "#FCA5A5", background: "#FEF2F2", fontWeight: 700 }}
                          title="Delete document"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* NORMAL CATEGORY FOLDERS VIEW (when searchQuery is empty) */
        <>
          <div className="section-head">
            <h4>Document Collections</h4>
          </div>

          <div className="folder-grid">
            {filteredGroups.length === 0 ? (
              <div className="grocery-empty" style={{ gridColumn: "1 / -1" }}>
                No document collections match your search.
              </div>
            ) : (
              filteredGroups.map((g) => {
                const tint = GROUP_TINTS[g.name] || GROUP_TINTS.Identity;
                return (
                  <div className="folder-card" key={g.name} onClick={() => onOpenFolder(g)}>
                    <div className="folder-icon" style={{ background: tint.bg }}>
                      <FolderIcon color={tint.fg} />
                    </div>
                    <div>
                      <p className="folder-name">{g.name}</p>
                      <div className="folder-meta">
                        {g.count} files · {g.updated}
                      </div>
                    </div>
                    <div className="folder-share">
                      {g.sharedWith}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Document Search Result Preview Modal */}
      {selectedSearchDoc && (
        <div className="modal-overlay" onClick={() => setSelectedSearchDoc(null)}>
          <div className="modal-card card" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedSearchDoc.name}</h3>
              <button className="close-btn" onClick={() => setSelectedSearchDoc(null)}>✕</button>
            </div>
            <div className="preview-body">
              <div className="preview-placeholder" style={{ padding: "24px 16px", textAlign: "center", background: "var(--bg-card)", borderRadius: 12, border: "1px dashed var(--line)" }}>
                <FolderIcon size={48} color="#7C3AED" />
                <p style={{ marginTop: 12, fontWeight: 700, fontSize: 16 }}>{selectedSearchDoc.name}</p>
                <div style={{ marginTop: 8, fontSize: 13, color: "var(--ink-soft)", display: "flex", flexDirection: "column", gap: 4 }}>
                  <span>📂 <strong>Category:</strong> {selectedSearchDoc.category}</span>
                  <span>👤 <strong>Belongs to:</strong> {selectedSearchDoc.member}</span>
                  <span>📤 <strong>Uploaded by:</strong> {selectedSearchDoc.uploadedBy || selectedSearchDoc.member}</span>
                  <span>🔒 <strong>Access:</strong> {selectedSearchDoc.privacy}</span>
                  <span>📏 <strong>File Size:</strong> {selectedSearchDoc.fileSize || "1.2 MB"}</span>
                </div>
              </div>
              <div className="modal-actions" style={{ marginTop: 20 }}>
                {(user?.role === "admin" || user?.name?.toLowerCase() === (selectedSearchDoc.uploadedBy || "").toLowerCase() || user?.name?.toLowerCase() === (selectedSearchDoc.member || "").toLowerCase()) && (
                  <button
                    className="btn-secondary"
                    style={{ color: "var(--coral)", borderColor: "#FCA5A5" }}
                    onClick={() => setDocToDelete(selectedSearchDoc)}
                  >
                    Delete File
                  </button>
                )}
                <button
                  className="btn-primary"
                  onClick={() => downloadDocumentFile(selectedSearchDoc)}
                >
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
              Are you sure you want to delete <strong>"{docToDelete.name || docToDelete}"</strong>? This document will be permanently removed from your family's vault.
            </p>
            <div className="modal-actions" style={{ justifyContent: "center", gap: 12 }}>
              <button type="button" className="btn-secondary" onClick={() => setDocToDelete(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" style={{ background: "#DC2626", borderColor: "#DC2626", color: "#FFF" }} onClick={confirmDeleteSearchDoc}>
                Delete Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-card card" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Upload Document</h3>
              <button className="close-btn" onClick={() => setShowUploadModal(false)}>✕</button>
            </div>

            <form onSubmit={handleUploadDoc} className="modal-form">
              {/* File Dropzone & Browse Input */}
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                  accept=".pdf,.jpg,.jpeg,.png,.docx,.doc"
                />
                <div
                  className={`file-dropzone${isDragging ? " dropzone-active" : ""}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="dropzone-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                    </svg>
                  </div>
                  {selectedFile ? (
                    <div className="file-selected-info">
                      <strong>{selectedFile.name}</strong>
                      <span>{selectedFile.size} · File selected</span>
                    </div>
                  ) : (
                    <div className="dropzone-prompt">
                      <strong>Drag & drop your file here</strong>
                      <span>or <span className="browse-link">browse files</span> from computer (PDF, PNG, JPG, DOCX)</span>
                    </div>
                  )}
                </div>
              </div>

              {aiLoading && (
                <div style={{ background: "var(--purple-tint)", color: "var(--purple)", padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
                  ⚡ Groq AI is analyzing filename & auto-filling fields...
                </div>
              )}
              {aiSuccessMsg && !aiLoading && (
                <div style={{ background: "var(--mint-tint)", color: "#0D9488", padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
                  ✨ {aiSuccessMsg}
                </div>
              )}

              <label style={{ marginTop: 12 }}>
                Document Title
                <input
                  type="text"
                  placeholder="e.g. Passport, Tax Return 2024..."
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  required
                />
              </label>
              <label>
                Category Folder
                <select value={docCategory} onChange={(e) => setDocCategory(e.target.value)}>
                  <option value="Identity">Identity</option>
                  <option value="Banking">Banking</option>
                  <option value="Education">Education</option>
                  <option value="Medical">Medical</option>
                  <option value="Property">Property</option>
                </select>
              </label>
              <label>
                Sharing Privacy
                <select value={docShared} onChange={(e) => setDocShared(e.target.value)}>
                  <option value="Shared with family">Shared with family</option>
                  <option value="Private">Private</option>
                </select>
              </label>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowUploadModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={!docName.trim()}>
                  Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
